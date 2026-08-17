"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

require("../shared.js");

const fixture = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "fixtures", "search-success.json"),
    "utf8"
  )
);

test("defaults to disabled annotation and the public pilot endpoint", () => {
  const settings = FringeShared.normalizeSettings({});
  assert.equal(settings.enabled, false);
  assert.equal(
    settings.apiUrl,
    "https://demoscope-api.willschulz.com/v1/search"
  );
  assert.equal(settings.apiToken, "");
});

test("requires HTTPS and a pilot token", () => {
  assert.equal(
    FringeShared.validateSettings({
      apiUrl: "http://example.test/v1/search",
      apiToken: "token",
    }).ok,
    false
  );
  assert.equal(
    FringeShared.validateSettings({
      apiUrl: "https://example.test/v1/search",
      apiToken: "",
    }).ok,
    false
  );
});

test("displays a strong hybrid match fixture", () => {
  assert.equal(FringeShared.shouldDisplay(fixture), true);
});

test("server weak-match and BM25-only decisions always suppress display", () => {
  assert.equal(
    FringeShared.shouldDisplay({ ...fixture, weak_match: true }),
    false
  );
  assert.equal(
    FringeShared.shouldDisplay({ ...fixture, bm25_only: true }),
    false
  );
});

test("empty and malformed responses are suppressed", () => {
  assert.equal(FringeShared.shouldDisplay(null), false);
  assert.equal(FringeShared.shouldDisplay({}), false);
  assert.equal(
    FringeShared.shouldDisplay({
      hits: [],
      weak_match: false,
      bm25_only: false,
    }),
    false
  );
});

test("search requests are bounded before network transfer", () => {
  const request = FringeShared.clampSearchRequest(" x ".repeat(400), 99, -5);
  assert.equal(request.text.length, 500);
  assert.equal(request.k, 5);
  assert.equal(request.min_n, 0);
});
