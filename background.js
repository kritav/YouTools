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

// Add these storage keys
const ANALYTICS_KEYS = {
  watchHistory: 'youtools_watch_history',
  categories: 'youtools_categories',
  dailyStats: 'youtools_daily_stats',
  channelStats: 'youtools_channel_stats'
};

// Modify the startTracking function
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
        watchTime: 0,
        speed: video.playbackRate,
        channelName: document.querySelector('#channel-name')?.textContent?.trim() || 'Unknown Channel',
        videoTitle: document.querySelector('.ytd-video-primary-info-renderer')?.textContent?.trim() || 'Unknown Video'
      };

      // Update time saved calculation
      function updateTimeSaved() {
        const currentTime = Date.now();
        const elapsed = (currentTime - data.lastUpdate) / 1000;
        const timeSaved = elapsed * (data.speed - 1);
        data.watchTime += elapsed;
        data.timeSaved = (data.timeSaved || 0) + timeSaved;
        data.lastUpdate = currentTime;
      }

      video.addEventListener('play', () => {
        data.lastUpdate = Date.now();
        data.speed = video.playbackRate;
      });

      video.addEventListener('pause', () => {
        updateTimeSaved();
      });

      video.addEventListener('ratechange', () => {
        updateTimeSaved();
        data.speed = video.playbackRate;
      });

      // Update even while playing
      setInterval(updateTimeSaved, 1000);

      return data;
    }
  }).then(([result]) => {
    if (result?.result) {
      videoStates.set(tabId, result.result);
    }
  });
}

// Add this function to update analytics
async function updateTabAnalytics(tabId) {
  const videoData = videoStates.get(tabId);
  if (!videoData) return;

  const today = new Date().toISOString().split('T')[0];
  
  chrome.storage.local.get(ANALYTICS_KEYS, (data) => {
    // Update watch history
    const watchHistory = data[ANALYTICS_KEYS.watchHistory] || [];
    watchHistory.push({
      timestamp: new Date().toISOString(),
      watchTime: videoData.watchTime,
      timeSaved: videoData.timeSaved,
      speed: videoData.speed,
      channelName: videoData.channelName,
      videoTitle: videoData.videoTitle
    });

    // Update channel stats
    const channelStats = data[ANALYTICS_KEYS.channelStats] || {};
    if (!channelStats[videoData.channelName]) {
      channelStats[videoData.channelName] = {
        watchTime: 0,
        videoCount: 0,
        timeSaved: 0
      };
    }
    channelStats[videoData.channelName].watchTime += videoData.watchTime;
    channelStats[videoData.channelName].videoCount += 1;
    channelStats[videoData.channelName].timeSaved += videoData.timeSaved;

    // Update daily stats
    const dailyStats = data[ANALYTICS_KEYS.dailyStats] || {};
    dailyStats[today] = (dailyStats[today] || 0) + videoData.watchTime;

    chrome.storage.local.set({
      [ANALYTICS_KEYS.watchHistory]: watchHistory,
      [ANALYTICS_KEYS.channelStats]: channelStats,
      [ANALYTICS_KEYS.dailyStats]: dailyStats
    });
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
