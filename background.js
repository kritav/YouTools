const YOUTUBE_ICON = "images/youtools.png";
const GRAYSCALE_ICON = "images/youtools-gray.png";

//helper function to check if the URL is a YouTube link
function isYouTube(url) {
  try {
    const u = new URL(url);
    return u.hostname.endsWith("youtube.com") || u.hostname.endsWith("youtu.be");
  } catch (e) {
    return false;
  }
}

//switches extension icon to red or gray depending on whether site is youtube or not
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

// video tracking
let videoStates = new Map();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && isYouTube(tab.url)) {
    startTracking(tabId);
  }
});

function startTracking(tabId) {
  if (videoStates.has(tabId)) return;

  chrome.scripting.executeScript({
    target: { tabId },
    function: () => {
      const video = document.querySelector('video');
      if (!video) return;

      // Track video state
      const data = {
        startTime: Date.now(),
        lastUpdate: Date.now(),
        category: document.querySelector('ytd-video-primary-info-renderer')?.textContent || 'Unknown',
        watchTime: 0
      };

      video.addEventListener('play', () => {
        data.lastUpdate = Date.now();
      });

      video.addEventListener('pause', () => {
        data.watchTime += (Date.now() - data.lastUpdate) / 1000;
        data.lastUpdate = Date.now();
      });

      return data;
    }
  }).then(([result]) => {
    if (result?.result) {
      videoStates.set(tabId, result.result);
    }
  });
}

// Update analytics every minute
chrome.alarms.create('updateAnalytics', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateAnalytics') {
    updateAllTabsAnalytics();
  }
});

async function updateAllTabsAnalytics() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (videoStates.has(tab.id)) {
      updateTabAnalytics(tab.id);
    }
  }
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
