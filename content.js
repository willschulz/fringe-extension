/**
 * content.js — Post Scanner & Badge Injector
 *
 * Supports three platforms:
 *   - X / Twitter  (twitter.com, x.com)
 *   - Bluesky      (bsky.app)
 *   - Reddit       (reddit.com) — new Reddit / Shreddit only
 *
 * Watches the DOM and processes posts only when they approach the viewport:
 *   1. Extract the post's text content.
 *   2. Extract a stable post ID for caching (tweet numeric ID, Bluesky rkey,
 *      or Reddit fullname / post ID).
 *   3. Send a SEARCH message to background.js.
 *   4. Inject a .fringe-badge element near the post when results arrive —
 *      or do nothing if no strong match is found.
 *
 * Processed posts are marked with `data-fringe="pending"` then `"checked"`
 * (or `"error"`) to prevent re-processing across poll cycles.
 */

// Maximum characters of post text to send as the search query.
// Reddit titles can hit 300 chars; self-posts and comments carry even more
// context, so we use a higher cap for that platform.
const MAX_QUERY_CHARS = 280;
const MAX_QUERY_CHARS_REDDIT = 500;

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

  /**
   * Reddit (new Reddit / Shreddit, ~2023+)
   *
   * Shreddit renders posts and comments as custom HTML elements:
   *   <shreddit-post>   — feed cards and the OP block on post pages
   *   <shreddit-comment>— top-level and nested comment blocks
   *
   * Both element types expose their content as slotted light-DOM children
   * (accessible with normal querySelector) and as HTML attributes on the
   * custom element itself.  No shadow-piercing is required.
   *
   * Post ID: the `id` attribute holds the Reddit fullname (e.g. "t3_abc123").
   *   Fallback: parse the post ID from the `permalink` attribute or a child
   *   <a> whose href contains /comments/<id>/.
   * Comment ID: the `thingid` attribute holds the fullname (e.g. "t1_xyz789").
   *   Fallback: parse from a child permalink link.
   *
   * Badge placement:
   *   - Post: appended to the <shreddit-post> element (below the action bar).
   *   - Comment: appended to the <shreddit-comment> element (below the body).
   */
  reddit: {
    containerSelector: "shreddit-post, shreddit-comment",

    extractId(container) {
      const tag = container.tagName.toLowerCase();

      if (tag === "shreddit-post") {
        // Prefer the fullname attribute (t3_<id>), else the bare id attr.
        const fullname = container.getAttribute("id") ||
                         container.getAttribute("data-fullname");
        if (fullname) return fullname;

        // Fallback: pull post ID from permalink attribute.
        const permalink = container.getAttribute("permalink");
        if (permalink) {
          const m = permalink.match(/\/comments\/([a-z0-9]+)\//i);
          if (m) return `t3_${m[1]}`;
        }

        // Last resort: scan child links for a /comments/ href.
        for (const link of container.querySelectorAll("a[href*='/comments/']")) {
          const m = link.href.match(/\/comments\/([a-z0-9]+)\//i);
          if (m) return `t3_${m[1]}`;
        }
      }

      if (tag === "shreddit-comment") {
        // thingid is the fullname (t1_<id>).
        const thingid = container.getAttribute("thingid") ||
                        container.getAttribute("id");
        if (thingid) return thingid;

        // Fallback: look for a permalink on child anchor.
        for (const link of container.querySelectorAll("a[href*='/comment/']")) {
          const m = link.href.match(/\/comment\/([a-z0-9]+)\//i);
          if (m) return `t1_${m[1]}`;
        }
      }

      return null;
    },

    extractText(container) {
      const tag = container.tagName.toLowerCase();
      const parts = [];

      if (tag === "shreddit-post") {
        // Title: slotted child first, then attribute fallback.
        const titleSlot = container.querySelector('[slot="title"]');
        if (titleSlot) {
          parts.push(titleSlot.textContent.trim());
        } else {
          const attrTitle = container.getAttribute("post-title");
          if (attrTitle) parts.push(attrTitle.trim());
        }

        // Subreddit adds useful topical context for the demoscope query.
        const sub = container.getAttribute("subreddit-prefixed-name") ||
                    container.getAttribute("subreddit-name");
        if (sub) parts.push(`[${sub}]`);

        // Flair signals community framing.
        const flair = container.querySelector('[slot="flair"]');
        if (flair) {
          const flairText = flair.textContent.trim();
          if (flairText) parts.push(`[Flair: ${flairText}]`);
        }

        // Self-post body (text posts have the actual opinion here).
        const body = container.querySelector('[slot="text-body"], [slot="post-body"]');
        if (body) {
          const bodyText = body.textContent.trim();
          if (bodyText) parts.push(bodyText);
        }
      }

      if (tag === "shreddit-comment") {
        // Comment body is in [slot="comment"].
        const commentSlot = container.querySelector('[slot="comment"]');
        if (commentSlot) {
          parts.push(commentSlot.textContent.trim().slice(0, 400));
        }
      }

      const combined = parts.join(" | ");
      return combined.slice(0, MAX_QUERY_CHARS_REDDIT) || null;
    },

    injectBadge(container, badge) {
      // Append to the custom element — this places the badge below Reddit's
      // native action row without fighting their internal slot layout.
      container.appendChild(badge);
    },
  },
};

// ---------------------------------------------------------------------------
// Detect current platform
// ---------------------------------------------------------------------------

function detectPlatform() {
  const host = window.location.hostname;
  if (host.includes("reddit.com")) return PLATFORMS.reddit;
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

  const sampleNote = hit.n ? ` · n≈${hit.n.toLocaleString()}` : "";

  return `
    <div class="fringe-hit">
      <span class="fringe-pill">${escapeHTML(source)}${year ? ` ${year}` : ""}${sampleNote}</span>
      <span class="fringe-stem">${escapeHTML(stem)}${stem !== hit.q_text ? "…" : ""}</span>
      ${optsHTML}
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
  if (!FringeShared.shouldDisplay(data)) return null;

  const badge = document.createElement("div");
  badge.className = "fringe-badge";
  const panelId = `fringe-panel-${Math.random().toString(36).slice(2, 10)}`;

  badge.innerHTML = `
    <button class="fringe-toggle" aria-expanded="false" aria-controls="${panelId}">
      <span class="fringe-icon">📊</span>
      <span class="fringe-label">Related public-opinion data</span>
      <span class="fringe-chevron">▸</span>
    </button>
    <div class="fringe-panel" id="${panelId}" hidden>
      <div class="fringe-hits">
        ${data.hits.map(hitToHTML).join("")}
      </div>
      <p class="fringe-footer">
        Experimental match · not a fringe/mainstream classification ·
        <a href="https://github.com/willschulz/fringe-extension/blob/main/SURVEY_SOURCES.md"
           target="_blank" rel="noopener">sources &amp; terms</a>
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
// Viewport-gated observation and bounded request queue
// ---------------------------------------------------------------------------

const MAX_CONCURRENT = 3;
const queue = [];
const observedContainers = new Set();
let activeRequests = 0;
let scanTimer = null;

function processContainer(container) {
  const postId = platform.extractId(container);
  const text = platform.extractText(container);
  if (!text || !postId) return Promise.resolve();

  container.setAttribute(PROCESSED_ATTR, "pending");
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "SEARCH", postId, text }, (data) => {
      if (chrome.runtime.lastError) {
        container.setAttribute(PROCESSED_ATTR, "error");
        resolve();
        return;
      }
      if (data && data.disabled) {
        container.setAttribute(PROCESSED_ATTR, "disabled");
        resolve();
        return;
      }
      if (data && data.error) {
        container.setAttribute(
          PROCESSED_ATTR,
          data.retryable ? "retryable-error" : "error"
        );
        resolve();
        return;
      }

      container.setAttribute(PROCESSED_ATTR, "checked");
      if (!container.querySelector(".fringe-badge")) {
        const badge = buildBadge(data);
        if (badge) platform.injectBadge(container, badge);
      }
      resolve();
    });
  });
}

