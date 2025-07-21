const YOUTUBE_ICON = "images/youtools.png";
const GRAYSCALE_ICON = "images/youtools-gray.png";

const speedInput = document.getElementById("speed-input");
const speedSlider = document.getElementById("speed-slider");
const volumeInput = document.getElementById("volume-input");
const volumeSlider = document.getElementById("volume-slider");


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
      path: { "16": iconPath } 
    },
    () => {
    if (chrome.runtime.lastError) {
      console.error(`Failed to set icon for tab ${tabId}: ${chrome.runtime.lastError.message}`);
    }
  }
  );
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

speedInput.addEventListener("input", () => {
  let val = Math.min(Math.max(parseFloat(speedInput.value), 0.01), 100);
  speedInput.value = val;
  speedSlider.value = val;
});

speedSlider.addEventListener("input", () => {
  speedInput.value = speedSlider.value;
});


volumeInput.addEventListener("input", () => {
  let val = Math.min(Math.max(parseInt(volumeInput.value), 0), 100);
  volumeInput.value = val;
  volumeSlider.value = val;
});

volumeSlider.addEventListener("input", () => {
  volumeInput.value = volumeSlider.value;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up stored settings for this tab
  const storageKeys = [
    `youtools_speed_${tabId}`,
    `youtools_volume_${tabId}`,
    `youtools_muted_${tabId}`
  ];
  chrome.storage.local.remove(storageKeys);
});
