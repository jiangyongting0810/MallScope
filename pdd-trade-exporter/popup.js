const openPagesButton = document.getElementById("openPagesButton");
const refreshPagesButton = document.getElementById("refreshPagesButton");
const exportPromotionButton = document.getElementById("exportPromotionButton");
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
  },
  {
    id: "promotion",
    name: "\u63a8\u5e7f\u6570\u636e\u9875",
    prefix: "https://yingxiao.pinduoduo.com/goods/promotion/list"
  }
];

const SUPPORTED_URL_PREFIXES = PAGE_ORDER.map((page) => page.prefix);
const PAGE_BY_ID = new Map(PAGE_ORDER.map((page) => [page.id, page]));

const TEXT = {
  csvHeaders: [
    "\u6570\u636e\u65e5\u671f",
    "\u6210\u4ea4\u91d1\u989d",
    "\u6210\u4ea4\u8ba2\u5355\u6570",
    "\u5ba2\u5355\u4ef7",
    "\u8bbf\u5ba2\u4ef7\u503c",
    "\u6210\u4ea4\u8f6c\u5316\u7387",
    "\u5546\u54c1\u8bbf\u5ba2\u6570",
    "\u5546\u54c1\u6d4f\u89c8\u91cf",
    "\u6210\u4ea4\u8425\u9500\u82b1\u8d39(\u5143)",
    "\u5b9e\u9645\u51c0\u6295\u4ea7\u6bd4",
    "\u5e7f\u544a\u8d39\u7387"
  ],
  promotionCsvHeaders: [
    "\u6570\u636e\u65e5\u671f",
    "\u6210\u4ea4\u8425\u9500\u82b1\u8d39(\u5143)",
    "\u51c0\u4ea4\u6613\u989d(\u5143)",
    "\u5b9e\u9645\u6295\u4ea7\u6bd4",
    "\u6210\u4ea4\u7b14\u6570",
    "\u6bcf\u7b14\u51c0\u6210\u4ea4\u82b1\u8d39(\u5143)",
    "\u66dd\u5149\u91cf",
    "\u70b9\u51fb\u91cf",
    "\u70b9\u51fb\u8f6c\u5316\u7387"
  ],
  exportFilePrefix: "\u62fc\u591a\u591a\u6628\u65e5\u6570\u636e",
  promotionExportFilePrefix: "\u62fc\u591a\u591a\u63a8\u5e7f\u6628\u65e5\u6570\u636e",
  checkingTabs: "\u6b63\u5728\u68c0\u67e5\u5df2\u6253\u5f00\u7684\u6570\u636e\u9875...",
  requestingAllData: "\u6b63\u5728\u8bf7\u6c42\u4e09\u4e2a\u9875\u9762\u7684\u91c7\u96c6\u6570\u636e...",
  requestingPromotionData: "\u6b63\u5728\u8bf7\u6c42\u63a8\u5e7f\u9875\u91c7\u96c6\u6570\u636e...",
  openingPages: "\u6b63\u5728\u6253\u5f00\u4e09\u4e2a\u6570\u636e\u9875...",
  refreshingPages: "\u6b63\u5728\u5237\u65b0\u4e09\u4e2a\u6570\u636e\u9875...",
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
  openAllPages: "\u8bf7\u540c\u65f6\u6253\u5f00\u4ea4\u6613\u6570\u636e\u9875\u3001\u5546\u54c1\u6570\u636e\u9875\u548c\u63a8\u5e7f\u6570\u636e\u9875\uff0c\u5e76\u5404\u81ea\u5237\u65b0\u4e00\u6b21\u540e\u518d\u5bfc\u51fa\u3002",
  missingTradePage: "\u672a\u627e\u5230\u5df2\u6253\u5f00\u7684\u4ea4\u6613\u6570\u636e\u9875\u6807\u7b7e\u9875\u3002",
  missingGoodsPage: "\u672a\u627e\u5230\u5df2\u6253\u5f00\u7684\u5546\u54c1\u6570\u636e\u9875\u6807\u7b7e\u9875\u3002",
  missingPromotionPage: "\u672a\u627e\u5230\u5df2\u6253\u5f00\u7684\u63a8\u5e7f\u6570\u636e\u9875\u6807\u7b7e\u9875\u3002",
  tradeSummary: "\u4ea4\u6613\u9875\u6982\u8981",
  goodsSummary: "\u5546\u54c1\u9875\u6982\u8981",
  promotionSummary: "\u63a8\u5e7f\u9875\u6982\u8981",
  pagesOpened: "\u4e09\u4e2a\u9875\u9762\u5df2\u6253\u5f00\u3002",
  pagesRefreshed: "\u4e09\u4e2a\u9875\u9762\u5df2\u53d1\u8d77\u5237\u65b0\u3002",
  promotionScriptOutdated: "\u63a8\u5e7f\u9875\u4ecd\u5728\u4f7f\u7528\u65e7\u91c7\u96c6\u811a\u672c\uff0c\u8bf7\u70b9\u51fb\u201c\u5237\u65b0\u4e09\u4e2a\u9875\u9762\u201d\u540e\u91cd\u65b0\u5bfc\u51fa\u3002"
};

