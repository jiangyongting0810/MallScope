const PAGE_MESSAGE_TYPE = "PDD_TRADE_EXPORTER_DATA";
const TRADE_SPIDER_DIGIT_FALLBACK = new Map([
  ["\ue42a", "0"],
  ["\ueab4", "0"],
  ["\ue860", "1"],
  ["\ue41a", "1"],
  ["\ue552", "2"],
  ["\ueb21", "2"],
  ["\ue681", "3"],
  ["\uec94", "3"],
  ["\ue35b", "4"],
  ["\ue69a", "4"],
  ["\uec90", "5"],
  ["\ue71c", "5"],
  ["\ued49", "6"],
  ["\ue8c4", "6"],
  ["\ue60b", "7"],
  ["\ue669", "7"],
  ["\ueedf", "8"],
  ["\uef2f", "8"],
  ["\uefbb", "9"],
  ["\ue6b6", "9"]
]);

const PAGE_CONFIGS = [
  {
    id: "trade",
    urlPrefix: "https://mms.pinduoduo.com/sycm/stores_data/operation",
    apiPaths: [
      "/api/mallTrade/queryMallTradeList",
      "/api/mallTrade/getMallTradeInfo"
    ],
    displayName: "\u4ea4\u6613\u6570\u636e\u9875",
    metrics: [
      { key: "payAmount", label: "\u6210\u4ea4\u91d1\u989d", type: "number", field: "payOrdrAmt" },
      { key: "payOrderCount", label: "\u6210\u4ea4\u8ba2\u5355\u6570", type: "count", field: "payOrdrCnt" },
      { key: "customerUnitPrice", label: "\u5ba2\u5355\u4ef7", type: "number", field: "payOrdrAup" },
      { key: "visitorValue", label: "\u8bbf\u5ba2\u4ef7\u503c", type: "number", field: "uvCfmVal" },
      { key: "conversionRate", label: "\u6210\u4ea4\u8f6c\u5316\u7387", type: "percent", field: "payUvRto" }
    ]
  },
  {
    id: "goods",
    urlPrefix: "https://mms.pinduoduo.com/sycm/goods_effect",
    apiPath: "/sydney/api/goodsDataShow/queryGoodsPageOverviewForMms",
    displayName: "\u5546\u54c1\u6570\u636e\u9875",
    responseMode: "summaryYesterdayObject",
    metrics: [
      {
        key: "visitorCount",
        label: "\u5546\u54c1\u8bbf\u5ba2\u6570",
        type: "count",
        fields: ["guv", "uv", "goodsUv", "visitorCnt", "visitorCount", "goodsVisitorCnt", "goodsVisitorCount"]
      },
      {
        key: "goodsViewCount",
        label: "\u5546\u54c1\u6d4f\u89c8\u91cf",
        type: "count",
        fields: ["gpv", "goodsGpv", "viewCnt", "viewCount", "goodsViewCnt", "goodsViewCount"]
      }
    ]
  }
];

const pageSnapshots = new Map();
const debugState = {
  hookInjected: true,
  messagesSeen: 0,
  targetMessagesSeen: 0,
  lastUrls: []
};

function findPageConfigByLocation() {
  return PAGE_CONFIGS.find((config) => location.href.startsWith(config.urlPrefix)) || null;
}

function findPageConfigByUrl(url) {
  return PAGE_CONFIGS.find((config) => {
    const apiPaths = config.apiPaths || [config.apiPath];
    return apiPaths.some((apiPath) => url?.includes(apiPath));
  }) || null;
}

function parseMetricValue(value) {
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

function getMetricFields(metric) {
  if (Array.isArray(metric?.fields) && metric.fields.length > 0) {
    return metric.fields;
  }

  return metric?.field ? [metric.field] : [];
}

function resolveMetricValue(entry, metric) {
  if (!entry || !metric) {
    return {
      field: null,
      value: null
    };
  }

  for (const field of getMetricFields(metric)) {
    const value = entry?.[field];
    if (parseMetricValue(value) !== null) {
      return {
        field,
        value
      };
    }
  }

  return {
    field: getMetricFields(metric)[0] || null,
    value: null
  };
}

function isValidMetricValue(value) {
  return parseMetricValue(value) !== null;
}

function selectLatestYesterdayEntry(entries, metricFields) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return null;
  }

  const validEntries = entries.filter((entry) =>
    metricFields.some((field) => isValidMetricValue(entry?.[field]))
  );
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

