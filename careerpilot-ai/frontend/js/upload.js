/**
 * upload.js — Drag-and-drop, file picker, paste-text, and form submission.
 *
 * Responsibilities:
 *  - Tab switching (PDF / Text)
 *  - Drag-and-drop and file input handling
 *  - File validation and PDF text extraction (/api/extract-pdf)
 *  - Textarea character count
 *  - Enabling / disabling the Analyze button
 *  - Triggering the analysis and delegating to App.runAnalysis()
 */

const Upload = (() => {
  // ── State ──────────────────────────────────────────────────────────────
  let currentTab = "pdf"; // 'pdf' | 'text'
  let selectedFile = null; // File object
  let extractedText = ""; // Text from PDF extraction
  let pastedText = ""; // Text pasted by user

  // ── DOM refs (resolved on init) ────────────────────────────────────────
  let dropZone,
    fileInput,
    fileSelected,
    fileName,
    fileSize,
    fileRemove,
    extractStatus,
    resumeTextArea,
    charCount,
    clearTextBtn,
    jobTitleInput,
    analyzeBtn,
    tabBtns;

  // ── Helpers ────────────────────────────────────────────────────────────

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function getResumeText() {
    return currentTab === "pdf" ? extractedText : pastedText;
  }

  function updateAnalyzeBtn() {
    const text = getResumeText().trim();
    analyzeBtn.disabled = text.length < 50;
  }

  function setExtractStatus(type, msg) {
    extractStatus.className = `extract-status ${type}`;
    if (type === "loading") {
      extractStatus.innerHTML = `<span class="spinner-sm" style="border-top-color: var(--text-muted)"></span> ${msg}`;
    } else if (type === "success") {
      extractStatus.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg> ${msg}`;
    } else if (type === "error") {
      extractStatus.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg> ${msg}`;
    }
  }

  // ── Tab switching ──────────────────────────────────────────────────────

  function switchTab(tab) {
    currentTab = tab;

    tabBtns.forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });

    document.querySelectorAll(".tab-content").forEach((panel) => {
      const active = panel.id === `tab-${tab}`;
      panel.classList.toggle("active", active);
    });

    updateAnalyzeBtn();
  }

  // ── File handling ──────────────────────────────────────────────────────

  function showFileSelected(file) {
    dropZone.classList.add("hidden");
    fileSelected.classList.remove("hidden");
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    extractStatus.className = "extract-status";
    extractStatus.innerHTML = "";
  }

  function clearFile() {
    selectedFile = null;
    extractedText = "";
    dropZone.classList.remove("hidden");
    fileSelected.classList.add("hidden");
    fileInput.value = "";
    extractStatus.className = "extract-status";
    extractStatus.innerHTML = "";
    updateAnalyzeBtn();
  }

  async function processFile(file) {
    if (!file) return;

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      App.showToast("Only PDF files are supported.", "error");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      App.showToast("File too large. Maximum size is 10 MB.", "error");
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      App.showToast(
        "⚠️ Large scanned PDFs may not be processed correctly. Please use a searchable (text-based) PDF for the best experience.",
        "warning",
      );
    }

    selectedFile = file;
    extractedText = "";
    showFileSelected(file);
    setExtractStatus("loading", "Extracting text from PDF...");
    updateAnalyzeBtn();

    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await StreamClient.postForm("/api/extract-pdf", formData);

      extractedText = result.text;
      setExtractStatus(
        "success",
        `Text extracted — ${result.char_count.toLocaleString()} characters ready for analysis`,
      );
      updateAnalyzeBtn();
    } catch (err) {
      extractedText = "";
      setExtractStatus(
        "error",
        err.message || "Failed to extract text. Try pasting manually.",
      );
      updateAnalyzeBtn();
    }
  }

  // ── Drag-and-drop ──────────────────────────────────────────────────────

  function initDragDrop() {
    dropZone.addEventListener("dragenter", (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", (e) => {
      if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove("drag-over");
      }
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    });

    // Native file input change (browse)
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (file) processFile(file);
    });
  }

  // ── Textarea handling ──────────────────────────────────────────────────

  function initTextarea() {
    resumeTextArea.addEventListener("input", () => {
      pastedText = resumeTextArea.value;
      const count = pastedText.length;
      charCount.textContent =
        count.toLocaleString() + " character" + (count !== 1 ? "s" : "");
      updateAnalyzeBtn();
    });

    clearTextBtn.addEventListener("click", () => {
      resumeTextArea.value = "";
      pastedText = "";
      charCount.textContent = "0 characters";
      updateAnalyzeBtn();
    });
  }

  // ── Analyze button ─────────────────────────────────────────────────────

  function setAnalyzing(on) {
    analyzeBtn.disabled = on;
    analyzeBtn
      .querySelector(".btn-default-content")
      .classList.toggle("hidden", on);
    analyzeBtn
      .querySelector(".btn-loading-content")
      .classList.toggle("hidden", !on);
  }

  function initAnalyzeBtn() {
    analyzeBtn.addEventListener("click", async () => {
      const text = getResumeText().trim();
      if (!text || text.length < 50) {
        App.showToast(
          "Please provide more resume content (at least 50 characters).",
          "warning",
        );
        return;
      }

      const jobTitle = jobTitleInput ? jobTitleInput.value.trim() : "";
      setAnalyzing(true);

      try {
        await App.runAnalysis({ resumeText: text, jobTitle });
      } finally {
        setAnalyzing(false);
      }
    });
  }

  // ── New analysis reset ────────────────────────────────────────────────

  function resetForm() {
    clearFile();
    resumeTextArea.value = "";
    pastedText = "";
    charCount.textContent = "0 characters";
    if (jobTitleInput) jobTitleInput.value = "";
    switchTab("pdf");
    updateAnalyzeBtn();
  }

  // ── Getters ───────────────────────────────────────────────────────────

  function getJobTitle() {
    return jobTitleInput ? jobTitleInput.value.trim() : "";
  }

  // ── Init ──────────────────────────────────────────────────────────────

  function init() {
    dropZone = document.getElementById("dropZone");
    fileInput = document.getElementById("fileInput");
    fileSelected = document.getElementById("fileSelected");
    fileName = document.getElementById("fileName");
    fileSize = document.getElementById("fileSize");
    fileRemove = document.getElementById("fileRemove");
    extractStatus = document.getElementById("extractStatus");
    resumeTextArea = document.getElementById("resumeText");
    charCount = document.getElementById("charCount");
    clearTextBtn = document.getElementById("clearText");
    jobTitleInput = document.getElementById("jobTitle");
    analyzeBtn = document.getElementById("analyzeBtn");
    tabBtns = document.querySelectorAll(".tab-btn");

    // Tab clicks
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // Remove file button
    fileRemove.addEventListener("click", clearFile);

    initDragDrop();
    initTextarea();
    initAnalyzeBtn();
  }

  return { init, resetForm, getJobTitle };
})();
