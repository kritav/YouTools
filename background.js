const YOUTUBE_ICON = "images/youtools.png";
const GRAYSCALE_ICON = "images/youtools-gray.png";

// Check if current URL is YouTube
function isYouTube(url) {
  try {
    const u = new URL(url);
    return u.hostname.includes("youtube.com");
  } catch (e) {
    return false;
  }
}

// Update the extension icon
function updateIcon(tabId, url) {
  const iconPath = isYouTube(url) ? YOUTUBE_ICON : GRAYSCALE_ICON;

  chrome.action.setIcon(
    {
      tabId,
      path: { "16": iconPath } // ← This is the key fix!
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error(`Failed to set icon for tab ${tabId}:`, chrome.runtime.lastError.message);
      }
    }
  );
}

// Tab update handler
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    updateIcon(tabId, tab.url);
  }
});

// Tab switching handler
chrome.tabs.onActivated.addListener(activeInfo => {
  chrome.tabs.get(activeInfo.tabId, tab => {
    if (tab && tab.url) {
      updateIcon(activeInfo.tabId, tab.url);
    }
  });
});