function selectYesterdayEntry(config, result) {
  if (config.responseMode === "summaryYesterdayObject") {
    const candidate = result?.yesData;
    if (!candidate || typeof candidate !== "object") {
      return null;
    }

    const hasAnyMetric = config.metrics.some((metric) => parseMetricValue(resolveMetricValue(candidate, metric).value) !== null);
    return hasAnyMetric ? candidate : null;
  }

  const metricFields = config.metrics.flatMap((metric) => getMetricFields(metric));
  return selectLatestYesterdayEntry(result?.yesterdayRtList, metricFields);
}

function getTradeSnapshot() {
  const current = pageSnapshots.get("trade");
  if (current) {
    return current;
  }

  return {
    configId: "trade",
    pageName: "\u4ea4\u6613\u6570\u636e\u9875",
    detailRequestUrl: null,
    overviewRequestUrl: null,
    detailCapturedAt: null,
    overviewCapturedAt: null,
    yesterdayEntry: null,
    todayEntry: null,
    overviewObj: null
  };
}

function formatExpectedTradeValue(field, entry) {
  const value = parseMetricValue(entry?.[field]);
  if (value === null) {
    return null;
  }

  if (field === "payOrdrCnt" || field === "payOrdrUsrCnt" || field === "mallFavCnt") {
    return String(value);
  }

  if (field === "payUvRto" || field === "rpayUsrRtoDth") {
    return `${(value * 100).toFixed(2)}%`;
  }

  return value.toFixed(2);
}

function buildSpiderDigitMapFromEntry(overviewObj, entry) {
  if (!overviewObj || !entry) {
    return null;
  }

  const candidateFields = [
    "payOrdrAmt",
    "payOrdrCnt",
    "payOrdrUsrCnt",
    "payOrdrAup",
    "payUvRto",
    "rpayUsrRtoDth"
  ];

  const digitMap = new Map();
  for (const field of candidateFields) {
    const encoded = overviewObj[field];
    const expected = formatExpectedTradeValue(field, entry);
    if (typeof encoded !== "string" || !expected || encoded.length !== expected.length) {
      continue;
    }

    for (let index = 0; index < encoded.length; index += 1) {
      const encodedChar = encoded[index];
      const expectedChar = expected[index];
      if (/\d/.test(expectedChar)) {
        digitMap.set(encodedChar, expectedChar);
      }
    }
  }

  if (digitMap.size === 0) {
    return null;
  }

  for (const [encodedChar, decodedChar] of TRADE_SPIDER_DIGIT_FALLBACK.entries()) {
    if (!digitMap.has(encodedChar)) {
      digitMap.set(encodedChar, decodedChar);
    }
  }

  return digitMap;
}

function buildSpiderDigitMap(snapshot) {
  const overviewObj = snapshot?.overviewObj;
  if (!overviewObj) {
    return {
      source: "fallback",
      map: TRADE_SPIDER_DIGIT_FALLBACK
    };
  }

  const candidates = [
    {
      source: "today",
      map: buildSpiderDigitMapFromEntry(overviewObj, snapshot?.todayEntry)
    },
    {
      source: "yesterday",
      map: buildSpiderDigitMapFromEntry(overviewObj, snapshot?.yesterdayEntry)
    }
  ];

  for (const candidate of candidates) {
    if (!candidate.map) {
      continue;
    }

    const decodedVisitorValue = decodeSpiderValue(overviewObj.uvCfmVal, candidate.map);
    if (parseMetricValue(decodedVisitorValue) !== null) {
      return candidate;
    }
  }

  const firstWorking = candidates.find((candidate) => candidate.map);
  if (firstWorking) {
    return firstWorking;
  }

  return {
    source: "fallback",
    map: TRADE_SPIDER_DIGIT_FALLBACK
  };
}

function decodeSpiderValue(value, digitMap) {
  if (typeof value !== "string" || !digitMap || digitMap.size === 0) {
    return value;
  }

  return [...value]
    .map((char) => digitMap.get(char) || char)
    .join("");
}

