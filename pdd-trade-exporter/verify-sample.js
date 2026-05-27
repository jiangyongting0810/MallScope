const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoDir = __dirname;
const harPath = path.join(repoDir, "samples", "mms.pinduoduo.com.har");
const contentPath = path.join(repoDir, "content.js");
const tradePageUrl = "https://mms.pinduoduo.com/sycm/stores_data/operation";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findHarEntry(entries, urlPart) {
  return entries.find((entry) => entry.request?.url?.includes(urlPart)) || null;
}

function parseHarPayload(entry) {
  return JSON.parse(entry.response?.content?.text || "{}");
}

function loadContentExports() {
  const code =
    fs.readFileSync(contentPath, "utf8") +
    "\nmodule.exports = { storePageSnapshot, extractCurrentPageData, getDebugData };";

  const context = {
    module: { exports: {} },
    exports: {},
    console,
    Map,
    Number,
    String,
    Array,
    Date,
    Math,
    JSON,
    location: { href: tradePageUrl },
    window: {
      addEventListener() {}
    },
    document: {
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      }
    },
    chrome: {
      runtime: {
        onMessage: {
          addListener() {}
        }
      }
    }
  };

  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: "content.js" });
  return context.module.exports;
}

function main() {
  const har = readJson(harPath);
  const entries = har.log?.entries || [];
  const tradeListEntry = findHarEntry(entries, "/api/mallTrade/queryMallTradeList");
  const tradeInfoEntry = findHarEntry(entries, "/api/mallTrade/getMallTradeInfo");

  if (!tradeListEntry || !tradeInfoEntry) {
    throw new Error("HAR 样本缺少交易页必需接口。");
  }

  const content = loadContentExports();
  for (const entry of [tradeListEntry, tradeInfoEntry]) {
    content.storePageSnapshot({
      url: entry.request.url,
      payload: parseHarPayload(entry),
      capturedAt: entry.startedDateTime,
      source: "sample-replay"
    });
  }

  const result = content.extractCurrentPageData();
  const visitorValue = result.metrics?.visitorValue?.raw;
  const visitorCount = result.debug?.visitorValue?.calculatedVisitorCount;

  console.log(JSON.stringify({
    snapshotPages: content.getDebugData().snapshotPages,
    visitorValue,
    visitorCount,
    metrics: result.metrics
  }, null, 2));

  if (visitorValue !== "18.47") {
    throw new Error(`访客价值校验失败，期望 18.47，实际 ${visitorValue}`);
  }
}

main();
