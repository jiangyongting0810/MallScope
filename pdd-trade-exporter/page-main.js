(function () {
  const TARGET_API_PARTS = [
    "/api/mallTrade/queryMallTradeList",
    "/api/mallTrade/getMallTradeInfo",
    "/sydney/api/goodsDataShow/queryGoodsPageOverviewForMms"
  ];
  const MESSAGE_TYPE = "PDD_TRADE_EXPORTER_DATA";

  function cloneForMessage(detail) {
    try {
      return JSON.parse(JSON.stringify(detail));
    } catch (_error) {
      return null;
    }
  }

  function isTargetRequest(url) {
    return TARGET_API_PARTS.some((part) => url?.includes(part));
  }

  function dispatchPayload(source, url, payload) {
    if (!isTargetRequest(url)) {
      return;
    }

    const detail = cloneForMessage({
      source,
      url,
      payload,
      capturedAt: new Date().toISOString()
    });
    if (!detail) {
      return;
    }

    window.postMessage(
      {
        type: MESSAGE_TYPE,
        detail
      },
      "*"
    );
  }

  function tryParseJson(text) {
    try {
      return JSON.parse(text);
    } catch (_error) {
      return null;
    }
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      try {
        const requestUrl = typeof args[0] === "string" ? args[0] : args[0]?.url;
        const clonedResponse = response.clone();
        const text = await clonedResponse.text();
        const payload = tryParseJson(text);
        if (payload) {
          dispatchPayload("fetch", requestUrl, payload);
        }
      } catch (_error) {
        // Ignore instrumentation failures and preserve the original request.
      }

      return response;
    };
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__pddTradeExporterUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        const responseText = this.responseText;
        if (typeof responseText !== "string") {
          return;
        }

        const payload = tryParseJson(responseText);
        if (payload) {
          dispatchPayload("xhr", this.__pddTradeExporterUrl, payload);
        }
      } catch (_error) {
        // Ignore instrumentation failures and preserve the original request.
      }
    });

    return originalSend.apply(this, args);
  };
})();
