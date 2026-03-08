const form = document.getElementById("lead-form");
const statusNode = document.getElementById("form-status");
const yearNode = document.getElementById("year");

const DEBUG_STORAGE_KEY = "flatbird_debug_outline";
let debugToggleButton = null;

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

function setStatus(message, type) {
  if (!statusNode) {
    return;
  }

  statusNode.textContent = message;
  statusNode.classList.remove("success", "error");
  if (type) {
    statusNode.classList.add(type);
  }
}

function setDebugMode(enabled) {
  document.body.classList.toggle("debug-outline", enabled);
  localStorage.setItem(DEBUG_STORAGE_KEY, enabled ? "1" : "0");

  if (!debugToggleButton) {
    return;
  }

  debugToggleButton.dataset.enabled = enabled ? "true" : "false";
  debugToggleButton.textContent = enabled ? "Debug: On" : "Debug: Off";
  debugToggleButton.setAttribute("aria-pressed", enabled ? "true" : "false");
}

function buildDebugToggle() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "debug-toggle";
  button.setAttribute("aria-label", "Toggle layout debug outlines");
  button.title = "Toggle layout debug outlines";

  button.addEventListener("click", () => {
    const isEnabled = document.body.classList.contains("debug-outline");
    setDebugMode(!isEnabled);
  });

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d") {
      event.preventDefault();
      const isEnabled = document.body.classList.contains("debug-outline");
      setDebugMode(!isEnabled);
    }
  });

  document.body.appendChild(button);
  debugToggleButton = button;

  const saved = localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
  setDebugMode(saved);
}

buildDebugToggle();

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = {
      name: (formData.get("name") || "").toString(),
      email: (formData.get("email") || "").toString(),
      company: (formData.get("company") || "").toString(),
      phone: (formData.get("phone") || "").toString(),
      interest: (formData.get("interest") || "").toString(),
      message: (formData.get("message") || "").toString(),
    };

    if (!payload.name || !payload.email || !payload.company || !payload.message) {
      setStatus("Please complete all required fields.", "error");
      return;
    }

    setStatus("Sending...", null);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setStatus(data.error || "Could not send your message.", "error");
        return;
      }

      form.reset();
      setStatus("Thank you. We received your message and will follow up shortly.", "success");
    } catch {
      setStatus("Network error. Please try again in a moment.", "error");
    }
  });
}
