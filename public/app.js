const form = document.getElementById("lead-form");
const statusNode = document.getElementById("form-status");
const yearNode = document.getElementById("year");

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

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = {
      name: (formData.get("name") || "").toString(),
      email: (formData.get("email") || "").toString(),
      company: (formData.get("company") || "").toString(),
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
