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
  if (videoStates.has(tabId)) {
    // If we're already tracking this tab, just update the video data
    chrome.scripting.executeScript({
      target: { tabId },
      function: () => {
        if (typeof updateVideoData === 'function') {
          updateVideoData();
        }
      }
    });
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId },
    function: () => {
      let data = {
        startTime: Date.now(),
        lastUpdate: Date.now(),
        watchTime: 0,
        timeSaved: 0,
        speed: 1,
        channelName: '',
        videoTitle: '',
        category: 'Uncategorized',
        videoId: location.pathname.split('/').pop() // Store video ID
      };

      async function updateVideoData() {
        try {
          // Get channel name
          const channelSelectors = [
            '#owner-text a.yt-formatted-string', // Main video page channel link
            '#channel-name a.yt-formatted-string', // Alternative channel link
            '#upload-info a.yt-formatted-string' // Another possible location
          ];
          
          for (const selector of channelSelectors) {
            const channelElement = document.querySelector(selector);
            if (channelElement?.textContent?.trim()) {
              data.channelName = channelElement.textContent.trim();
              console.log('Found channel name:', data.channelName);
              break;
            }
          }
          
          // Get video title
          const titleElement = document.querySelector('#title h1.title');
          if (titleElement?.textContent?.trim()) {
            data.videoTitle = titleElement.textContent.trim();
            console.log('Found video title:', data.videoTitle);
          }

          // Get video category
          const rows = document.querySelectorAll('ytd-metadata-row-renderer');
          for (const row of rows) {
            const title = row.querySelector('#title')?.textContent?.trim();
            const content = row.querySelector('#content')?.textContent?.trim();
            if (title === 'Category') {
              data.category = content || 'Uncategorized';
              console.log('Found category:', data.category);
              break;
            }
          }

          // If no channel name was found, try one more time after a delay
          if (!data.channelName) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const lastResortChannel = document.querySelector('#top-row ytd-channel-name yt-formatted-string');
            if (lastResortChannel?.textContent?.trim()) {
              data.channelName = lastResortChannel.textContent.trim();
              console.log('Found channel name (delayed):', data.channelName);
            }
          }
        } catch (error) {
          console.error('Error updating video data:', error);
        }
        
        console.log('Final video data:', data);
      }

      function updateTimeSaved() {
        const video = document.querySelector('video');
        if (!video || video.paused) return;
        
        const currentTime = Date.now();
        const elapsed = (currentTime - data.lastUpdate) / 1000;
        
        // Update watch time and time saved
        data.speed = video.playbackRate;
        const timeSaved = elapsed * (data.speed - 1);
        data.watchTime = (data.watchTime || 0) + elapsed;
        data.timeSaved = (data.timeSaved || 0) + (timeSaved > 0 ? timeSaved : 0);
        data.lastUpdate = currentTime;
        
        console.log('Time update:', {
          elapsed,
          watchTime: data.watchTime,
          timeSaved: data.timeSaved,
          speed: data.speed
        });
        
        // Send updated data back to background script
        chrome.runtime.sendMessage({
          type: 'videoUpdate',
          data: data
        });
      }

      // Initial setup
      const video = document.querySelector('video');
      if (!video) return null;

      updateVideoData();

      // Event listeners
      video.addEventListener('play', () => {
        console.log('Video played');
        data.lastUpdate = Date.now();
        data.speed = video.playbackRate;
      });

      video.addEventListener('pause', () => {
        console.log('Video paused');
        updateTimeSaved();
      });

      video.addEventListener('ratechange', () => {
        console.log('Playback rate changed:', video.playbackRate);
        updateTimeSaved();
      });

      // Regular updates
      const updateInterval = setInterval(updateTimeSaved, 1000);
      
      // Cleanup on navigation
      window.addEventListener('beforeunload', () => {
        clearInterval(updateInterval);
        updateTimeSaved();
      });

      return data;
    }
  }).then(([result]) => {
    if (result?.result) {
      console.log('Started tracking for tab:', tabId, result.result); // Debug log
      videoStates.set(tabId, result.result);
    }
  });
}

// Add this function to update analytics
// Listen for video updates from content script
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'videoUpdate' && sender.tab) {
    console.log('Received video update:', message.data); // Debug log
    videoStates.set(sender.tab.id, message.data);
  }
});

async function updateTabAnalytics(tabId) {
  const videoData = videoStates.get(tabId);
  if (!videoData || !videoData.watchTime) return;

  console.log('Updating analytics for tab:', tabId, videoData); // Debug log

  const today = new Date().toISOString().split('T')[0];
  
  chrome.storage.local.get(ANALYTICS_KEYS, (data) => {
    // Update watch history
    const watchHistory = data[ANALYTICS_KEYS.watchHistory] || [];
    
    // Check if this video is already in history
    const existingEntry = watchHistory.find(entry => 
      entry.videoTitle === videoData.videoTitle && 
      entry.channelName === videoData.channelName
    );
    
    const entry = {
      timestamp: new Date().toISOString(),
      watchTime: Math.round(videoData.watchTime || 0),
      timeSaved: Math.round(videoData.timeSaved || 0),
      speed: videoData.speed || 1,
      channelName: videoData.channelName || 'Unknown Channel',
      videoTitle: videoData.videoTitle || 'Unknown Video',
      category: videoData.category || 'Uncategorized'
    };
    
    if (existingEntry) {
      // Update existing entry
      existingEntry.watchTime += entry.watchTime;
      existingEntry.timeSaved += entry.timeSaved;
      existingEntry.timestamp = entry.timestamp;
      console.log('Updating existing entry:', existingEntry);
    } else {
      console.log('Adding new watch history entry:', entry);
      watchHistory.push(entry);

    // Update channel stats
    const channelStats = data[ANALYTICS_KEYS.channelStats] || {};
    const channelName = videoData.channelName || 'Unknown Channel';
    if (!channelStats[channelName]) {
      channelStats[channelName] = {
        watchTime: 0,
        videoCount: 0,
        timeSaved: 0
      };
    }
    
    // Update video count only for new entries
    if (!existingEntry) {
      channelStats[channelName].videoCount += 1;
    }
    
    channelStats[channelName].watchTime += Math.round(videoData.watchTime || 0);
    channelStats[channelName].timeSaved += Math.round(videoData.timeSaved || 0);

    // Update categories
    const categories = data[ANALYTICS_KEYS.categories] || {};
    const category = videoData.category || 'Uncategorized';
    categories[category] = (categories[category] || 0) + Math.round(videoData.watchTime || 0);

    // Update daily stats
    const dailyStats = data[ANALYTICS_KEYS.dailyStats] || {};
    dailyStats[today] = (dailyStats[today] || 0) + videoData.watchTime;

    const updates = {
      [ANALYTICS_KEYS.watchHistory]: watchHistory,
      [ANALYTICS_KEYS.channelStats]: channelStats,
      [ANALYTICS_KEYS.categories]: categories,
      [ANALYTICS_KEYS.dailyStats]: dailyStats
    };

    console.log('Saving analytics data:', updates); // Debug log

    chrome.storage.local.set(updates, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving analytics:', chrome.runtime.lastError);
      } else {
        console.log('Successfully saved analytics data');
      }
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
  // First update analytics one last time if this was a tracked tab
  if (videoStates.has(tabId)) {
    updateTabAnalytics(tabId);
    videoStates.delete(tabId);
  }

  // Then clean up tab-specific storage
  const storageKeys = [
    `youtools_speed_${tabId}`,
    `youtools_volume_${tabId}`,
    `youtools_muted_${tabId}`
  ];
  chrome.storage.local.remove(storageKeys);
});
