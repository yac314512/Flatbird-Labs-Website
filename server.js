const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.jsonl");

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

    req.on("end", () => {
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

      storeLead({
        name: body.name.trim(),
        email: body.email.trim(),
        company: body.company.trim(),
        phone: typeof body.phone === "string" ? body.phone.trim() : "",
        interest: typeof body.interest === "string" ? body.interest.trim() : "",
        message: body.message.trim(),
      });

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