function drainQueue() {
  while (activeRequests < MAX_CONCURRENT && queue.length > 0) {
    const container = queue.shift();
    if (!container || !container.isConnected) continue;
    activeRequests += 1;
    processContainer(container).finally(() => {
      activeRequests -= 1;
      drainQueue();
    });
  }
}

const intersectionObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      intersectionObserver.unobserve(entry.target);
      observedContainers.delete(entry.target);
      if (!entry.target.getAttribute(PROCESSED_ATTR)) queue.push(entry.target);
    }
    drainQueue();
  },
  { rootMargin: "250px 0px", threshold: 0.01 }
);

function scanForContainers() {
  for (const container of document.querySelectorAll(platform.containerSelector)) {
    if (
      container.getAttribute(PROCESSED_ATTR) ||
      observedContainers.has(container)
    ) {
      continue;
    }
    observedContainers.add(container);
    intersectionObserver.observe(container);
  }
  for (const container of observedContainers) {
    if (!container.isConnected) observedContainers.delete(container);
  }
}

function scheduleScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(scanForContainers, 250);
}

const mutationObserver = new MutationObserver(scheduleScan);
mutationObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.enabled) return;
  if (changes.enabled.newValue === true) {
    for (const container of document.querySelectorAll(
      `[${PROCESSED_ATTR}="disabled"], [${PROCESSED_ATTR}="retryable-error"]`
    )) {
      container.removeAttribute(PROCESSED_ATTR);
    }
    scheduleScan();
  } else {
    queue.splice(0, queue.length);
    for (const badge of document.querySelectorAll(".fringe-badge")) {
      badge.remove();
    }
    for (const container of document.querySelectorAll(`[${PROCESSED_ATTR}]`)) {
      container.setAttribute(PROCESSED_ATTR, "disabled");
    }
  }
});

scanForContainers();