function findExactTextNode(text) {
  const elements = document.querySelectorAll("span, div, p, button");
  for (const element of elements) {
    if (element.textContent?.trim() === text) {
      return element;
    }
  }

  return null;
}

function getTradeCardNode(trackingId) {
  return document.querySelector(`[data-tracking-click-viewid="${trackingId}"]`);
}

function getTradeCardSpiderValues(trackingId) {
  const cardNode = getTradeCardNode(trackingId);
  if (!cardNode) {
    return null;
  }

  const spiderNodes = cardNode.querySelectorAll("p span.__spider_font");
  return {
    current: spiderNodes[0]?.textContent?.trim() || "",
    compare: spiderNodes[1]?.textContent?.trim() || ""
  };
}

function learnDigitMapFromPair(digitMap, encoded, expected) {
  if (!encoded || !expected || encoded.length !== expected.length) {
    return;
  }

  for (let index = 0; index < encoded.length; index += 1) {
    const encodedChar = encoded[index];
    const expectedChar = expected[index];
    if (/\d/.test(expectedChar)) {
      digitMap.set(encodedChar, expectedChar);
    }
  }
}

function buildTradeDigitMapFromDom(snapshot) {
  const tradeReferenceEntry = snapshot?.yesterdayEntry;
  if (!tradeReferenceEntry) {
    return null;
  }

  const cardSpecs = [
    { trackingId: "transaction_amount", field: "payOrdrAmt", type: "number" },
    { trackingId: "number_of_completed_orders", field: "payOrdrCnt", type: "count" },
    { trackingId: "number_of_transactional_buyers", field: "payOrdrUsrCnt", type: "count" },
    { trackingId: "transaction_conversion_rate", field: "payUvRto", type: "percent" },
    { trackingId: "unit_price_per_customer", field: "payOrdrAup", type: "number" },
    { trackingId: "proportion_of_old_buyers", field: "rpayUsrRtoDth", type: "percent" }
  ];

  const digitMap = new Map();
  for (const spec of cardSpecs) {
    const cardValues = getTradeCardSpiderValues(spec.trackingId);
    if (!cardValues) {
      continue;
    }

    const currentExpected = formatMetricValue(spec.type, tradeReferenceEntry?.[spec.field]).raw;
    learnDigitMapFromPair(digitMap, cardValues.current, currentExpected);
  }

  if (digitMap.size === 0) {
    return null;
  }

  return digitMap;
}

function extractTradeMetricFromDom(label, digitMap) {
  if (label === "\u8bbf\u5ba2\u4ef7\u503c") {
    const cardValues = getTradeCardSpiderValues("average_visitor_value");
    if (cardValues?.current) {
      const decoded = decodeSpiderValue(cardValues.current, digitMap);
      if (parseMetricValue(decoded) !== null) {
        return decoded;
      }
    }
  }

  const labelCandidates = [label];
  if (label === "\u8bbf\u5ba2\u4ef7\u503c") {
    labelCandidates.unshift("\u5e73\u5747\u8bbf\u5ba2\u4ef7\u503c");
    labelCandidates.unshift("\u6628\u65e5\u8bbf\u5ba2\u4ef7\u503c");
  }

  for (const candidate of labelCandidates) {
    const labelNode = findExactTextNode(candidate);
    if (!labelNode) {
      continue;
    }

    const cardNode =
      labelNode.closest("[data-tracking-click-viewid]") ||
      labelNode.parentElement?.closest("[data-tracking-click-viewid]") ||
      labelNode.closest("div");
    if (!cardNode) {
      continue;
    }

    const valueNode = cardNode.querySelector("p span.__spider_font, p span");
    if (!valueNode) {
      continue;
    }

    const decoded = decodeSpiderValue(valueNode.textContent?.trim() || "", digitMap);
    if (parseMetricValue(decoded) !== null) {
      return decoded;
    }
  }

  return null;
}

function serializeDigitMap(digitMap) {
  if (!digitMap || digitMap.size === 0) {
    return [];
  }

  return [...digitMap.entries()].map(([encoded, decoded]) => {
    const codePoint = encoded.codePointAt(0)?.toString(16).toUpperCase() || "";
    return `${encoded}(U+${codePoint})=>${decoded}`;
  });
}

