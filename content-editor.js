(function () {
  const INLINE_TAGS = new Set(["strong", "em", "br"]);
  const BLOCK_TAGS = new Set(["div", "p", "section", "article", "header", "footer", "li"]);

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function sanitizeRichText(input) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${input}</body>`, "text/html");

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return escapeHtml(node.textContent || "");
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
      }

      const tagName = node.tagName.toLowerCase();
      const childHtml = Array.from(node.childNodes).map(walk).join("");

      if (tagName === "b" || tagName === "strong") {
        return `<strong>${childHtml}</strong>`;
      }

      if (tagName === "i" || tagName === "em") {
        return `<em>${childHtml}</em>`;
      }

      if (tagName === "br") {
        return "<br>";
      }

      if (BLOCK_TAGS.has(tagName)) {
        return `${childHtml}<br>`;
      }

      return childHtml;
    }

    return Array.from(doc.body.childNodes)
      .map(walk)
      .join("")
      .replace(/(<br>\s*){3,}/g, "<br><br>")
      .replace(/^(<br>\s*)+|(<br>\s*)+$/g, "");
  }

  function htmlToPlainText(input) {
    return input
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(strong|em)>/gi, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#39;/gi, "'")
      .replace(/&quot;/gi, '"');
  }

  function isSafeHref(value, protocol) {
    if (protocol === "mailto") {
      return value.includes("@");
    }

    if (protocol === "tel") {
      return /^\+?[0-9()\-\s]+$/.test(value);
    }

    if (protocol === "https") {
      try {
        const url = new URL(value);
        return url.protocol === "https:";
      } catch (error) {
        return false;
      }
    }

    return false;
  }

  async function fetchContent(config) {
    if (config.contentApiPath) {
      try {
        const apiResponse = await fetch(config.contentApiPath, { cache: "no-store" });
        if (apiResponse.ok) {
          return apiResponse.json();
        }
      } catch (error) {
        // Fall back to the static content file when the API is unavailable.
      }
    }

    const fileResponse = await fetch(config.contentFilePath, { cache: "no-store" });
    if (!fileResponse.ok) {
      throw new Error("Unable to load site copy.");
    }

    return fileResponse.json();
  }

  function renderChipRow(container, chips) {
    container.replaceChildren();

    chips.forEach((chip) => {
      const span = document.createElement("span");
      span.textContent = chip;
      container.appendChild(span);
    });
  }

  function applyContent(content, root = document) {
    root.title = content.metaTitle;

    const metaDescription = root.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", content.metaDescription);
    }

    root.querySelectorAll("[data-copy-text]").forEach((element) => {
      const key = element.dataset.copyText;
      if (Object.hasOwn(content, key)) {
        element.textContent = content[key];
      }
    });

    root.querySelectorAll("[data-copy-html]").forEach((element) => {
      const key = element.dataset.copyHtml;
      if (Object.hasOwn(content, key)) {
        element.innerHTML = sanitizeRichText(content[key]);
      }
    });

    root.querySelectorAll("[data-copy-attr]").forEach((element) => {
      element.dataset.copyAttr.split(",").forEach((entry) => {
        const [attributeName, key] = entry.split(":");
        if (attributeName && key && Object.hasOwn(content, key)) {
          element.setAttribute(attributeName, content[key]);
        }
      });
    });

    root.querySelectorAll("[data-copy-mailto]").forEach((element) => {
      const key = element.dataset.copyMailto;
      if (!Object.hasOwn(content, key)) {
        return;
      }

      const value = content[key];
      element.textContent = value;
      if (isSafeHref(value, "mailto")) {
        element.setAttribute("href", `mailto:${value}`);
      }
    });

    root.querySelectorAll("[data-copy-tel]").forEach((element) => {
      const displayKey = element.dataset.copyTel;
      const hrefKey = element.dataset.copyTelHref;
      if (Object.hasOwn(content, displayKey)) {
        element.textContent = content[displayKey];
      }

      if (Object.hasOwn(content, hrefKey) && isSafeHref(content[hrefKey], "tel")) {
        element.setAttribute("href", `tel:${content[hrefKey]}`);
      }
    });

    root.querySelectorAll("[data-copy-link]").forEach((element) => {
      const textKey = element.dataset.copyLink;
      const hrefKey = element.dataset.copyLinkHref;
      if (Object.hasOwn(content, textKey)) {
        element.textContent = content[textKey];
      }

      if (Object.hasOwn(content, hrefKey) && isSafeHref(content[hrefKey], "https")) {
        element.setAttribute("href", content[hrefKey]);
      }
    });

    root.querySelectorAll("[data-copy-chip-row]").forEach((element) => {
      const key = element.dataset.copyChipRow;
      if (Array.isArray(content[key])) {
        renderChipRow(element, content[key]);
      }
    });
  }

  function getPageConfig() {
    return window.SITE_CONFIG || {
      contentApiPath: "api/content",
      contentFilePath: "content/site-copy.json",
    };
  }

  window.SiteContentEditor = {
    INLINE_TAGS,
    applyContent,
    fetchContent,
    getPageConfig,
    htmlToPlainText,
    sanitizeRichText,
  };
})();
