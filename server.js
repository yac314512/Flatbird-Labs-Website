const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const nodemailer = require("nodemailer");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.jsonl");

const SMTP_HOST = (process.env.SMTP_HOST || "").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = (process.env.SMTP_SECURE || "").trim().toLowerCase() === "true";
const SMTP_USER = (process.env.SMTP_USER || "").trim();
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = (process.env.SMTP_FROM || SMTP_USER).trim();
const LEADS_TO = (process.env.LEADS_TO || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

let emailTransporter = null;

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": MIME_TYPES[".json"] });
  res.end(JSON.stringify(body));
}

function safeParseJson(input) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function validateLead(lead) {
  const errors = [];
  const required = ["name", "email", "company", "message"];

  for (const field of required) {
    if (!lead[field] || typeof lead[field] !== "string" || !lead[field].trim()) {
      errors.push(`${field} is required`);
    }
  }

  const email = (lead.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("email must be valid");
  }

  if (lead.message && lead.message.length > 4000) {
    errors.push("message is too long");
  }

  return errors;
}

function storeLead(lead) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const record = {
    ...lead,
    submittedAt: new Date().toISOString(),
  };

  fs.appendFileSync(LEADS_FILE, `${JSON.stringify(record)}\n`, "utf8");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hasEmailConfig() {
  return Boolean(
    SMTP_HOST
      && Number.isFinite(SMTP_PORT)
      && SMTP_USER
      && SMTP_PASS
      && SMTP_FROM
      && LEADS_TO.length
  );
}

function getEmailTransporter() {
  if (!emailTransporter) {
    emailTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return emailTransporter;
}

async function sendLeadNotification(lead) {
  if (!hasEmailConfig()) {
    throw new Error(
      "Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM, and LEADS_TO."
    );
  }

  const transporter = getEmailTransporter();
  const subject = `New Flatbird Labs inquiry from ${lead.name} (${lead.company})`;
  const interest = lead.interest || "Not provided";
  const submittedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const text = [
    "New Flatbird Labs inquiry",
    "",
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Company: ${lead.company}`,
    `Interest: ${interest}`,
    `Submitted: ${submittedAt}`,
    "",
    "Message:",
    lead.message,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0b1220;">
      <h2 style="margin-bottom: 16px;">New Flatbird Labs inquiry</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 720px;">
        <tr><td style="padding: 6px 0; font-weight: 700;">Name</td><td style="padding: 6px 0;">${escapeHtml(lead.name)}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 700;">Email</td><td style="padding: 6px 0;">${escapeHtml(lead.email)}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 700;">Company</td><td style="padding: 6px 0;">${escapeHtml(lead.company)}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 700;">Interest</td><td style="padding: 6px 0;">${escapeHtml(interest)}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 700;">Submitted</td><td style="padding: 6px 0;">${escapeHtml(submittedAt)}</td></tr>
      </table>
      <div style="margin-top: 20px;">
        <div style="font-weight: 700; margin-bottom: 8px;">Message</div>
        <div style="padding: 14px; border: 1px solid #d6def0; border-radius: 12px; background: #f8fbff; white-space: pre-wrap;">${escapeHtml(lead.message)}</div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: SMTP_FROM,
    to: LEADS_TO,
    replyTo: lead.email,
    subject,
    text,
    html,
  });
}

function serveFile(reqPath, res) {
  const cleanPath = reqPath === "/" ? "/index.html" : reqPath;
  const filePath = path.join(PUBLIC_DIR, cleanPath);
  const normalized = path.normalize(filePath);

  if (!normalized.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(normalized) || fs.statSync(normalized).isDirectory()) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(normalized).toLowerCase();
  const mimeType = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": mimeType });
  fs.createReadStream(normalized).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/leads") {
    let rawBody = "";
    req.on("data", (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 1_000_000) {
        req.socket.destroy();
      }
    });

    req.on("end", async () => {
      const body = safeParseJson(rawBody);
      if (!body) {
        sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
        return;
      }

      const errors = validateLead(body);
      if (errors.length) {
        sendJson(res, 400, { ok: false, error: errors.join(", ") });
        return;
      }

      const lead = {
        name: body.name.trim(),
        email: body.email.trim(),
        company: body.company.trim(),
        interest: typeof body.interest === "string" ? body.interest.trim() : "",
        message: body.message.trim(),
      };

      let notificationStatus = "sent";
      let notificationError = "";

      try {
        await sendLeadNotification(lead);
      } catch (error) {
        notificationStatus = "failed";
        notificationError = error instanceof Error ? error.message : "Unknown email delivery error";
        console.error("Lead email delivery failed:", notificationError);
      }

      storeLead({
        ...lead,
        notificationStatus,
        notificationError,
      });

      if (notificationStatus !== "sent") {
        sendJson(res, 502, {
          ok: false,
          error: "We saved your message, but could not deliver the notification email. Please email hello@flatbirdlabs.com directly until email delivery is configured.",
        });
        return;
      }

      sendJson(res, 201, { ok: true });
    });
    return;
  }

  if (req.method === "GET") {
    serveFile(url.pathname, res);
    return;
  }

  sendJson(res, 405, { ok: false, error: "Method not allowed" });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