function storeTradeSnapshot(detail) {
  const snapshot = getTradeSnapshot();
  const payloadResult = detail.payload?.result;
  const requestUrl = detail?.url || "";

  if (requestUrl.includes("/api/mallTrade/queryMallTradeList")) {
    const metricFields = PAGE_CONFIGS[0].metrics.map((metric) => metric.field);
    const yesterdayEntry = selectLatestYesterdayEntry(payloadResult?.yesterdayRtList, metricFields);
    const todayEntry = selectLatestYesterdayEntry(payloadResult?.todayRtList, metricFields);
    if (!yesterdayEntry && !todayEntry) {
      return;
    }

    pageSnapshots.set("trade", {
      ...snapshot,
      detailRequestUrl: requestUrl,
      detailCapturedAt: detail.capturedAt,
      yesterdayEntry: yesterdayEntry || snapshot.yesterdayEntry,
      todayEntry: todayEntry || snapshot.todayEntry
    });
    return;
  }

  if (requestUrl.includes("/api/mallTrade/getMallTradeInfo")) {
    if (!payloadResult || typeof payloadResult !== "object") {
      return;
    }

    pageSnapshots.set("trade", {
      ...snapshot,
      overviewRequestUrl: requestUrl,
      overviewCapturedAt: detail.capturedAt,
      overviewObj: payloadResult
    });
  }
}

function storeGoodsSnapshot(config, detail) {
  const result = detail.payload?.result;
  const latestYesterdayEntry = selectYesterdayEntry(config, result);
  if (!latestYesterdayEntry) {
    return;
  }

  const metrics = {};
  const resolvedFields = {};
  for (const metric of config.metrics) {
    const resolved = resolveMetricValue(latestYesterdayEntry, metric);
    metrics[metric.key] = {
      label: metric.label,
      ...formatMetricValue(metric.type, resolved.value)
    };
    resolvedFields[metric.key] = resolved.field;
  }

  pageSnapshots.set(config.id, {
    configId: config.id,
    pageName: config.displayName,
    requestUrl: detail.url,
    capturedAt: detail.capturedAt,
    metrics,
    rawEntry: latestYesterdayEntry,
    resolvedFields
  });
}

function formatMetricValue(type, value) {
  const parsedValue = parseMetricValue(value);
  if (parsedValue === null) {
    return {
      raw: "",
      value: null
    };
  }

  if (type === "count") {
    return {
      raw: String(parsedValue),
      value: parsedValue
    };
  }

  if (type === "percent") {
    return {
      raw: `${(parsedValue * 100).toFixed(2)}%`,
      value: parsedValue
    };
  }

  return {
    raw: parsedValue.toFixed(2),
    value: parsedValue
  };
}

function deriveVisitorValue(entry) {
  const amount = parseMetricValue(entry?.payOrdrAmt);
  const buyers = parseMetricValue(entry?.payOrdrUsrCnt);
  const conversionRate = parseMetricValue(entry?.payUvRto);

  if (amount === 0 && buyers === 0) {
    return {
      value: 0,
      visitorCount: null
    };
  }

  if (amount === null || buyers === null || conversionRate === null || buyers <= 0 || conversionRate <= 0) {
    return null;
  }

  const visitorCount = Math.round(buyers / conversionRate);
  if (visitorCount <= 0) {
    return null;
  }

  return {
    value: amount / visitorCount,
    visitorCount
  };
}

function storePageSnapshot(detail) {
  debugState.messagesSeen += 1;
  debugState.lastUrls.unshift(detail?.url || "unknown");
  debugState.lastUrls = debugState.lastUrls.slice(0, 8);

  const config = findPageConfigByUrl(detail?.url);
  if (!config) {
    return;
  }
  debugState.targetMessagesSeen += 1;

  if (config.id === "trade") {
    storeTradeSnapshot(detail);
    return;
  }

  storeGoodsSnapshot(config, detail);
}

function getDebugData() {
  return {
    ...debugState,
    snapshotPages: [...pageSnapshots.keys()]
  };
}

function validateCurrentPage(config) {
  if (!config) {
    throw new Error("\u5f53\u524d\u9875\u9762\u4e0d\u5728\u5df2\u652f\u6301\u7684\u91c7\u96c6\u8303\u56f4\u5185\u3002");
  }
}

