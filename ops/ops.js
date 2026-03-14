const { fetchContent, getPageConfig, sanitizeRichText } = window.SiteContentEditor;

const FIELDS = [
  {
    legend: "Meta",
    fields: [
      { key: "metaTitle", label: "Browser title", type: "text" },
      { key: "metaDescription", label: "Meta description", type: "textarea" },
    ],
  },
  {
    legend: "Header",
    fields: [
      { key: "wordmark", label: "Wordmark", type: "text" },
      { key: "navFocus", label: "Focus nav label", type: "text" },
      { key: "navResume", label: "Resume nav label", type: "text" },
      { key: "navContact", label: "Contact nav label", type: "text" },
    ],
  },
  {
    legend: "Hero",
    fields: [
      { key: "heroEyebrow", label: "Hero eyebrow", type: "rich" },
      { key: "heroHeading", label: "Hero heading", type: "rich" },
      { key: "heroLede", label: "Hero summary", type: "rich" },
      { key: "heroPrimaryCta", label: "Primary button label", type: "text" },
      { key: "heroSecondaryCta", label: "Email button label", type: "text" },
      { key: "heroTertiaryCta", label: "LinkedIn button label", type: "text" },
      { key: "detailEmailLabel", label: "Email detail label", type: "text" },
      { key: "detailPhoneLabel", label: "Phone detail label", type: "text" },
      { key: "detailFocusLabel", label: "Focus detail label", type: "text" },
      { key: "detailFocusValue", label: "Focus detail value", type: "rich" },
      { key: "portraitAlt", label: "Portrait image alt text", type: "text" },
      { key: "portraitKicker", label: "Portrait kicker", type: "text" },
      { key: "portraitNote", label: "Portrait note", type: "rich" },
    ],
  },
  {
    legend: "Focus section",
    fields: [
      { key: "focusEyebrow", label: "Section eyebrow", type: "text" },
      { key: "focusHeading", label: "Section heading", type: "rich" },
      { key: "focusCardOneTitle", label: "Card 1 title", type: "rich" },
      { key: "focusCardOneBody", label: "Card 1 body", type: "rich" },
      { key: "focusCardTwoTitle", label: "Card 2 title", type: "rich" },
      { key: "focusCardTwoBody", label: "Card 2 body", type: "rich" },
      { key: "focusCardThreeTitle", label: "Card 3 title", type: "rich" },
      { key: "focusCardThreeBody", label: "Card 3 body", type: "rich" },
      { key: "toolbeltLabel", label: "Toolbelt label", type: "rich" },
      { key: "toolChips", label: "Tool chips, one per line", type: "list" },
    ],
  },
  {
    legend: "Resume section",
    fields: [
      { key: "resumeEyebrow", label: "Section eyebrow", type: "text" },
      { key: "resumeHeading", label: "Section heading", type: "rich" },
      { key: "resumePrimaryCta", label: "Download button", type: "text" },
      { key: "resumeSecondaryCta", label: "New tab button", type: "text" },
      { key: "resumeFallbackBody", label: "PDF fallback body", type: "rich" },
      { key: "resumeFallbackCta", label: "PDF fallback button", type: "text" },
    ],
  },
  {
    legend: "Contact",
    fields: [
      { key: "contactEyebrow", label: "Section eyebrow", type: "text" },
      { key: "contactHeading", label: "Section heading", type: "rich" },
      { key: "footerNote", label: "Footer note", type: "rich" },
      { key: "emailAddress", label: "Email address", type: "text" },
      { key: "phoneDisplay", label: "Phone display", type: "text" },
      { key: "phoneHref", label: "Phone href value", type: "text" },
      { key: "linkedinDisplay", label: "LinkedIn display text", type: "text" },
      { key: "linkedinUrl", label: "LinkedIn URL", type: "text" },
    ],
  },
];

const config = getPageConfig();
const form = document.querySelector("#ops-form");
const previewFrame = document.querySelector("#preview-frame");
const saveButton = document.querySelector("#save-button");
const reloadButton = document.querySelector("#reload-button");
const statusElement = document.querySelector("#ops-status");
const toolbarButtons = document.querySelectorAll("[data-command]");
const imageUploadInput = document.querySelector("#image-upload-input");
const imageUploadButton = document.querySelector("#image-upload-button");
const currentImagePathElement = document.querySelector("#current-image-path");

let currentContent = null;
let activeEditor = null;

function setStatus(message, state = "") {
  statusElement.textContent = message;
  statusElement.classList.remove("is-error", "is-success");
  if (state) {
    statusElement.classList.add(state);
  }
}

function updateCurrentImagePath(content) {
  currentImagePathElement.textContent =
    content?.portraitImagePath || "assets/profile-placeholder.svg";
}

