/**
 * background.js — service worker for authenticated pilot search requests.
 *
 * Post text is sent only after the user enables annotation. It travels in an
 * HTTPS POST body so it does not appear in URLs or ordinary access logs.
 */

importScripts("shared.js");

const { normalizeSettings, validateSettings, clampSearchRequest } = FringeShared;
const CACHE_MAX = 500;
const REQUEST_TIMEOUT_MS = 10000;
const MAX_ATTEMPTS = 2;
const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);
const _cache = new Map();
const _inflight = new Map();

function settingsFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(FringeShared.DEFAULT_SETTINGS, (raw) => {
      resolve(normalizeSettings(raw));
    });
  });
}

function cacheKey(postId, text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${postId}:${(hash >>> 0).toString(16)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSearch(settings, request) {
  const validation = validateSettings(settings);
  if (!validation.ok) {
    return { error: validation.error, code: "configuration", retryable: false };
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(validation.settings.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validation.settings.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const retryable = TRANSIENT_STATUS.has(response.status);
        if (retryable && attempt < MAX_ATTEMPTS) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 600);
          continue;
        }
        return {
          error:
            response.status === 401
              ? "The pilot token was rejected."
              : `Search service returned HTTP ${response.status}.`,
          code: `http_${response.status}`,
          retryable,
        };
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.hits)) {
        return {
          error: "Search service returned an invalid response.",
          code: "invalid_response",
          retryable: false,
        };
      }
      return data;
    } catch (error) {
      const retryable =
        error && (error.name === "AbortError" || error instanceof TypeError);
      if (retryable && attempt < MAX_ATTEMPTS) {
        await sleep(600);
        continue;
      }
      return {
        error:
          error && error.name === "AbortError"
            ? "Search request timed out."
            : "Search service is unavailable.",
        code: error && error.name === "AbortError" ? "timeout" : "network",
        retryable,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { error: "Search service is unavailable.", code: "network", retryable: true };
}

async function searchPost(message) {
  const settings = await settingsFromStorage();
  if (!settings.enabled) return { disabled: true };

  const request = clampSearchRequest(message.text, 3, 500);
  if (!request.text || !message.postId) {
    return { error: "Post text or identifier is missing.", code: "invalid_request" };
  }

  const key = cacheKey(String(message.postId), request.text);
  if (_cache.has(key)) return _cache.get(key);
  if (_inflight.has(key)) return _inflight.get(key);

  const pending = fetchSearch(settings, request).then((data) => {
    _inflight.delete(key);
    if (!data.error) {
      if (_cache.size >= CACHE_MAX) _cache.delete(_cache.keys().next().value);
      _cache.set(key, data);
    }
    return data;
  });
  _inflight.set(key, pending);
  return pending;
}

async function testConnection() {
  const settings = await settingsFromStorage();
  const request = clampSearchRequest(
    "Should social media companies remove political misinformation?",
    1,
    500
  );
  const data = await fetchSearch(settings, request);
  return data.error
    ? data
    : { ok: true, message: "Connected to the pilot search service." };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !["SEARCH", "TEST_CONNECTION"].includes(message.type)) {
    return false;
  }

  const operation =
    message.type === "SEARCH" ? searchPost(message) : testConnection();
  operation.then(sendResponse).catch(() => {
    sendResponse({
      error: "Unexpected extension error.",
      code: "extension",
      retryable: false,
    });
  });
  return true;
});

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") {
    _cache.clear();
    _inflight.clear();
  }
});
