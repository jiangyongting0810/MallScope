const exportButton = document.getElementById("exportButton");
const statusNode = document.getElementById("status");

const SUPPORTED_URL_PREFIXES = [
  "https://mms.pinduoduo.com/sycm/stores_data/operation",
  "https://mms.pinduoduo.com/sycm/goods_effect"
];

const TEXT = {
  csvHeaders: [
    "\u91c7\u96c6\u65f6\u95f4",
    "\u9875\u9762\u540d\u79f0",
    "\u9875\u9762\u5730\u5740",
    "\u6307\u6807\u6807\u7b7e",
    "\u6307\u6807\u503c"
  ],
  exportFilePrefix: "\u62fc\u591a\u591a\u6628\u65e5\u6570\u636e",
  checkingTab: "\u6b63\u5728\u68c0\u67e5\u5f53\u524d\u6807\u7b7e\u9875...",
  cannotReadTab: "\u65e0\u6cd5\u8bfb\u53d6\u5f53\u524d\u6807\u7b7e\u9875\u3002",
  wrongPage: "\u5f53\u524d\u9875\u9762\u4e0d\u662f\u5df2\u652f\u6301\u7684\u6570\u636e\u9875\u9762\u3002",
  requestingData: "\u6b63\u5728\u8bf7\u6c42\u9875\u9762\u91c7\u96c6\u6570\u636e...",
  noContentResponse: "\u5185\u5bb9\u811a\u672c\u6ca1\u6709\u8fd4\u56de\u7ed3\u679c\u3002",
  extractionFailed: "\u91c7\u96c6\u5931\u8d25\u3002",
  success: "\u91c7\u96c6\u6210\u529f\uff0c\u6b63\u5728\u51c6\u5907\u5bfc\u51fa\u3002",
  failed: "\u5931\u8d25",
  ready: "\u5df2\u5c31\u7eea",
  unknown: "\u672a\u77e5",
  hookInjected: "\u5df2\u5b89\u88c5\u94a9\u5b50",
  messagesSeen: "\u6536\u5230\u6d88\u606f\u6570",
  targetMessagesSeen: "\u547d\u4e2d\u76ee\u6807\u63a5\u53e3\u6570",
  snapshotPages: "\u5df2\u6355\u83b7\u9875\u9762",
  currentPage: "\u5f53\u524d\u9875\u9762"
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

function buildMetricRows(payload) {
  const rows = [TEXT.csvHeaders];
  for (const metric of Object.values(payload.metrics)) {
    rows.push([
      payload.capturedAt,
      payload.pageName,
      payload.pageUrl,
      metric.label,
      metric.raw
    ]);
  }

  return rows;
}

function downloadCsv(payload) {
  const rows = buildMetricRows(payload);
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

function sendMessage(tabId, type) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

function isSupportedPage(url) {
  return SUPPORTED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function formatDebugLines(debug) {
  if (!debug) {
    return [];
  }

  return [
    "",
    `${TEXT.currentPage}: ${debug.currentPage ?? TEXT.unknown}`,
    `${TEXT.hookInjected}: ${debug.hookInjected}`,
    `${TEXT.messagesSeen}: ${debug.messagesSeen}`,
    `${TEXT.targetMessagesSeen}: ${debug.targetMessagesSeen}`,
    `${TEXT.snapshotPages}: ${(debug.snapshotPages || []).join(" | ")}`
  ];
}

function formatSuccessDebug(data) {
  const visitorDebug = data?.debug?.visitorValue;
  if (!visitorDebug) {
    return [];
  }

  if (visitorDebug.calculatedValue !== null && visitorDebug.calculatedValue !== undefined) {
    return [
      "",
      "\u8bbf\u5ba2\u4ef7\u503c\u8c03\u8bd5\uff1a",
      `\u8ba1\u7b97\u8bbf\u5ba2\u6570: ${visitorDebug.calculatedVisitorCount ?? TEXT.unknown}`,
      `\u8ba1\u7b97\u7ed3\u679c: ${Number(visitorDebug.calculatedValue).toFixed(2)}`
    ];
  }

  return [
    "",
    "访客价值调试：",
    `接口原值: ${visitorDebug.overviewField ?? TEXT.unknown}`,
    `接口解码: ${visitorDebug.overviewDecoded ?? TEXT.unknown}`,
    `页面兜底: ${visitorDebug.domDecoded ?? TEXT.unknown}`
  ];
}

async function handleExport() {
  exportButton.disabled = true;
  setStatus(TEXT.checkingTab);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      throw new Error(TEXT.cannotReadTab);
    }

    if (!isSupportedPage(tab.url)) {
      throw new Error(TEXT.wrongPage);
    }

    setStatus(TEXT.requestingData);
    const response = await sendMessage(tab.id, "extract-trade-data");

    if (!response) {
      throw new Error(TEXT.noContentResponse);
    }

    if (!response.ok) {
      throw new Error(`${response.error || TEXT.extractionFailed}${formatDebugLines(response.debug).join("\n")}`);
    }

    const metricSummary = Object.values(response.data.metrics)
      .map((metric) => `${metric.label}: ${metric.raw}`)
      .join("\n");

    setStatus([TEXT.success, response.data.pageName, metricSummary, ...formatSuccessDebug(response.data)].join("\n"));
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
    if (!tab?.id || !tab.url || !isSupportedPage(tab.url)) {
      return;
    }

    const response = await sendMessage(tab.id, "get-debug-state");
    if (!response?.ok) {
      return;
    }

    setStatus(
      [
        TEXT.ready,
        `${TEXT.currentPage}: ${response.debug.currentPage ?? TEXT.unknown}`,
        `${TEXT.hookInjected}: ${response.debug.hookInjected}`,
        `${TEXT.messagesSeen}: ${response.debug.messagesSeen}`,
        `${TEXT.targetMessagesSeen}: ${response.debug.targetMessagesSeen}`,
        `${TEXT.snapshotPages}: ${(response.debug.snapshotPages || []).join(" | ")}`
      ].join("\n")
    );
  } catch (_error) {
    // Keep the default status when debug probing fails.
  }
});