function createField(field, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "ops-field";

  const label = document.createElement("label");
  label.setAttribute("for", field.key);
  label.textContent = field.label;
  wrapper.appendChild(label);

  if (field.type === "text") {
    const input = document.createElement("input");
    input.id = field.key;
    input.name = field.key;
    input.type = "text";
    input.value = value || "";
    input.addEventListener("input", handleDraftChange);
    wrapper.appendChild(input);
    return wrapper;
  }

  if (field.type === "textarea") {
    const textarea = document.createElement("textarea");
    textarea.id = field.key;
    textarea.name = field.key;
    textarea.value = value || "";
    textarea.addEventListener("input", handleDraftChange);
    wrapper.appendChild(textarea);
    return wrapper;
  }

  if (field.type === "list") {
    const textarea = document.createElement("textarea");
    textarea.id = field.key;
    textarea.name = field.key;
    textarea.value = Array.isArray(value) ? value.join("\n") : "";
    textarea.addEventListener("input", handleDraftChange);
    wrapper.appendChild(textarea);

    const help = document.createElement("p");
    help.className = "ops-help";
    help.textContent = "Each line becomes a single chip.";
    wrapper.appendChild(help);
    return wrapper;
  }

  const editor = document.createElement("div");
  editor.id = field.key;
  editor.dataset.fieldType = "rich";
  editor.dataset.key = field.key;
  editor.className = "ops-rich-input";
  editor.contentEditable = "true";
  editor.innerHTML = sanitizeRichText(value || "");
  editor.addEventListener("focus", () => {
    activeEditor = editor;
  });
  editor.addEventListener("input", handleDraftChange);
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      document.execCommand("insertLineBreak");
    }
  });
  wrapper.appendChild(editor);

  const help = document.createElement("p");
  help.className = "ops-help";
  help.textContent = "Use Bold, Italic, or Line Break from the toolbar.";
  wrapper.appendChild(help);
  return wrapper;
}

function renderForm(content) {
  form.replaceChildren();

  FIELDS.forEach((group) => {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "ops-fieldset";

    const legend = document.createElement("legend");
    legend.textContent = group.legend;
    fieldset.appendChild(legend);

    group.fields.forEach((field) => {
      fieldset.appendChild(createField(field, content[field.key]));
    });

    form.appendChild(fieldset);
  });
}

function collectDraft() {
  const draft = {};

  FIELDS.forEach((group) => {
    group.fields.forEach((field) => {
      const element = document.getElementById(field.key);
      if (!element) {
        return;
      }

      if (field.type === "rich") {
        draft[field.key] = sanitizeRichText(element.innerHTML);
      } else if (field.type === "list") {
        draft[field.key] = element.value
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean);
      } else {
        draft[field.key] = element.value;
      }
    });
  });

  return draft;
}

function pushPreview(draft) {
  const frameWindow = previewFrame.contentWindow;
  if (!frameWindow) {
    return;
  }

  frameWindow.postMessage(
    {
      type: "ops-preview-update",
      payload: draft,
    },
    window.location.origin
  );
}

function handleDraftChange() {
  const draft = collectDraft();
  currentContent = draft;
  pushPreview(draft);
  setStatus("Draft updated locally.");
}

async function loadContent() {
  setStatus("Loading current copy...");
  const content = await fetchContent(config);
  currentContent = content;
  renderForm(content);
  updateCurrentImagePath(content);
  setStatus("Loaded saved copy.");
}

async function saveContent() {
  try {
    const draft = collectDraft();
    setStatus("Saving changes...");

    const response = await fetch(config.contentApiPath, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(draft),
    });

    if (!response.ok) {
      let message = "Could not save changes.";

      if (response.status === 404 || response.status === 405) {
        message = "Save endpoint not available. Restart the site with ./scripts/start.sh.";
      } else if (response.status >= 500) {
        message = "Server error while saving changes.";
      }

      throw new Error(message);
    }

    currentContent = await fetchContent(config);
    renderForm(currentContent);
    pushPreview(currentContent);
    setStatus("Changes saved to disk.", "is-success");
  } catch (error) {
    setStatus(error.message || "Could not save changes.", "is-error");
  }
}

toolbarButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!activeEditor) {
      setStatus("Click into a rich text field first.", "is-error");
      return;
    }

    activeEditor.focus();
    const command = button.dataset.command;

    if (command === "linebreak") {
      document.execCommand("insertLineBreak");
    } else {
      document.execCommand(command);
    }

    handleDraftChange();
  });
});

saveButton.addEventListener("click", saveContent);
reloadButton.addEventListener("click", async () => {
  try {
    await loadContent();
    pushPreview(currentContent);
    setStatus("Reloaded saved copy.", "is-success");
  } catch (error) {
    setStatus("Could not reload saved copy.", "is-error");
  }
});

imageUploadButton.addEventListener("click", async () => {
  const [file] = imageUploadInput.files || [];
  if (!file) {
    setStatus("Choose an image file first.", "is-error");
    return;
  }

  setStatus("Uploading image...");

  try {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read the image file."));
      reader.readAsDataURL(file);
    });

    const response = await fetch("../api/profile-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: file.name,
        data,
      }),
    });

    if (!response.ok) {
      let message = "Could not upload image.";
      if (response.status === 404 || response.status === 405) {
        message = "Upload endpoint not available. Restart the site with ./scripts/start.sh.";
      } else if (response.status === 400) {
        const body = await response.text();
        message = body || message;
      } else if (response.status >= 500) {
        message = "Server error while uploading image.";
      }

      throw new Error(message);
    }

    const result = await response.json();
    currentContent = result.content;
    renderForm(currentContent);
    updateCurrentImagePath(currentContent);
    pushPreview(currentContent);
    imageUploadInput.value = "";
    setStatus("Image uploaded and applied.", "is-success");
  } catch (error) {
    setStatus(error.message || "Could not upload image.", "is-error");
  }
});

previewFrame.addEventListener("load", () => {
  if (currentContent) {
    pushPreview(currentContent);
  }
});

loadContent()
  .then(() => {
    pushPreview(currentContent);
  })
  .catch(() => {
    setStatus("Could not load the site copy.", "is-error");
  });