function extractCurrentPageData() {
  const config = findPageConfigByLocation();
  validateCurrentPage(config);

  const snapshot = pageSnapshots.get(config.id);
  if (!snapshot) {
    throw new Error("\u8fd8\u6ca1\u6709\u6355\u83b7\u5230\u5f53\u524d\u9875\u9762\u7684\u6628\u65e5\u63a5\u53e3\u54cd\u5e94\uff0c\u8bf7\u5148\u5237\u65b0\u9875\u9762\u518d\u5bfc\u51fa\u3002");
  }

  if (config.id === "trade") {
    if (!snapshot.yesterdayEntry) {
      throw new Error("\u4ea4\u6613\u6570\u636e\u9875\u7684\u6628\u65e5\u8d8b\u52bf\u63a5\u53e3\u8fd8\u672a\u6355\u83b7\u5230\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u540e\u91cd\u8bd5\u3002");
    }

    const metrics = {};
    const interfaceDigitInfo = buildSpiderDigitMap(snapshot);
    const interfaceDigitMap = interfaceDigitInfo?.map || null;
    const domDigitMap = buildTradeDigitMapFromDom(snapshot);
    const visitorDigitMap = domDigitMap || interfaceDigitMap;
    const derivedVisitorValue = deriveVisitorValue(snapshot.yesterdayEntry);
    const visitorValueDebug = {
      overviewEncoded: snapshot.overviewObj?.visitorValue ?? null,
      overviewField: snapshot.overviewObj?.uvCfmVal ?? null,
      overviewDecoded: null,
      domDecoded: null,
      calculatedValue: derivedVisitorValue?.value ?? null,
      calculatedVisitorCount: derivedVisitorValue?.visitorCount ?? null,
      digitMapSource: domDigitMap ? "dom" : (interfaceDigitInfo?.source || null),
      digitMap: serializeDigitMap(visitorDigitMap)
    };

    for (const metric of config.metrics) {
      let sourceValue = metric.key === "visitorValue"
        ? derivedVisitorValue?.value ?? decodeSpiderValue(snapshot.overviewObj?.[metric.field], visitorDigitMap)
        : snapshot.yesterdayEntry?.[metric.field];

      if (metric.key === "visitorValue" && parseMetricValue(sourceValue) === null) {
        visitorValueDebug.overviewDecoded = sourceValue;
        sourceValue = extractTradeMetricFromDom(metric.label, visitorDigitMap);
        visitorValueDebug.domDecoded = sourceValue;
      } else if (metric.key === "visitorValue") {
        visitorValueDebug.overviewDecoded = sourceValue;
      }

      metrics[metric.key] = {
        label: metric.label,
        ...formatMetricValue(metric.type, sourceValue)
      };
    }

    return {
      capturedAt: snapshot.detailCapturedAt || snapshot.overviewCapturedAt || new Date().toISOString(),
      pageUrl: location.href,
      pageName: snapshot.pageName,
      metrics,
      debug: {
        detailRequestUrl: snapshot.detailRequestUrl,
        overviewRequestUrl: snapshot.overviewRequestUrl,
        hr: snapshot.yesterdayEntry.hr,
        configId: snapshot.configId,
        visitorValue: visitorValueDebug
      }
    };
  }

  return {
    capturedAt: snapshot.capturedAt || new Date().toISOString(),
    pageUrl: location.href,
    pageName: snapshot.pageName,
    metrics: snapshot.metrics,
    debug: {
      requestUrl: snapshot.requestUrl,
      hr: snapshot.rawEntry.hr,
      configId: snapshot.configId,
      resolvedFields: snapshot.resolvedFields || null,
      rawKeys: snapshot.rawEntry ? Object.keys(snapshot.rawEntry) : []
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

  storePageSnapshot(event.data.detail);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "get-debug-state") {
    const config = findPageConfigByLocation();
    sendResponse({
      ok: true,
      debug: {
        ...getDebugData(),
        currentPage: config?.displayName || null
      }
    });
    return;
  }

  if (message?.type !== "extract-trade-data") {
    return;
  }

  try {
    const data = extractCurrentPageData();
    sendResponse({ ok: true, data });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "\u672a\u77e5\u9519\u8bef",
      debug: {
        ...getDebugData(),
        currentPage: findPageConfigByLocation()?.displayName || null
      }
    });
  }
});
