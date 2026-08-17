(function initFringeShared(global) {
  "use strict";

  const DEFAULT_API_URL = "https://demoscope-api.willschulz.com/v1/search";
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: false,
    apiUrl: DEFAULT_API_URL,
    apiToken: "",
  });

  function normalizeSettings(raw = {}) {
    return {
      enabled: raw.enabled === true,
      apiUrl:
        typeof raw.apiUrl === "string" && raw.apiUrl.trim()
          ? raw.apiUrl.trim()
          : DEFAULT_API_URL,
      apiToken: typeof raw.apiToken === "string" ? raw.apiToken.trim() : "",
    };
  }

  function validateSettings(settings) {
    const normalized = normalizeSettings(settings);
    let url;
    try {
      url = new URL(normalized.apiUrl);
    } catch (_error) {
      return { ok: false, error: "Enter a valid API URL." };
    }
    if (url.protocol !== "https:") {
      return { ok: false, error: "The pilot API must use HTTPS." };
    }
    if (!normalized.apiToken) {
      return { ok: false, error: "Enter the pilot token supplied separately." };
    }
    return { ok: true, settings: normalized };
  }

  function shouldDisplay(data) {
    return Boolean(
      data &&
        data.weak_match === false &&
        data.bm25_only === false &&
        Array.isArray(data.hits) &&
        data.hits.length > 0
    );
  }

  function clampSearchRequest(text, k = 3, minN = 500) {
    return {
      text: String(text || "").trim().slice(0, 500),
      k: Math.max(1, Math.min(5, Number.isFinite(Number(k)) ? Number(k) : 3)),
      min_n: Math.max(
        0,
        Math.min(100000, Number.isFinite(Number(minN)) ? Number(minN) : 500)
      ),
    };
  }

  global.FringeShared = Object.freeze({
    DEFAULT_API_URL,
    DEFAULT_SETTINGS,
    normalizeSettings,
    validateSettings,
    shouldDisplay,
    clampSearchRequest,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
