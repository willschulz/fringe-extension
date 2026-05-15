/**
 * background.js — Service Worker
 *
 * Handles all network requests to the demoscope API on behalf of the content
 * script.  Running here (rather than in the content script) means:
 *   1. No CORS preflight issues — extension service workers are exempt.
 *   2. The in-memory cache survives content-script reloads within the same
 *      browser session.
 *
 * Message protocol (content.js → background.js):
 *   Request:  { type: "SEARCH", tweetId: "...", text: "..." }
 *   Response: { hits: [...], weak_match: bool, bm25_only: bool, total: int }
 *             or { error: "..." } on failure.
 *
 * The response shape mirrors the demoscope /api/search JSON payload directly.
 */

const DEMOSCOPE_URL = "https://demoscope.manx-celsius.ts.net/api/search";

// Similarity threshold below which we suppress the badge ("no strong match").
// Mirrors survey_search.config.WEAK_MATCH_THRESHOLD (0.30).
const WEAK_MATCH_THRESHOLD = 0.30;

// In-memory cache: tweetId → search results.
// Lives in the service worker so it survives content-script re-injections
// within the same browser session, but is intentionally not persisted.
const _cache = new Map();

// Maximum number of tweet IDs to cache before evicting the oldest.
const CACHE_MAX = 500;

// Query parameters sent to the demoscope API for each tweet.
const DEFAULT_K = 3;        // number of hits to request
const DEFAULT_MIN_N = 500;  // minimum survey sample size

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "SEARCH") return false;

  const { tweetId, text } = msg;

  if (_cache.has(tweetId)) {
    sendResponse(_cache.get(tweetId));
    return false; // synchronous
  }

  // Kick off async fetch; tell Chrome we'll call sendResponse later.
  (async () => {
    try {
      const params = new URLSearchParams({
        q: text,
        k: String(DEFAULT_K),
        min_n: String(DEFAULT_MIN_N),
      });
      const res = await fetch(`${DEMOSCOPE_URL}?${params}`);
      if (!res.ok) {
        sendResponse({ error: `HTTP ${res.status}` });
        return;
      }
      const data = await res.json();

      // Evict oldest entry if the cache is full.
      if (_cache.size >= CACHE_MAX) {
        _cache.delete(_cache.keys().next().value);
      }
      _cache.set(tweetId, data);
      sendResponse(data);
    } catch (err) {
      sendResponse({ error: err.message });
    }
  })();

  return true; // keep the message channel open for the async response
});
