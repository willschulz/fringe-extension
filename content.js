/**
 * content.js — Post Scanner & Badge Injector
 *
 * Supports two platforms:
 *   - X / Twitter  (twitter.com, x.com)
 *   - Bluesky      (bsky.app)
 *
 * Polls the DOM every 800 ms looking for new posts.  For each new post:
 *   1. Extract the post's text content.
 *   2. Extract a stable post ID for caching (tweet numeric ID or Bluesky rkey).
 *   3. Send a SEARCH message to background.js.
 *   4. Inject a .fringe-badge element near the post when results arrive —
 *      or do nothing if no strong match is found.
 *
 * Processed posts are marked with `data-fringe="pending"` then `"checked"`
 * (or `"error"`) to prevent re-processing across poll cycles.
 */

// Maximum characters of post text to send as the search query.
const MAX_QUERY_CHARS = 280;

// Similarity threshold below which we suppress the badge.
// Mirrors survey_search.config.WEAK_MATCH_THRESHOLD.
const WEAK_MATCH_THRESHOLD = 0.30;

// Attribute used to mark processed post anchors across poll cycles.
const PROCESSED_ATTR = "data-fringe";

// ---------------------------------------------------------------------------
// Platform definitions
//
// Each platform entry describes how to find posts in the DOM, extract their
// text and ID, and where to inject the badge.
// ---------------------------------------------------------------------------

const PLATFORMS = {

  /**
   * X / Twitter
   * - Posts are <article> elements.
   * - Text lives in [data-testid="tweetText"].
   * - IDs are extracted from /status/<numeric_id> links.
   * - The PROCESSED_ATTR is placed on the <article> itself.
   * - Badge is injected after the action bar.
   */
  twitter: {
    /** CSS selector for the element that anchors one post (carries PROCESSED_ATTR). */
    containerSelector: "article",

    /** Return a stable ID string for the post, or null if not found. */
    extractId(container) {
      for (const link of container.querySelectorAll("a[href*='/status/']")) {
        const m = link.href.match(/\/status\/([0-9]+)/);
        if (m) return m[1];
      }
      return null;
    },

    /** Return the post text, or null if not found. */
    extractText(container) {
      const el = container.querySelector('[data-testid="tweetText"]');
      if (el) return el.innerText.trim().slice(0, MAX_QUERY_CHARS);
      // Fallback: first <span lang> block
      const lang = container.querySelector("span[lang]");
      return lang ? lang.innerText.trim().slice(0, MAX_QUERY_CHARS) : null;
    },

    /** Inject the badge element into the container after results arrive. */
    injectBadge(container, badge) {
      const actionBar = container.querySelector('[role="group"]');
      if (actionBar && actionBar.parentElement) {
        actionBar.parentElement.insertBefore(badge, actionBar.nextSibling);
      } else {
        container.appendChild(badge);
      }
    },
  },

  /**
   * Bluesky
   * - Post text lives in [data-testid="postText"] elements.
   * - We use the postText element itself as the container anchor
   *   (avoids needing to identify the outer card, which has no stable test ID).
   * - IDs are the AT Protocol record keys extracted from /post/<rkey> links.
   * - Badge is injected as a sibling immediately after the postText element.
   */
  bluesky: {
    containerSelector: '[data-testid="postText"]',

    extractId(container) {
      // Walk up from the postText element to find a /post/ link in the
      // enclosing card.  We search up to 10 ancestor levels.
      let node = container;
      for (let i = 0; i < 10; i++) {
        node = node.parentElement;
        if (!node) break;
        for (const link of node.querySelectorAll("a[href*='/post/']")) {
          const m = link.href.match(/\/profile\/[^/]+\/post\/([a-z0-9]+)/i);
          if (m) return m[1];
        }
      }
      return null;
    },

    extractText(container) {
      return container.innerText.trim().slice(0, MAX_QUERY_CHARS) || null;
    },

    injectBadge(container, badge) {
      // Insert the badge right after the postText div.
      if (container.parentElement) {
        container.parentElement.insertBefore(badge, container.nextSibling);
      } else {
        container.appendChild(badge);
      }
    },
  },
};

// ---------------------------------------------------------------------------
// Detect current platform
// ---------------------------------------------------------------------------

function detectPlatform() {
  const host = window.location.hostname;
  if (host.includes("bsky.app")) return PLATFORMS.bluesky;
  return PLATFORMS.twitter; // default: x.com / twitter.com
}

const platform = detectPlatform();

