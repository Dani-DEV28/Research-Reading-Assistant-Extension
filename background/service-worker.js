const DEFAULT_PREFERENCES = {
  detection: {
    enabled: true,
    logToConsole: true,
  },
};

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get('preferences');
  if (!stored.preferences) {
    await chrome.storage.local.set({ preferences: DEFAULT_PREFERENCES });
  }
});
