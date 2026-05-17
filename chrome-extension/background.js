"use strict";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "DOUYIN_IMAGE_DOWNLOAD") {
    return false;
  }

  chrome.downloads.download(
    {
      url: message.url,
      filename: message.filename,
      saveAs: false,
      conflictAction: "uniquify",
    },
    (downloadId) => {
      const error = chrome.runtime.lastError;
      if (error) {
        sendResponse({ ok: false, error: error.message });
        return;
      }

      sendResponse({ ok: true, downloadId });
    }
  );

  return true;
});