// ---------------------------------------------------------------------------
// Badge rendering
// ---------------------------------------------------------------------------

/**
 * Format a single hit from the demoscope API into an HTML string.
 */
function hitToHTML(hit) {
  const stem = hit.q_text ? hit.q_text.split(/[?.!]\s+/)[0].slice(0, 160) : "";
  const source = hit.source_label || hit.source || "";
  const year =
    hit.year_min && hit.year_max
      ? hit.year_min === hit.year_max
        ? String(hit.year_min)
        : `${hit.year_min}–${hit.year_max}`
      : hit.year_min || hit.year_max || "";

  const opts = (hit.options || []).slice(0, 3);
  const optsHTML = opts.length
    ? `<span class="fringe-options">${opts
        .map((o) => `<span class="fringe-opt">${escapeHTML(o)}</span>`)
        .join("")}${
        hit.options && hit.options.length > 3
          ? '<span class="fringe-opt fringe-opt-more">…</span>'
          : ""
      }</span>`
    : "";

  const detailURL =
    hit.file && hit.anchor
      ? `https://demoscope.manx-celsius.ts.net/q/${hit.source}/${hit.file
          .split("/")
          .pop()
          .replace(/\.md$/, "")}/${hit.anchor}`
      : `https://demoscope.manx-celsius.ts.net/?q=${encodeURIComponent(stem)}`;

  const sampleNote = hit.n ? ` · n≈${hit.n.toLocaleString()}` : "";

  return `
    <div class="fringe-hit">
      <span class="fringe-pill">${escapeHTML(source)}${year ? ` ${year}` : ""}${sampleNote}</span>
      <span class="fringe-stem">${escapeHTML(stem)}${stem !== hit.q_text ? "…" : ""}</span>
      ${optsHTML}
      <a class="fringe-link" href="${detailURL}" target="_blank" rel="noopener">view question ↗</a>
    </div>`.trim();
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build and return the badge DOM element for a set of API results.
 * Returns null if the match is too weak or there are no hits.
 */
function buildBadge(data) {
  if (!data.hits || data.hits.length === 0) return null;
  const top = data.hits[0];
  if (
    top.embedding !== null &&
    top.embedding !== undefined &&
    top.embedding < WEAK_MATCH_THRESHOLD
  )
    return null;

  const badge = document.createElement("div");
  badge.className = "fringe-badge";

  badge.innerHTML = `
    <button class="fringe-toggle" aria-expanded="false">
      <span class="fringe-icon">📊</span>
      <span class="fringe-label">Public opinion data</span>
      <span class="fringe-chevron">▸</span>
    </button>
    <div class="fringe-panel" hidden>
      <div class="fringe-hits">
        ${data.hits.map(hitToHTML).join("")}
      </div>
      <p class="fringe-footer">
        Survey data via <a href="https://demoscope.manx-celsius.ts.net" target="_blank" rel="noopener">demoscope</a>
        ${data.bm25_only ? " · keyword-only match" : ""}
      </p>
    </div>`.trim();

  const btn = badge.querySelector(".fringe-toggle");
  const panel = badge.querySelector(".fringe-panel");
  const chevron = badge.querySelector(".fringe-chevron");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const expanded = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!expanded));
    panel.hidden = expanded;
    chevron.textContent = expanded ? "▸" : "▾";
  });

  return badge;
}

// ---------------------------------------------------------------------------
// Main polling loop
// ---------------------------------------------------------------------------

function startPolling() {
  setInterval(() => {
    const containers = document.querySelectorAll(
      platform.containerSelector
    );

    for (const container of containers) {
      // Skip already-processed containers.
      if (container.getAttribute(PROCESSED_ATTR)) continue;

      const postId = platform.extractId(container);
      const text = platform.extractText(container);

      // Skip if we can't extract usable text or a stable ID.
      if (!text || !postId) continue;

      container.setAttribute(PROCESSED_ATTR, "pending");

      chrome.runtime.sendMessage({ type: "SEARCH", tweetId: postId, text }, (data) => {
        if (chrome.runtime.lastError) {
          container.setAttribute(PROCESSED_ATTR, "error");
          return;
        }
        container.setAttribute(PROCESSED_ATTR, "checked");
        if (data && !data.error) {
          // Guard against duplicate injection if another poll cycle snuck in.
          if (container.querySelector(".fringe-badge")) return;
          const badge = buildBadge(data);
          if (badge) platform.injectBadge(container, badge);
        }
      });
    }
  }, 800);
}

startPolling();
