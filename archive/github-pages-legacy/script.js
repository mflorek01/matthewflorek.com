const { applyContent, fetchContent, getPageConfig } = window.SiteContentEditor;

const revealables = document.querySelectorAll("[data-reveal]");

const revealObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  },
  {
    rootMargin: "0px 0px -10% 0px",
    threshold: 0.15,
  }
);

function initializeReveal() {
  revealables.forEach((element, index) => {
    element.style.transitionDelay = `${index * 80}ms`;
    revealObserver.observe(element);
  });
}

async function initializeContent() {
  const content = await fetchContent(getPageConfig());
  applyContent(content);
}

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) {
    return;
  }

  if (event.data?.type !== "ops-preview-update") {
    return;
  }

  applyContent(event.data.payload);
});

initializeReveal();
initializeContent().catch(() => {
  // Keep the inline copy if the content file cannot be loaded.
});
