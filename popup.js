const speedSlider = document.getElementById("speed-slider");
const speedInput = document.getElementById("speed-input");
const volumeSlider = document.getElementById("volume-slider");
const volumeInput = document.getElementById("volume-input");
const pipButton = document.querySelector(".icon-btn[title='Picture in Picture']");
const muteButton = document.querySelector(".icon-btn[title='Mute/Unmute']");
const logo = document.getElementById("logo");

const STORAGE_KEYS = {
  speed: "youtools_speed",
  volume: "youtools_volume",
  muted: "youtools_muted"
};

// Initialize controls when popup opens
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || "";

    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      logo.classList.add("active");
    }

    // Get saved values
    chrome.storage.local.get(STORAGE_KEYS, (data) => {
      const savedSpeed = data[STORAGE_KEYS.speed] || 1.0;
      const savedVolume = data[STORAGE_KEYS.volume] || 100;
      
      speedSlider.value = savedSpeed;
      speedInput.value = savedSpeed;
      volumeSlider.value = savedVolume;
      volumeInput.value = savedVolume;

      // Apply saved values to video
      updateVideoProperty("playbackRate", savedSpeed);
      updateVideoProperty("volume", savedVolume / 100);
    });
  } catch (error) {
    console.error("Error initializing controls:", error);
  }
});

// Speed control
speedSlider.addEventListener("input", () => {
  const value = parseFloat(speedSlider.value);
  speedInput.value = value;
  chrome.storage.local.set({ [STORAGE_KEYS.speed]: value });
  updateVideoProperty("playbackRate", value);
});

speedInput.addEventListener("change", () => {
  let value = parseFloat(speedInput.value);
  value = Math.max(0.01, Math.min(100, value));
  speedSlider.value = value;
  speedInput.value = value;
  chrome.storage.local.set({ [STORAGE_KEYS.speed]: value });
  updateVideoProperty("playbackRate", value);
});

// Volume control
volumeSlider.addEventListener("input", () => {
  const value = parseFloat(volumeSlider.value);
  volumeInput.value = value;
  chrome.storage.local.set({ [STORAGE_KEYS.volume]: value });
  updateVideoProperty("volume", value / 100);
});

volumeInput.addEventListener("change", () => {
  let value = parseFloat(volumeInput.value);
  value = Math.max(0, Math.min(100, value));
  if (isNaN(value)) value = 100;
  volumeSlider.value = value;
  volumeInput.value = value;
  chrome.storage.local.set({ [STORAGE_KEYS.volume]: value });
  updateVideoProperty("volume", value / 100);
});

// Picture-in-Picture button
pipButton?.addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        const video = document.querySelector("video");
        if (video && document.pictureInPictureEnabled) {
          if (document.pictureInPictureElement) {
            document.exitPictureInPicture();
          } else {
            video.requestPictureInPicture();
          }
        }
      }
    });
  } catch (error) {
    console.error("PiP error:", error);
  }
});

// Mute button
muteButton?.addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        const video = document.querySelector("video");
        if (video) {
          video.muted = !video.muted;
        }
      }
    });
  } catch (error) {
    console.error("Mute error:", error);
  }
});

// Helper function to update video properties
async function updateVideoProperty(prop, value) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: (property, val) => {
        const video = document.querySelector("video");
        if (video) video[property] = val;
      },
      args: [prop, value]
    });
  } catch (error) {
    console.error(`Error updating ${prop}:`, error);
  }
}