function setStatus(message) {
  statusNode.textContent = message;
}

function setButtonsDisabled(disabled) {
  openPagesButton.disabled = disabled;
  refreshPagesButton.disabled = disabled;
  exportPromotionButton.disabled = disabled;
  exportButton.disabled = disabled;
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

function parseNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(/,/g, "").replace(/%$/, "");
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatAdRate(marketingSpendRaw, payAmountRaw) {
  const marketingSpend = parseNumber(marketingSpendRaw);
  const payAmount = parseNumber(payAmountRaw);
  if (marketingSpend === null || payAmount === null || payAmount === 0) {
    return "";
  }

  return `${((marketingSpend / payAmount) * 100).toFixed(2)}%`;
}

function buildMetricRows(payloads) {
  const rows = [TEXT.csvHeaders];
  const tradePayload = payloads.find((payload) => payload.debug?.configId === "trade") || null;
  const goodsPayload = payloads.find((payload) => payload.debug?.configId === "goods") || null;
  const promotionPayload = payloads.find((payload) => payload.debug?.configId === "promotion") || null;
  const baseCapturedAt = tradePayload?.capturedAt || goodsPayload?.capturedAt || "";
  const payAmountRaw = tradePayload?.metrics?.payAmount?.raw || "";
  const marketingSpendRaw = promotionPayload?.metrics?.marketingSpend?.raw || "";

  rows.push([
    formatDataDate(baseCapturedAt),
    payAmountRaw,
    tradePayload?.metrics?.payOrderCount?.raw || "",
    tradePayload?.metrics?.customerUnitPrice?.raw || "",
    tradePayload?.metrics?.visitorValue?.raw || "",
    tradePayload?.metrics?.conversionRate?.raw || "",
    goodsPayload?.metrics?.visitorCount?.raw || "",
    goodsPayload?.metrics?.goodsViewCount?.raw || "",
    marketingSpendRaw,
    promotionPayload?.metrics?.netRoi?.raw || "",
    formatAdRate(marketingSpendRaw, payAmountRaw)
  ]);

  return rows;
}

function buildPromotionRows(promotionPayload) {
  const marketingSpendRaw = promotionPayload?.metrics?.marketingSpend?.raw || "";
  const netGmvRaw = promotionPayload?.metrics?.netGmv?.raw || "";
  const actualRoiRaw = promotionPayload?.metrics?.actualRoi?.raw || "";
  const orderCountRaw = promotionPayload?.metrics?.orderCount?.raw || "";
  const netCostPerOrderRaw = promotionPayload?.metrics?.netCostPerOrder?.raw || "";
  const impressionRaw = promotionPayload?.metrics?.impression?.raw || "";
  const clickRaw = promotionPayload?.metrics?.click?.raw || "";
  const clickConversionRateRaw = promotionPayload?.metrics?.clickConversionRate?.raw || "";

  return [
    TEXT.promotionCsvHeaders,
    [
      formatDataDate(promotionPayload?.capturedAt || ""),
      marketingSpendRaw,
      netGmvRaw,
      actualRoiRaw,
      orderCountRaw,
      netCostPerOrderRaw,
      impressionRaw,
      clickRaw,
      clickConversionRateRaw
    ]
  ];
}

function validatePromotionExportPayload(promotionPayload) {
  const requiredMetricKeys = [
    "marketingSpend",
    "netGmv",
    "actualRoi",
    "orderCount",
    "netCostPerOrder",
    "impression",
    "click",
    "clickConversionRate"
  ];
  const missingMetrics = requiredMetricKeys.filter((key) => !promotionPayload?.metrics?.[key]);
  if (missingMetrics.length > 0) {
    throw new Error(TEXT.promotionScriptOutdated);
  }
}

function downloadCsv(rows, filePrefix, capturedAt) {
  const blob = new Blob(["\uFEFF" + createCsv(rows)], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const stamp = (capturedAt || new Date().toISOString())
    .replace(/[:T]/g, "-")
    .replace(/\..+$/, "");

  chrome.downloads.download({
    url,
    filename: `${filePrefix}-${stamp}.csv`,
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
  return tabs.filter((tab) => Number.isInteger(tab.id) && tab.url && isSupportedPage(tab.url));
}

async function getPageTabs() {
  return pickTabsByPage(await getSupportedTabs());
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function pickTabsByPage(tabs) {
  const pageTabs = new Map();

  for (const page of PAGE_ORDER) {
    const matchedTab = tabs.find((tab) => tab.url?.startsWith(page.prefix)) || null;
    pageTabs.set(page.id, matchedTab);
  }

  return pageTabs;
}

function assertPagesOpen(pageTabs, pages = PAGE_ORDER) {
  if (pages === PAGE_ORDER && pages.every((page) => !pageTabs.get(page.id))) {
    throw new Error(TEXT.openAllPages);
  }

  const missingPageMessages = {
    trade: TEXT.missingTradePage,
    goods: TEXT.missingGoodsPage,
    promotion: TEXT.missingPromotionPage
  };

  for (const page of pages) {
    if (!pageTabs.get(page.id)) {
      throw new Error(missingPageMessages[page.id]);
    }
  }
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
  const pageTabs = await getPageTabs();
  assertPagesOpen(pageTabs);

  const payloads = [];
  for (const page of PAGE_ORDER) {
    payloads.push(await extractFromTab(pageTabs.get(page.id), page));
  }

  return payloads;
}

async function openAllPages() {
  const pageTabs = await getPageTabs();
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeIndex = activeTabs[0]?.index ?? 0;
  let insertIndex = activeIndex + 1;

  for (const page of PAGE_ORDER) {
    if (pageTabs.get(page.id)) {
      continue;
    }

    const createdTab = await chrome.tabs.create({
      url: page.prefix,
      active: false,
      index: insertIndex
    });
    pageTabs.set(page.id, createdTab);
    insertIndex += 1;
  }
}

async function refreshAllPages() {
  const pageTabs = await getPageTabs();
  assertPagesOpen(pageTabs);

  await Promise.all(
    PAGE_ORDER.map((page) => chrome.tabs.reload(pageTabs.get(page.id).id))
  );
}

async function handleOpenPages() {
  setButtonsDisabled(true);
  setStatus(TEXT.openingPages);

  try {
    await openAllPages();
    setStatus(TEXT.pagesOpened);
  } catch (error) {
    setStatus(`${TEXT.failed}\n${error.message}`);
  } finally {
    setButtonsDisabled(false);
  }
}

async function handleRefreshPages() {
  setButtonsDisabled(true);
  setStatus(TEXT.refreshingPages);

  try {
    await refreshAllPages();
    await wait(800);
    setStatus(TEXT.pagesRefreshed);
  } catch (error) {
    setStatus(`${TEXT.failed}\n${error.message}`);
  } finally {
    setButtonsDisabled(false);
  }
}

async function handleExport() {
  setButtonsDisabled(true);
  setStatus(TEXT.checkingTabs);

  try {
    setStatus(TEXT.requestingAllData);
    const payloads = await collectAllPageData();
    const statusLines = [TEXT.success];

    for (const payload of payloads) {
      const summaryLabel = {
        trade: TEXT.tradeSummary,
        goods: TEXT.goodsSummary,
        promotion: TEXT.promotionSummary
      }[payload.debug?.configId] || payload.pageName;
      statusLines.push(summaryLabel);
      statusLines.push(formatMetricSummary(payload));
      statusLines.push(...formatSuccessDebug(payload));
    }

    setStatus(statusLines.join("\n"));
    const latestPayload = [...payloads]
      .sort((left, right) => left.capturedAt.localeCompare(right.capturedAt))
      .at(-1);
    downloadCsv(buildMetricRows(payloads), TEXT.exportFilePrefix, latestPayload?.capturedAt || "");
  } catch (error) {
    setStatus(`${TEXT.failed}\n${error.message}`);
  } finally {
    setButtonsDisabled(false);
  }
}

async function handlePromotionExport() {
  setButtonsDisabled(true);
  setStatus(TEXT.requestingPromotionData);

  try {
    const pageTabs = await getPageTabs();
    const promotionPage = PAGE_BY_ID.get("promotion");
    assertPagesOpen(pageTabs, [promotionPage]);
    const promotionPayload = await extractFromTab(pageTabs.get("promotion"), promotionPage);
    validatePromotionExportPayload(promotionPayload);

    const statusLines = [
      TEXT.success,
      TEXT.promotionSummary,
      formatMetricSummary(promotionPayload),
      ...formatSuccessDebug(promotionPayload)
    ];
    setStatus(statusLines.join("\n"));
    downloadCsv(
      buildPromotionRows(promotionPayload),
      TEXT.promotionExportFilePrefix,
      promotionPayload?.capturedAt || ""
    );
  } catch (error) {
    setStatus(`${TEXT.failed}\n${error.message}`);
  } finally {
    setButtonsDisabled(false);
  }
}

openPagesButton.addEventListener("click", handleOpenPages);
refreshPagesButton.addEventListener("click", handleRefreshPages);
exportPromotionButton.addEventListener("click", handlePromotionExport);
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
