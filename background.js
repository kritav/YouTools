const YOUTUBE_ICON = "images/youtools.png";
const GRAYSCALE_ICON = "images/youtools-gray.png";

function isYouTube(url) {
  try {
    const u = new URL(url);
    return u.hostname.includes("youtube.com");
  } catch (e) {
    return false;
  }
}

function updateIcon(tabId, url) {
  const iconPath = isYouTube(url) ? YOUTUBE_ICON : GRAYSCALE_ICON;

  fetch(chrome.runtime.getURL(iconPath))
    .then(res => {
      if (!res.ok) throw new Error("Icon file not found");
      return res.blob();
    })
    .then(() => {
      chrome.action.setIcon(
        {
          tabId,
          path: { 16: iconPath }
        },
        () => {
          if (chrome.runtime.lastError) {
            console.error(
              `Failed to set icon for tab ${tabId}:`,
              chrome.runtime.lastError.message
            );
          }
        }
      );
    })
    .catch(err => {
      console.error("Icon preload failed:", err.message);
    });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    updateIcon(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(activeInfo => {
  chrome.tabs.get(activeInfo.tabId, tab => {
    if (tab && tab.url) {
      updateIcon(activeInfo.tabId, tab.url);
    }
  });
});
