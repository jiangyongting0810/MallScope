const PAGE_MESSAGE_TYPE = "PDD_TRADE_EXPORTER_DATA";
const TARGET_API_PATH = "/api/mallTrade/queryMallTradeList";

let latestTradeSnapshot = null;
const debugState = {
  hookInjected: true,
  messagesSeen: 0,
  targetMessagesSeen: 0,
  lastUrls: []
};

function isValidMetricValue(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function selectLatestTradeEntry(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return null;
  }

  const validEntries = entries.filter((entry) => isValidMetricValue(entry?.payOrdrAmt));
  if (validEntries.length === 0) {
    return null;
  }

  validEntries.sort((left, right) => {
    const leftHour = Number(left?.hr ?? -1);
    const rightHour = Number(right?.hr ?? -1);
    return leftHour - rightHour;
  });

  return validEntries[validEntries.length - 1];
}

function normalizeMetric(value) {
  return {
    raw: value.toFixed(2),
    value
  };
}

function normalizeCountMetric(value) {
  return {
    raw: String(value),
    value
  };
}

function storeTradeSnapshot(detail) {
  debugState.messagesSeen += 1;
  debugState.lastUrls.unshift(detail?.url || "unknown");
  debugState.lastUrls = debugState.lastUrls.slice(0, 8);

  if (!detail?.url?.includes(TARGET_API_PATH)) {
    return;
  }
  debugState.targetMessagesSeen += 1;

  const result = detail.payload?.result;
  const latestTodayEntry = selectLatestTradeEntry(result?.todayRtList);
  if (!latestTodayEntry) {
    return;
  }

  latestTradeSnapshot = {
    source: detail.source,
    requestUrl: detail.url,
    capturedAt: detail.capturedAt,
    metrics: {
      payAmount: normalizeMetric(latestTodayEntry.payOrdrAmt),
      payOrderCount: normalizeCountMetric(latestTodayEntry.payOrdrCnt ?? 0)
    },
    rawEntry: latestTodayEntry
  };
}

function getDebugData() {
  return {
    ...debugState,
    hasSnapshot: Boolean(latestTradeSnapshot),
    snapshotUrl: latestTradeSnapshot?.requestUrl || null
  };
}

function validatePage() {
  if (!location.href.startsWith("https://mms.pinduoduo.com/sycm/stores_data/operation")) {
    throw new Error("\u5f53\u524d\u9875\u9762 URL \u4e0d\u7b26\u5408\u9884\u671f\u3002");
  }
}

function extractTradeData() {
  validatePage();
  if (!latestTradeSnapshot) {
    throw new Error("\u8fd8\u6ca1\u6709\u6355\u83b7\u5230\u4ea4\u6613\u63a5\u53e3\u54cd\u5e94\uff0c\u8bf7\u5148\u5237\u65b0\u9875\u9762\u518d\u5bfc\u51fa\u3002");
  }

  return {
    capturedAt: latestTradeSnapshot.capturedAt || new Date().toISOString(),
    pageUrl: location.href,
    metrics: {
      payAmount: latestTradeSnapshot.metrics.payAmount,
      payOrderCount: latestTradeSnapshot.metrics.payOrderCount
    },
    debug: {
      source: latestTradeSnapshot.source,
      requestUrl: latestTradeSnapshot.requestUrl,
      hr: latestTradeSnapshot.rawEntry.hr
    }
  };
}

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }

  if (event.data?.type !== PAGE_MESSAGE_TYPE) {
    return;
  }

  storeTradeSnapshot(event.data.detail);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "get-debug-state") {
    sendResponse({ ok: true, debug: getDebugData() });
    return;
  }

  if (message?.type !== "extract-trade-data") {
    return;
  }

  try {
    const data = extractTradeData();
    sendResponse({ ok: true, data });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "\u672a\u77e5\u9519\u8bef",
      debug: getDebugData()
    });
  }
});
