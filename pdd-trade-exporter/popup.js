const exportButton = document.getElementById("exportButton");
const statusNode = document.getElementById("status");

const EXPECTED_URL_PREFIX = "https://mms.pinduoduo.com/sycm/stores_data/operation";
const TEXT = {
  csvHeaders: ["\u91c7\u96c6\u65f6\u95f4", "\u9875\u9762\u5730\u5740", "\u6210\u4ea4\u91d1\u989d", "\u6210\u4ea4\u8ba2\u5355\u6570"],
  exportFilePrefix: "\u62fc\u591a\u591a\u4ea4\u6613\u6570\u636e",
  checkingTab: "\u68c0\u67e5\u5f53\u524d\u6807\u7b7e\u9875...",
  cannotReadTab: "\u65e0\u6cd5\u8bfb\u53d6\u5f53\u524d\u6807\u7b7e\u9875\u3002",
  wrongPage: "\u5f53\u524d\u9875\u9762\u4e0d\u662f\u62fc\u591a\u591a\u4ea4\u6613\u6570\u636e\u9875\u3002",
  requestingData: "\u8bf7\u6c42\u9875\u9762\u91c7\u96c6\u6570\u636e...",
  noContentResponse: "\u5185\u5bb9\u811a\u672c\u6ca1\u6709\u8fd4\u56de\u7ed3\u679c\u3002",
  extractionFailed: "\u91c7\u96c6\u5931\u8d25\u3002",
  success: "\u91c7\u96c6\u6210\u529f\uff0c\u51c6\u5907\u5bfc\u51fa\u3002",
  payAmount: "\u6210\u4ea4\u91d1\u989d",
  payOrderCount: "\u6210\u4ea4\u8ba2\u5355\u6570",
  sourceHour: "\u6765\u6e90\u5c0f\u65f6",
  failed: "\u5931\u8d25",
  ready: "\u5df2\u5c31\u7eea",
  hookInjected: "\u5df2\u5b89\u88c5\u94a9\u5b50",
  messagesSeen: "\u6536\u5230\u6d88\u606f\u6570",
  targetMessagesSeen: "\u547d\u4e2d\u76ee\u6807\u63a5\u53e3\u6570",
  hasSnapshot: "\u5df2\u6709\u5feb\u7167",
  lastUrls: "\u6700\u8fd1 URL"
};

function setStatus(message) {
  statusNode.textContent = message;
}

function createCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, "\"\"")}"`)
        .join(",")
    )
    .join("\r\n");
}

function downloadCsv(payload) {
  const rows = [
    TEXT.csvHeaders,
    [
      payload.capturedAt,
      payload.pageUrl,
      payload.metrics.payAmount.raw,
      payload.metrics.payOrderCount.raw
    ]
  ];

  const blob = new Blob(["\uFEFF" + createCsv(rows)], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const stamp = payload.capturedAt.replace(/[:T]/g, "-").replace(/\..+$/, "");

  chrome.downloads.download({
    url,
    filename: `${TEXT.exportFilePrefix}-${stamp}.csv`,
    saveAs: true
  }, () => {
    URL.revokeObjectURL(url);
  });
}

function sendExtractRequest(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: "extract-trade-data" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

function sendDebugRequest(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: "get-debug-state" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

async function handleExport() {
  exportButton.disabled = true;
  setStatus(TEXT.checkingTab);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      throw new Error(TEXT.cannotReadTab);
    }

    if (!tab.url.startsWith(EXPECTED_URL_PREFIX)) {
      throw new Error(TEXT.wrongPage);
    }

    setStatus(TEXT.requestingData);
    const response = await sendExtractRequest(tab.id);

    if (!response) {
      throw new Error(TEXT.noContentResponse);
    }

    if (!response.ok) {
      const debugLines = response.debug
        ? [
            "",
            `${TEXT.hookInjected}: ${response.debug.hookInjected}`,
            `${TEXT.messagesSeen}: ${response.debug.messagesSeen}`,
            `${TEXT.targetMessagesSeen}: ${response.debug.targetMessagesSeen}`,
            `${TEXT.hasSnapshot}: ${response.debug.hasSnapshot}`,
            `${TEXT.lastUrls}: ${(response.debug.lastUrls || []).join(" | ")}`
          ]
        : [];
      throw new Error(`${response.error || TEXT.extractionFailed}${debugLines.join("\n")}`);
    }

    setStatus(
      [
        TEXT.success,
        `${TEXT.payAmount}: ${response.data.metrics.payAmount.raw}`,
        `${TEXT.payOrderCount}: ${response.data.metrics.payOrderCount.raw}`,
        `${TEXT.sourceHour}: ${response.data.debug?.hr ?? "unknown"}`
      ].join("\n")
    );

    downloadCsv(response.data);
  } catch (error) {
    setStatus(`${TEXT.failed}\n${error.message}`);
  } finally {
    exportButton.disabled = false;
  }
}

exportButton.addEventListener("click", handleExport);

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !tab.url.startsWith(EXPECTED_URL_PREFIX)) {
      return;
    }

    const response = await sendDebugRequest(tab.id);
    if (!response?.ok) {
      return;
    }

    setStatus(
      [
        TEXT.ready,
        `${TEXT.hookInjected}: ${response.debug.hookInjected}`,
        `${TEXT.messagesSeen}: ${response.debug.messagesSeen}`,
        `${TEXT.targetMessagesSeen}: ${response.debug.targetMessagesSeen}`,
        `${TEXT.hasSnapshot}: ${response.debug.hasSnapshot}`
      ].join("\n")
    );
  } catch (_error) {
    // Keep the default status when debug probing fails.
  }
});
