const YOUTUBE_ICON = "youtools.png";
const GRAYSCALE_ICON = "youtools-gray.png";

// Check if current URL is YouTube
function isYouTube(url) {
  try {
    const u = new URL(url);
    return u.hostname === "www.youtube.com";
  } catch (e) {
    return false;
  }
}

// Update the extension icon
function updateIcon(tabId, url) {
  const iconPath = isYouTube(url) ? YOUTUBE_ICON : GRAYSCALE_ICON;
  chrome.action.setIcon({ tabId, path: iconPath });
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
    if (tab.url) {
      updateIcon(activeInfo.tabId, tab.url);
    }
  });
});
