const form = document.getElementById("lead-form");
const statusNode = document.getElementById("form-status");
const yearNode = document.getElementById("year");

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

const INTEREST_BY_SLUG = {
  opteros: "Opteros — book a brand snapshot",
  advisory: "Bespoke advisory — custom build engagement",
  agency: "Independent agency partnership",
  operator: "Just want to talk to an operator",
};

function setInterest(value) {
  if (!form) return;
  const select = form.elements.namedItem("interest");
  if (!select) return;
  const match = Array.from(select.options).find(
    (opt) => opt.value === value || opt.textContent.trim() === value
  );
  if (match) {
    select.value = match.value;
  }
}

function scrollToHash(hash) {
  if (!hash) return;
  const target = document.querySelector(hash);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// On load: honor ?interest=<slug> in the URL, and the form's data-default-interest fallback.
(function applyInitialInterest() {
  if (!form) return;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("interest");
  if (slug && INTEREST_BY_SLUG[slug]) {
    setInterest(INTEREST_BY_SLUG[slug]);
    return;
  }
  const fallback = form.dataset.defaultInterest;
  if (fallback) {
    setInterest(fallback);
  }
})();

// Catch CTA clicks like <a data-interest="opteros" href="#connect">.
document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-interest]");
  if (!link) return;
  const slug = link.dataset.interest;
  const mapped = INTEREST_BY_SLUG[slug];
  if (mapped) {
    setInterest(mapped);
  }
});

function setStatus(message, type) {
  if (!statusNode) return;
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
        headers: { "Content-Type": "application/json" },
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
