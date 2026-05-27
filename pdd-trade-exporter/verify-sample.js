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

function loadContentExports(pageUrl = tradePageUrl) {
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
    location: { href: pageUrl },
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

function verifyTradeSample() {
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
    case: "trade-sample",
    snapshotPages: content.getDebugData().snapshotPages,
    visitorValue,
    visitorCount,
    metrics: result.metrics
  }, null, 2));

  if (visitorValue !== "18.47") {
    throw new Error(`访客价值校验失败，期望 18.47，实际 ${visitorValue}`);
  }
}

function verifyGoodsAliases() {
  const variants = [
    {
      yesData: { guv: 42, gpv: 74 },
      expected: { visitorCount: "42", goodsViewCount: "74" }
    },
    {
      yesData: { goodsUv: 31, gpv: 74 },
      expected: { visitorCount: "31", goodsViewCount: "74" }
    },
    {
      yesData: { visitorCount: 19, goodsViewCount: 51 },
      expected: { visitorCount: "19", goodsViewCount: "51" }
    },
    {
      yesData: { goodsVisitorCnt: 27, viewCnt: 63 },
      expected: { visitorCount: "27", goodsViewCount: "63" }
    }
  ];

  for (const variant of variants) {
    const content = loadContentExports("https://mms.pinduoduo.com/sycm/goods_effect");
    content.storePageSnapshot({
      url: "https://mms.pinduoduo.com/sydney/api/goodsDataShow/queryGoodsPageOverviewForMms",
      payload: { result: { yesData: variant.yesData } },
      capturedAt: "2026-05-27T12:42:02.222Z",
      source: "synthetic-goods-sample"
    });
    const result = content.extractCurrentPageData();

    console.log(JSON.stringify({
      case: "goods-alias",
      input: variant.yesData,
      metrics: result.metrics,
      debug: result.debug
    }, null, 2));

    if (result.metrics.visitorCount.raw !== variant.expected.visitorCount) {
      throw new Error(`商品访客数校验失败，期望 ${variant.expected.visitorCount}，实际 ${result.metrics.visitorCount.raw}`);
    }

    if (result.metrics.goodsViewCount.raw !== variant.expected.goodsViewCount) {
      throw new Error(`商品浏览量校验失败，期望 ${variant.expected.goodsViewCount}，实际 ${result.metrics.goodsViewCount.raw}`);
    }
  }
}

function main() {
  verifyTradeSample();
  verifyGoodsAliases();
}

main();
