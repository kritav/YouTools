const YOUTUBE_ICON = "images/youtools.png";
const GRAYSCALE_ICON = "images/youtools-gray.png";

function isYouTube(url) {
  try {
    const u = new URL(url);
    return u.hostname.endsWith("youtube.com") || u.hostname.endsWith("youtu.be");
  } catch (e) {
    return false;
  }
}

function updateIcon(tabId, url) {
  const iconPath = isYouTube(url) ? YOUTUBE_ICON : GRAYSCALE_ICON;
  chrome.action.setIcon(
    {
      tabId: tabId,
      path: iconPath
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error(`Failed to set icon for tab ${tabId}: ${chrome.runtime.lastError.message}`);
      }
    }
  );
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    updateIcon(tabId, tab.url);
  }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener(activeInfo => {
  chrome.tabs.get(activeInfo.tabId, tab => {
    if (tab?.url) {
      updateIcon(activeInfo.tabId, tab.url);
    }
  });
});

// Clean up storage when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  const storageKeys = [
    `youtools_speed_${tabId}`,
    `youtools_volume_${tabId}`,
    `youtools_muted_${tabId}`
  ];
  chrome.storage.local.remove(storageKeys);
});
