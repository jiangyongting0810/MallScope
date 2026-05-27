const exportButton = document.getElementById("exportButton");
const statusNode = document.getElementById("status");

const PAGE_ORDER = [
  {
    id: "trade",
    name: "\u4ea4\u6613\u6570\u636e\u9875",
    prefix: "https://mms.pinduoduo.com/sycm/stores_data/operation"
  },
  {
    id: "goods",
    name: "\u5546\u54c1\u6570\u636e\u9875",
    prefix: "https://mms.pinduoduo.com/sycm/goods_effect"
  }
];

const SUPPORTED_URL_PREFIXES = PAGE_ORDER.map((page) => page.prefix);

const TEXT = {
  csvHeaders: [
    "\u6570\u636e\u65e5\u671f",
    "\u6210\u4ea4\u91d1\u989d",
    "\u6210\u4ea4\u8ba2\u5355\u6570",
    "\u5ba2\u5355\u4ef7",
    "\u8bbf\u5ba2\u4ef7\u503c",
    "\u6210\u4ea4\u8f6c\u5316\u7387",
    "\u5546\u54c1\u8bbf\u5ba2\u6570",
    "\u5546\u54c1\u6d4f\u89c8\u91cf"
  ],
  exportFilePrefix: "\u62fc\u591a\u591a\u6628\u65e5\u6570\u636e",
  checkingTabs: "\u6b63\u5728\u68c0\u67e5\u5df2\u6253\u5f00\u7684\u6570\u636e\u9875...",
  requestingAllData: "\u6b63\u5728\u8bf7\u6c42\u4e24\u4e2a\u9875\u9762\u7684\u91c7\u96c6\u6570\u636e...",
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
  currentPage: "\u5f53\u524d\u9875\u9762",
  openBothPages: "\u8bf7\u540c\u65f6\u6253\u5f00\u4ea4\u6613\u6570\u636e\u9875\u548c\u5546\u54c1\u6570\u636e\u9875\uff0c\u5e76\u5404\u81ea\u5237\u65b0\u4e00\u6b21\u540e\u518d\u5bfc\u51fa\u3002",
  missingTradePage: "\u672a\u627e\u5230\u5df2\u6253\u5f00\u7684\u4ea4\u6613\u6570\u636e\u9875\u6807\u7b7e\u9875\u3002",
  missingGoodsPage: "\u672a\u627e\u5230\u5df2\u6253\u5f00\u7684\u5546\u54c1\u6570\u636e\u9875\u6807\u7b7e\u9875\u3002",
  tradeSummary: "\u4ea4\u6613\u9875\u6982\u8981",
  goodsSummary: "\u5546\u54c1\u9875\u6982\u8981"
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

function formatDataDate(capturedAt) {
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setDate(date.getDate() - 1);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

function buildMetricRows(payloads) {
  const rows = [TEXT.csvHeaders];
  const tradePayload = payloads.find((payload) => payload.debug?.configId === "trade") || null;
  const goodsPayload = payloads.find((payload) => payload.debug?.configId === "goods") || null;
  const baseCapturedAt = tradePayload?.capturedAt || goodsPayload?.capturedAt || "";

  rows.push([
    formatDataDate(baseCapturedAt),
    tradePayload?.metrics?.payAmount?.raw || "",
    tradePayload?.metrics?.payOrderCount?.raw || "",
    tradePayload?.metrics?.customerUnitPrice?.raw || "",
    tradePayload?.metrics?.visitorValue?.raw || "",
    tradePayload?.metrics?.conversionRate?.raw || "",
    goodsPayload?.metrics?.visitorCount?.raw || "",
    goodsPayload?.metrics?.goodsViewCount?.raw || ""
  ]);

  return rows;
}

function downloadCsv(payloads) {
  const rows = buildMetricRows(payloads);
  const blob = new Blob(["\uFEFF" + createCsv(rows)], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const latestPayload = [...payloads]
    .sort((left, right) => left.capturedAt.localeCompare(right.capturedAt))
    .at(-1);
  const stamp = (latestPayload?.capturedAt || new Date().toISOString())
    .replace(/[:T]/g, "-")
    .replace(/\..+$/, "");

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
  if (visitorDebug) {
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
      "\u8bbf\u5ba2\u4ef7\u503c\u8c03\u8bd5\uff1a",
      `\u63a5\u53e3\u539f\u503c: ${visitorDebug.overviewField ?? TEXT.unknown}`,
      `\u63a5\u53e3\u89e3\u7801: ${visitorDebug.overviewDecoded ?? TEXT.unknown}`,
      `\u9875\u9762\u515c\u5e95: ${visitorDebug.domDecoded ?? TEXT.unknown}`
    ];
  }

  if (data?.debug?.configId === "goods") {
    const resolvedFields = data.debug.resolvedFields || {};
    return [
      "",
      "\u5546\u54c1\u9875\u8c03\u8bd5\uff1a",
      `\u5546\u54c1\u8bbf\u5ba2\u6570\u5b57\u6bb5: ${resolvedFields.visitorCount ?? TEXT.unknown}`,
      `\u5546\u54c1\u6d4f\u89c8\u91cf\u5b57\u6bb5: ${resolvedFields.goodsViewCount ?? TEXT.unknown}`,
      `\u8fd4\u56de\u5b57\u6bb5: ${(data.debug.rawKeys || []).join(", ") || TEXT.unknown}`
    ];
  }

  return [];
}

function formatMetricSummary(payload) {
  return Object.values(payload.metrics)
    .map((metric) => `${metric.label}: ${metric.raw}`)
    .join("\n");
}

async function getSupportedTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs.filter((tab) => tab.id && tab.url && isSupportedPage(tab.url));
}

function pickTabsByPage(tabs) {
  const pageTabs = new Map();

  for (const page of PAGE_ORDER) {
    const matchedTab = tabs.find((tab) => tab.url?.startsWith(page.prefix)) || null;
    pageTabs.set(page.id, matchedTab);
  }

  return pageTabs;
}

async function extractFromTab(tab, page) {
  const response = await sendMessage(tab.id, "extract-trade-data");
  if (!response) {
    throw new Error(`${page.name}: ${TEXT.noContentResponse}`);
  }

  if (!response.ok) {
    throw new Error(`${page.name}: ${response.error || TEXT.extractionFailed}${formatDebugLines(response.debug).join("\n")}`);
  }

  return response.data;
}

async function collectAllPageData() {
  const supportedTabs = await getSupportedTabs();
  const pageTabs = pickTabsByPage(supportedTabs);

  if (!pageTabs.get("trade") && !pageTabs.get("goods")) {
    throw new Error(TEXT.openBothPages);
  }

  if (!pageTabs.get("trade")) {
    throw new Error(TEXT.missingTradePage);
  }

  if (!pageTabs.get("goods")) {
    throw new Error(TEXT.missingGoodsPage);
  }

  const payloads = [];
  for (const page of PAGE_ORDER) {
    payloads.push(await extractFromTab(pageTabs.get(page.id), page));
  }

  return payloads;
}

async function handleExport() {
  exportButton.disabled = true;
  setStatus(TEXT.checkingTabs);

  try {
    setStatus(TEXT.requestingAllData);
    const payloads = await collectAllPageData();
    const statusLines = [TEXT.success];

    for (const payload of payloads) {
      statusLines.push(payload.debug?.configId === "trade" ? TEXT.tradeSummary : TEXT.goodsSummary);
      statusLines.push(formatMetricSummary(payload));
      statusLines.push(...formatSuccessDebug(payload));
    }

    setStatus(statusLines.join("\n"));
    downloadCsv(payloads);
  } catch (error) {
    setStatus(`${TEXT.failed}\n${error.message}`);
  } finally {
    exportButton.disabled = false;
  }
}

exportButton.addEventListener("click", handleExport);

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const supportedTabs = await getSupportedTabs();
    if (supportedTabs.length === 0) {
      return;
    }

    const pageTabs = pickTabsByPage(supportedTabs);
    const statusLines = [TEXT.ready];

    for (const page of PAGE_ORDER) {
      const tab = pageTabs.get(page.id);
      if (!tab?.id) {
        statusLines.push(`${page.name}: ${TEXT.unknown}`);
        continue;
      }

      const response = await sendMessage(tab.id, "get-debug-state");
      if (!response?.ok) {
        statusLines.push(`${page.name}: ${TEXT.failed}`);
        continue;
      }

      statusLines.push(`${page.name}: ${response.debug.currentPage ?? TEXT.unknown}`);
      statusLines.push(`${TEXT.targetMessagesSeen}: ${response.debug.targetMessagesSeen}`);
      statusLines.push(`${TEXT.snapshotPages}: ${(response.debug.snapshotPages || []).join(" | ")}`);
    }

    setStatus(statusLines.join("\n"));
  } catch (_error) {
    // Keep the default status when debug probing fails.
  }
});
