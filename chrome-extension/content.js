(function () {
  "use strict";

  const CONFIG = {
    MAIN_PANEL_SELECTOR: ".GTuWw0eq.WtagMwIy.focusPanel",
    FALLBACK_PANEL_SELECTOR: ".focusPanel",
    SLIDE_SELECTOR: ".dySwiperSlide",
    IMAGE_SELECTOR: ".Stp1qoNr > img[src]",
    DOWNLOAD_DELAY_MS: 300,
    DOWNLOAD_FORMAT: "png",
    MIN_VISIBLE_PANEL_AREA: 100,
    CONTROL_MARGIN: 8,
    DRAG_THRESHOLD: 5,
    CONTROL_POSITION_STORAGE_KEY: "douyin-image-downloader-control-position",
    CONTROL_ID: "douyin-image-downloader-controls",
    BUTTON_ID: "douyin-image-downloader-button",
    SELECT_BUTTON_ID: "douyin-image-downloader-select-button",
    STYLE_ID: "douyin-image-downloader-style",
    MODAL_ID: "douyin-image-downloader-modal",
    LOG_PREFIX: "[Douyin Image Downloader]",
  };

  const IMAGE_URL_HINTS = ["douyinpic.com", "aweme_images"];
  const buttonState = {
    downloading: false,
    resetTimers: new Map(),
    dragState: null,
    suppressNextControlClick: false,
    resizeHandlerBound: false,
  };

  function log(...args) {
    console.log(CONFIG.LOG_PREFIX, ...args);
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function setActionButtonText(buttonId, text, temporary = false) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.textContent = text;

    const existingTimer = buttonState.resetTimers.get(buttonId);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      buttonState.resetTimers.delete(buttonId);
    }

    if (temporary) {
      const timer = window.setTimeout(() => {
        if (!buttonState.downloading) {
          button.textContent = button.dataset.defaultText || "下载PNG";
        }
        buttonState.resetTimers.delete(buttonId);
      }, 1800);
      buttonState.resetTimers.set(buttonId, timer);
    }
  }

  function setControlsDisabled(disabled) {
    [CONFIG.BUTTON_ID, CONFIG.SELECT_BUTTON_ID].forEach((buttonId) => {
      const button = document.getElementById(buttonId);
      if (button) button.disabled = disabled;
    });
  }

  function clamp(value, min, max) {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
  }

  function readSavedControlPosition() {
    try {
      const rawPosition = window.localStorage.getItem(CONFIG.CONTROL_POSITION_STORAGE_KEY);
      if (!rawPosition) return null;

      const position = JSON.parse(rawPosition);
      if (!Number.isFinite(position?.left) || !Number.isFinite(position?.top)) return null;

      return position;
    } catch (error) {
      log("Unable to read saved control position:", error);
      return null;
    }
  }

  function saveControlPosition(left, top) {
    try {
      window.localStorage.setItem(CONFIG.CONTROL_POSITION_STORAGE_KEY, JSON.stringify({ left, top }));
    } catch (error) {
      log("Unable to save control position:", error);
    }
  }

  function clampControlPosition(controls, left, top) {
    const rect = controls.getBoundingClientRect();
    const width = rect.width || 104;
    const height = rect.height || 84;
    const maxLeft = window.innerWidth - width - CONFIG.CONTROL_MARGIN;
    const maxTop = window.innerHeight - height - CONFIG.CONTROL_MARGIN;

    return {
      left: clamp(left, CONFIG.CONTROL_MARGIN, maxLeft),
      top: clamp(top, CONFIG.CONTROL_MARGIN, maxTop),
    };
  }

  function setControlPosition(controls, left, top, shouldSave) {
    const position = clampControlPosition(controls, left, top);

    controls.style.left = `${position.left}px`;
    controls.style.top = `${position.top}px`;
    controls.style.right = "auto";
    controls.style.bottom = "auto";

    if (shouldSave) {
      saveControlPosition(position.left, position.top);
    }
  }

  function applySavedControlPosition(controls) {
    const savedPosition = readSavedControlPosition();
    if (!savedPosition) return;

    window.requestAnimationFrame(() => {
      setControlPosition(controls, savedPosition.left, savedPosition.top, false);
    });
  }

  function keepControlsInViewport() {
    const controls = document.getElementById(CONFIG.CONTROL_ID);
    if (!controls || !controls.style.left || !controls.style.top) return;

    const rect = controls.getBoundingClientRect();
    setControlPosition(controls, rect.left, rect.top, true);
  }

  function ensureResizeHandler() {
    if (buttonState.resizeHandlerBound) return;

    buttonState.resizeHandlerBound = true;
    window.addEventListener("resize", keepControlsInViewport);
  }

  function makeControlsDraggable(controls) {
    if (controls.dataset.draggableReady === "true") return;

    controls.dataset.draggableReady = "true";
    controls.addEventListener("click", (event) => {
      if (!buttonState.suppressNextControlClick) return;

      event.preventDefault();
      event.stopPropagation();
      buttonState.suppressNextControlClick = false;
    }, true);

    controls.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;

      const rect = controls.getBoundingClientRect();
      buttonState.dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: rect.left,
        startTop: rect.top,
        dragging: false,
      };
    });

    document.addEventListener("pointermove", (event) => {
      const state = buttonState.dragState;
      if (!state || state.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - state.startX;
      const deltaY = event.clientY - state.startY;

      if (!state.dragging && Math.hypot(deltaX, deltaY) < CONFIG.DRAG_THRESHOLD) {
        return;
      }

      state.dragging = true;
      controls.classList.add("is-dragging");
      event.preventDefault();
      setControlPosition(controls, state.startLeft + deltaX, state.startTop + deltaY, false);
    });

    document.addEventListener("pointerup", finishDrag);
    document.addEventListener("pointercancel", finishDrag);

    function finishDrag(event) {
      const state = buttonState.dragState;
      if (!state || state.pointerId !== event.pointerId) return;

      if (state.dragging) {
        const rect = controls.getBoundingClientRect();
        setControlPosition(controls, rect.left, rect.top, true);
        buttonState.suppressNextControlClick = true;
        window.setTimeout(() => {
          buttonState.suppressNextControlClick = false;
        }, 250);
      }

      controls.classList.remove("is-dragging");
      buttonState.dragState = null;
    }
  }

  function createActionButton(id, text, title, className, clickHandler) {
    const button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.id = id;
    button.textContent = text;
    button.dataset.defaultText = text;
    button.title = title;
    button.addEventListener("click", clickHandler);
    return button;
  }

  function ensureButton() {
    if (document.getElementById(CONFIG.CONTROL_ID)) return;

    const controls = document.createElement("div");
    controls.id = CONFIG.CONTROL_ID;

    const downloadButton = createActionButton(
      CONFIG.BUTTON_ID,
      "下载PNG",
      "下载当前抖音图集的全部图片并转换为 PNG",
      "douyin-image-downloader-action douyin-image-downloader-action-primary",
      handleDownloadClick
    );
    const selectButton = createActionButton(
      CONFIG.SELECT_BUTTON_ID,
      "选择下载",
      "选择当前抖音图集中的部分图片并转换为 PNG",
      "douyin-image-downloader-action douyin-image-downloader-action-secondary",
      handleSelectDownloadClick
    );

    if (!document.getElementById(CONFIG.STYLE_ID)) {
      const style = document.createElement("style");
      style.id = CONFIG.STYLE_ID;
      style.textContent = `
      #${CONFIG.CONTROL_ID} {
        position: fixed;
        right: 24px;
        bottom: 96px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        gap: 8px;
        touch-action: none;
        user-select: none;
      }

      #${CONFIG.CONTROL_ID} .douyin-image-downloader-action {
        min-width: 104px;
        height: 38px;
        padding: 0 14px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 6px;
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        line-height: 38px;
        text-align: center;
        cursor: pointer;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }

      #${CONFIG.CONTROL_ID} .douyin-image-downloader-action-primary {
        background: rgba(254, 44, 85, 0.94);
      }

      #${CONFIG.CONTROL_ID} .douyin-image-downloader-action-primary:hover {
        background: rgba(255, 69, 110, 0.98);
      }

      #${CONFIG.CONTROL_ID} .douyin-image-downloader-action-secondary {
        background: rgba(37, 99, 235, 0.92);
      }

      #${CONFIG.CONTROL_ID} .douyin-image-downloader-action-secondary:hover {
        background: rgba(59, 130, 246, 0.98);
      }

      #${CONFIG.CONTROL_ID} .douyin-image-downloader-action:disabled {
        cursor: progress;
        opacity: 0.72;
      }

      #${CONFIG.CONTROL_ID}.is-dragging,
      #${CONFIG.CONTROL_ID}.is-dragging .douyin-image-downloader-action {
        cursor: grabbing;
      }

      #${CONFIG.MODAL_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(0, 0, 0, 0.56);
      }

      #${CONFIG.MODAL_ID} .douyin-image-downloader-dialog {
        width: min(780px, calc(100vw - 48px));
        max-height: min(720px, calc(100vh - 48px));
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 8px;
        background: #171821;
        color: #fff;
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42);
      }

      #${CONFIG.MODAL_ID} .douyin-image-downloader-header,
      #${CONFIG.MODAL_ID} .douyin-image-downloader-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
        flex: 0 0 auto;
      }

      #${CONFIG.MODAL_ID} .douyin-image-downloader-title {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
      }

      #${CONFIG.MODAL_ID} .douyin-image-downloader-count {
        color: rgba(255, 255, 255, 0.72);
        font-size: 13px;
      }

      #${CONFIG.MODAL_ID} .douyin-image-downloader-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
        gap: 10px;
        min-height: 0;
        overflow: auto;
        padding: 0 16px 16px;
      }

      #${CONFIG.MODAL_ID} .douyin-image-downloader-thumb {
        position: relative;
        aspect-ratio: 3 / 4;
        overflow: hidden;
        border: 2px solid rgba(255, 255, 255, 0.14);
        border-radius: 8px;
        background: #0f1018;
        cursor: pointer;
        padding: 0;
      }

      #${CONFIG.MODAL_ID} .douyin-image-downloader-thumb.is-selected {
        border-color: #fe2c55;
        box-shadow: 0 0 0 2px rgba(254, 44, 85, 0.32);
      }

      #${CONFIG.MODAL_ID} .douyin-image-downloader-thumb img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
      }

      #${CONFIG.MODAL_ID} .douyin-image-downloader-index {
        position: absolute;
        top: 8px;
        left: 8px;
        min-width: 28px;
        height: 24px;
        padding: 0 8px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.62);
        color: #fff;
        font-size: 13px;
        font-weight: 700;
        line-height: 24px;
      }

      #${CONFIG.MODAL_ID} .douyin-image-downloader-check {
        position: absolute;
        right: 8px;
        top: 8px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.52);
        color: #fff;
        font-size: 16px;
        font-weight: 800;
        line-height: 24px;
        text-align: center;
        opacity: 0;
      }

      #${CONFIG.MODAL_ID} .douyin-image-downloader-thumb.is-selected .douyin-image-downloader-check {
        opacity: 1;
        background: #fe2c55;
      }

      #${CONFIG.MODAL_ID} .douyin-image-downloader-footer-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      #${CONFIG.MODAL_ID} .douyin-image-downloader-modal-button {
        min-width: 72px;
        height: 34px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
      }

      #${CONFIG.MODAL_ID} .douyin-image-downloader-modal-button:hover {
        background: rgba(255, 255, 255, 0.18);
      }

      #${CONFIG.MODAL_ID} .douyin-image-downloader-modal-button-primary {
        background: #fe2c55;
        border-color: #fe2c55;
      }

      #${CONFIG.MODAL_ID} .douyin-image-downloader-modal-button-primary:hover {
        background: #ff456e;
      }
    `;

      document.documentElement.appendChild(style);
    }

    controls.appendChild(downloadButton);
    controls.appendChild(selectButton);
    document.body.appendChild(controls);
    applySavedControlPosition(controls);
    makeControlsDraggable(controls);
  }

  function isVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function viewportScore(element) {
    const rect = element.getBoundingClientRect();
    const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    return width * height;
  }

  function isInViewport(element) {
    return viewportScore(element) >= CONFIG.MIN_VISIBLE_PANEL_AREA;
  }

  function getCurrentPanelCandidates(selector) {
    return Array.from(document.querySelectorAll(selector))
      .filter((panel) => isVisible(panel) && isInViewport(panel))
      .sort((a, b) => viewportScore(b) - viewportScore(a));
  }

  function hasSlideStructure(panel) {
    return Boolean(panel.querySelector(CONFIG.SLIDE_SELECTOR));
  }

  function hasMainImages(panel) {
    return extractImagesByMainSelector(panel).length > 0;
  }

  function hasFallbackImages(panel) {
    return hasSlideStructure(panel) && extractImagesByFallback(panel).length > 0;
  }

  function isUsableCurrentPanel(panel) {
    return Boolean(panel && isVisible(panel) && isInViewport(panel) && (hasMainImages(panel) || hasFallbackImages(panel)));
  }

  function findCurrentPanel() {
    const activePanel = document.activeElement?.closest?.(CONFIG.MAIN_PANEL_SELECTOR);
    if (isUsableCurrentPanel(activePanel)) return activePanel;

    const mainPanel = getCurrentPanelCandidates(CONFIG.MAIN_PANEL_SELECTOR).find(hasMainImages);
    if (mainPanel) return mainPanel;

    const fallbackPanel = getCurrentPanelCandidates(CONFIG.FALLBACK_PANEL_SELECTOR).find(hasFallbackImages);
    if (fallbackPanel) {
      return fallbackPanel;
    }

    return null;
  }

  function normalizeImageUrl(rawUrl) {
    if (!rawUrl) return "";

    try {
      return new URL(rawUrl, window.location.href).href;
    } catch (error) {
      log("Invalid image URL ignored:", rawUrl, error);
      return "";
    }
  }

  function looksLikeDouyinImage(url) {
    return IMAGE_URL_HINTS.every((hint) => url.includes(hint));
  }

  function pushUniqueImage(images, seenUrls, rawUrl) {
    const url = normalizeImageUrl(rawUrl);
    if (!url || seenUrls.has(url)) return;

    seenUrls.add(url);
    images.push(url);
  }

  function extractImagesByMainSelector(panel) {
    const images = [];
    const seenUrls = new Set();
    const slides = Array.from(panel.querySelectorAll(CONFIG.SLIDE_SELECTOR));

    slides.forEach((slide) => {
      const image = slide.querySelector(CONFIG.IMAGE_SELECTOR);
      if (image) pushUniqueImage(images, seenUrls, image.getAttribute("src"));
    });

    return images;
  }

  function extractImagesByFallback(panel) {
    const images = [];
    const seenUrls = new Set();
    const imageElements = Array.from(panel.querySelectorAll("img[src]"));

    imageElements.forEach((image) => {
      const url = normalizeImageUrl(image.getAttribute("src"));
      if (!url || seenUrls.has(url) || !looksLikeDouyinImage(url)) return;

      seenUrls.add(url);
      images.push(url);
    });

    return images;
  }

  function extractImageUrls() {
    const panel = findCurrentPanel();
    if (!panel) {
      log("No current visible image panel found.");
      return [];
    }

    const mainImages = extractImagesByMainSelector(panel);
    if (mainImages.length > 0) {
      log("Images found by main selector:", mainImages);
      return mainImages;
    }

    const fallbackImages = extractImagesByFallback(panel);
    log("Images found by fallback selector:", fallbackImages);
    return fallbackImages;
  }

  function extractAwemeId() {
    const pathnameMatch = window.location.pathname.match(/\/(?:video|note)\/(\d+)/);
    if (pathnameMatch?.[1]) return pathnameMatch[1];

    const searchParams = new URLSearchParams(window.location.search);
    const modalId = searchParams.get("modal_id");
    if (modalId && /^\d+$/.test(modalId)) return modalId;

    const textMatch = window.location.href.match(/(?:modal_id|aweme_id|item_id)=(\d+)/);
    if (textMatch?.[1]) return textMatch[1];

    return "";
  }

  function buildFilename(index, total) {
    const awemeId = extractAwemeId();
    const serialWidth = String(total).length;
    const serial = String(index + 1).padStart(serialWidth, "0");

    return awemeId
      ? `douyin_images/douyin_${awemeId}_${serial}.${CONFIG.DOWNLOAD_FORMAT}`
      : `douyin_images/douyin_image_${serial}.${CONFIG.DOWNLOAD_FORMAT}`;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Failed to read PNG blob."));
      reader.readAsDataURL(blob);
    });
  }

  async function imageUrlToPngBlob(url) {
    const response = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      cache: "force-cache",
    });

    if (!response.ok) {
      throw new Error(`Image fetch failed with status ${response.status}`);
    }

    const sourceBlob = await response.blob();
    const imageBitmap = await createImageBitmap(sourceBlob);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas 2D context is unavailable.");

      context.drawImage(imageBitmap, 0, 0);

      const pngBlob = await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
            return;
          }

          reject(new Error("PNG conversion failed."));
        }, "image/png");
      });

      return pngBlob;
    } finally {
      if (typeof imageBitmap.close === "function") {
        imageBitmap.close();
      }
    }
  }

  function fallbackDownloadBlob(blob, filename) {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename.split(/[\\/]/).pop() || filename;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  }

  function downloadPngImage(url, filename) {
    return new Promise((resolve) => {
      imageUrlToPngBlob(url)
        .then((pngBlob) => blobToDataUrl(pngBlob).then((dataUrl) => ({ pngBlob, dataUrl })))
        .then(({ pngBlob, dataUrl }) => {
          chrome.runtime.sendMessage(
            {
              type: "DOUYIN_IMAGE_DOWNLOAD",
              url: dataUrl,
              filename,
            },
            (response) => {
              const error = chrome.runtime.lastError;
              if (error) {
                fallbackDownloadBlob(pngBlob, filename);
                resolve({ ok: true, url, filename, fallback: true, error: error.message });
                return;
              }

              if (response?.ok) {
                resolve({ ok: true, url, filename });
                return;
              }

              fallbackDownloadBlob(pngBlob, filename);
              resolve({ ok: true, url, filename, fallback: true, error: response?.error });
            }
          );
        })
        .catch((error) => resolve({ ok: false, url, filename, error }));
    });
  }

  function createDownloadEntry(url, originalIndex, total) {
    return {
      url,
      originalIndex,
      total,
    };
  }

  async function downloadEntriesAsPng(entries, statusButtonId) {
    let failedCount = 0;

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const filename = buildFilename(entry.originalIndex, entry.total);

      setActionButtonText(statusButtonId, `转换 ${index + 1}/${entries.length}`);
      const result = await downloadPngImage(entry.url, filename);
      if (!result.ok) {
        failedCount += 1;
        log("Download failed:", result);
      }

      if (index < entries.length - 1) {
        await wait(CONFIG.DOWNLOAD_DELAY_MS);
      }
    }

    setActionButtonText(
      statusButtonId,
      failedCount > 0 ? `完成 ${entries.length - failedCount}/${entries.length}` : "完成",
      true
    );
  }

  function removeSelectionModal() {
    const modal = document.getElementById(CONFIG.MODAL_ID);
    if (modal) modal.remove();
  }

  function createModalButton(text, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `douyin-image-downloader-modal-button ${className || ""}`.trim();
    button.textContent = text;
    button.addEventListener("click", onClick);
    return button;
  }

  function showSelectionModal(urls) {
    removeSelectionModal();

    const selectedIndexes = new Set();
    const modal = document.createElement("div");
    modal.id = CONFIG.MODAL_ID;

    const dialog = document.createElement("div");
    dialog.className = "douyin-image-downloader-dialog";
    dialog.addEventListener("click", (event) => event.stopPropagation());

    const header = document.createElement("div");
    header.className = "douyin-image-downloader-header";

    const title = document.createElement("h2");
    title.className = "douyin-image-downloader-title";
    title.textContent = "选择图片";

    const count = document.createElement("span");
    count.className = "douyin-image-downloader-count";

    const grid = document.createElement("div");
    grid.className = "douyin-image-downloader-grid";

    const footer = document.createElement("div");
    footer.className = "douyin-image-downloader-footer";

    const footerActions = document.createElement("div");
    footerActions.className = "douyin-image-downloader-footer-actions";

    let downloadSelectedButton;

    function updateSelectionState() {
      count.textContent = `${selectedIndexes.size}/${urls.length}`;
      downloadSelectedButton.textContent = selectedIndexes.size > 0 ? `下载选中 ${selectedIndexes.size}` : "下载全部";
    }

    urls.forEach((url, index) => {
      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = "douyin-image-downloader-thumb";

      const image = document.createElement("img");
      image.src = url;
      image.alt = `图片 ${index + 1}`;
      image.loading = "lazy";

      const badge = document.createElement("span");
      badge.className = "douyin-image-downloader-index";
      badge.textContent = String(index + 1);

      const check = document.createElement("span");
      check.className = "douyin-image-downloader-check";
      check.textContent = "✓";

      thumb.appendChild(image);
      thumb.appendChild(badge);
      thumb.appendChild(check);
      thumb.addEventListener("click", () => {
        if (selectedIndexes.has(index)) {
          selectedIndexes.delete(index);
          thumb.classList.remove("is-selected");
        } else {
          selectedIndexes.add(index);
          thumb.classList.add("is-selected");
        }

        updateSelectionState();
      });

      grid.appendChild(thumb);
    });

    const selectAllButton = createModalButton("全选", "", () => {
      selectedIndexes.clear();
      urls.forEach((_url, index) => selectedIndexes.add(index));
      grid.querySelectorAll(".douyin-image-downloader-thumb").forEach((thumb) => thumb.classList.add("is-selected"));
      updateSelectionState();
    });

    const clearButton = createModalButton("清空", "", () => {
      selectedIndexes.clear();
      grid.querySelectorAll(".douyin-image-downloader-thumb").forEach((thumb) => thumb.classList.remove("is-selected"));
      updateSelectionState();
    });

    const cancelButton = createModalButton("取消", "", removeSelectionModal);

    downloadSelectedButton = createModalButton("下载全部", "douyin-image-downloader-modal-button-primary", async () => {
      const selectedList = selectedIndexes.size > 0
        ? Array.from(selectedIndexes).sort((a, b) => a - b)
        : urls.map((_url, index) => index);
      const entries = selectedList.map((index) => createDownloadEntry(urls[index], index, urls.length));

      removeSelectionModal();
      await startDownloadEntries(entries, CONFIG.SELECT_BUTTON_ID);
    });

    modal.addEventListener("click", removeSelectionModal);
    header.appendChild(title);
    header.appendChild(count);
    footerActions.appendChild(selectAllButton);
    footerActions.appendChild(clearButton);
    footerActions.appendChild(cancelButton);
    footerActions.appendChild(downloadSelectedButton);
    footer.appendChild(document.createElement("span"));
    footer.appendChild(footerActions);
    dialog.appendChild(header);
    dialog.appendChild(grid);
    dialog.appendChild(footer);
    modal.appendChild(dialog);
    document.body.appendChild(modal);

    updateSelectionState();
  }

  async function startDownloadEntries(entries, statusButtonId) {
    if (buttonState.downloading) return;

    buttonState.downloading = true;
    setControlsDisabled(true);

    try {
      await downloadEntriesAsPng(entries, statusButtonId);
    } catch (error) {
      log("Unexpected error:", error);
      setActionButtonText(statusButtonId, "下载失败", true);
    } finally {
      buttonState.downloading = false;
      setControlsDisabled(false);
    }
  }

  async function handleDownloadClick() {
    if (buttonState.downloading) return;

    try {
      setActionButtonText(CONFIG.BUTTON_ID, "提取中");
      const urls = extractImageUrls();

      if (urls.length === 0) {
        setActionButtonText(CONFIG.BUTTON_ID, "未找到图集", true);
        return;
      }

      const entries = urls.map((url, index) => createDownloadEntry(url, index, urls.length));
      await startDownloadEntries(entries, CONFIG.BUTTON_ID);
    } catch (error) {
      log("Unexpected error:", error);
      setActionButtonText(CONFIG.BUTTON_ID, "下载失败", true);
    }
  }

  function handleSelectDownloadClick() {
    if (buttonState.downloading) return;

    setActionButtonText(CONFIG.SELECT_BUTTON_ID, "提取中");
    const urls = extractImageUrls();

    if (urls.length === 0) {
      setActionButtonText(CONFIG.SELECT_BUTTON_ID, "未找到图集", true);
      return;
    }

    setActionButtonText(CONFIG.SELECT_BUTTON_ID, "选择下载", true);
    showSelectionModal(urls);
  }

  function boot() {
    if (!document.body) {
      window.setTimeout(boot, 200);
      return;
    }

    ensureResizeHandler();
    ensureButton();

    const observer = new MutationObserver(() => ensureButton());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  boot();
})();
