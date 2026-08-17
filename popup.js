"use strict";

const form = document.querySelector("#settings-form");
const tokenInput = document.querySelector("#api-token");
const urlInput = document.querySelector("#api-url");
const enabledInput = document.querySelector("#enabled");
const testButton = document.querySelector("#test-button");
const statusElement = document.querySelector("#status");

function setStatus(message, state = "") {
  statusElement.textContent = message;
  if (state) statusElement.dataset.state = state;
  else delete statusElement.dataset.state;
}

function readForm() {
  return FringeShared.normalizeSettings({
    enabled: enabledInput.checked,
    apiUrl: urlInput.value,
    apiToken: tokenInput.value,
  });
}

function saveSettings(settings) {
  return new Promise((resolve) => chrome.storage.local.set(settings, resolve));
}

function loadSettings() {
  chrome.storage.local.get(FringeShared.DEFAULT_SETTINGS, (raw) => {
    const settings = FringeShared.normalizeSettings(raw);
    tokenInput.value = settings.apiToken;
    urlInput.value = settings.apiUrl;
    enabledInput.checked = settings.enabled;
    setStatus(
      settings.enabled
        ? "Annotation is enabled."
        : "Annotation is paused until you enable it."
    );
  });
}

testButton.addEventListener("click", async () => {
  const settings = readForm();
  const validation = FringeShared.validateSettings(settings);
  if (!validation.ok) {
    setStatus(validation.error, "error");
    return;
  }

  testButton.disabled = true;
  setStatus("Testing the search service…");
  await saveSettings(validation.settings);
  chrome.runtime.sendMessage({ type: "TEST_CONNECTION" }, (response) => {
    testButton.disabled = false;
    if (chrome.runtime.lastError || !response || response.error) {
      setStatus(
        response && response.error
          ? response.error
          : "The connection test could not run.",
        "error"
      );
      return;
    }
    setStatus(response.message || "Connection succeeded.", "success");
  });
});

enabledInput.addEventListener("change", async () => {
  const settings = readForm();
  if (settings.enabled) {
    const validation = FringeShared.validateSettings(settings);
    if (!validation.ok) {
      enabledInput.checked = false;
      setStatus(validation.error, "error");
      return;
    }
  }
  await saveSettings({ enabled: enabledInput.checked });
  setStatus(
    enabledInput.checked ? "Annotation is enabled." : "Annotation is paused.",
    enabledInput.checked ? "success" : ""
  );
});

form.addEventListener("submit", (event) => event.preventDefault());
loadSettings();
