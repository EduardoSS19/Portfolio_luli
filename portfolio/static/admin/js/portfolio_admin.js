(() => {
  "use strict";

  const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const maxBytes = 15 * 1024 * 1024;

  function enhanceTextareas() {
    document.querySelectorAll("textarea").forEach((field) => {
      if (field.dataset.editorEnhanced) return;
      field.dataset.editorEnhanced = "true";
      const counter = document.createElement("small");
      counter.className = "portfolio-character-count";
      counter.setAttribute("aria-live", "polite");
      field.insertAdjacentElement("afterend", counter);

      const update = () => {
        const lines = field.value.split(/\r\n|\r|\n/).length;
        counter.textContent = field.value.length.toLocaleString("pt-BR") +
          " caracteres · " + lines + (lines === 1 ? " linha" : " linhas");
      };
      field.addEventListener("input", update);
      update();
    });
  }

  function enhanceImageInputs() {
    document.querySelectorAll('input[type="file"]').forEach((field) => {
      if (field.dataset.editorEnhanced) return;
      field.dataset.editorEnhanced = "true";
      const feedback = document.createElement("div");
      feedback.className = "portfolio-upload-feedback";
      feedback.setAttribute("aria-live", "polite");
      field.insertAdjacentElement("afterend", feedback);

      field.addEventListener("change", () => {
        feedback.replaceChildren();
        const files = Array.from(field.files || []);
        if (!files.length) return;

        files.forEach((file) => {
          const item = document.createElement("div");
          item.className = "portfolio-upload-item";
          const valid = imageTypes.has(file.type);
          const sizeOk = file.size <= maxBytes;
          const info = document.createElement("span");
          info.textContent = file.name + " · " +
            (file.size / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) +
            " MB" + (!valid ? " · formato não aceito" : !sizeOk ? " · excede 15 MB" : "");
          item.append(info);

          if (valid && sizeOk) {
            const preview = document.createElement("img");
            preview.alt = "Prévia de " + file.name;
            preview.src = URL.createObjectURL(file);
            preview.onload = () => URL.revokeObjectURL(preview.src);
            item.prepend(preview);
          }
          feedback.append(item);
        });
      });
    });
  }

  function init() {
    enhanceTextareas();
    enhanceImageInputs();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();