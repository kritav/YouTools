const speedSlider = document.getElementById("speed-slider");
const speedInput = document.getElementById("speed-input");
const volumeSlider = document.getElementById("volume-slider");
const pipButton = document.getElementById("pip-button");
const logo = document.getElementById("logo");

const STORAGE_KEYS = {
  speed: "youtools_speed",
  volume: "youtools_volume",
  pipEnabled: "youtools_pip_enabled"
};

// GET values from storage so you don't have to reset your settings each time :P
document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url || "";

  // Change logo if the person is on YT
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    logo.classList.add("active");
  }

  chrome.storage.local.get(STORAGE_KEYS, (data) => {
    const savedSpeed = data[STORAGE_KEYS.speed] || 1.0;
    const savedVolume = data[STORAGE_KEYS.volume] || 1.0;

    speedSlider.value = savedSpeed;
    speedInput.value = savedSpeed;
    volumeSlider.value = savedVolume;
  });
});

// video speed slider 
speedSlider.addEventListener("input", () => {
  speedInput.value = speedSlider.value;
  chrome.storage.local.set({ [STORAGE_KEYS.speed]: parseFloat(speedSlider.value) });
  updateVideoProperty("playbackRate", parseFloat(speedSlider.value));
});

speedInput.addEventListener("change", () => {
  const value = Math.max(0.01, Math.min(100, parseFloat(speedInput.value)));
  speedSlider.value = value;
  speedInput.value = value;
  chrome.storage.local.set({ [STORAGE_KEYS.speed]: value });
  updateVideoProperty("playbackRate", value);
});

// Volume slider (sometimes the volume on youtube + your device is still too loud even at lowest settings so this third option helps)
volumeSlider.addEventListener("input", () => {
  chrome.storage.local.set({ [STORAGE_KEYS.volume]: parseFloat(volumeSlider.value) });
});

// Picture-in-picture so you don't have to right click the video twice to do that
pipButton.addEventListener("click", () => {
  chrome.scripting.executeScript({
    target: { tabId: chrome.tabs.TAB_ID_CURRENT },
    func: () => {
      const video = document.querySelector("video");
      if (video && document.pictureInPictureEnabled) {
        video.requestPictureInPicture().catch(console.error);
      }
    }
  });

  chrome.storage.local.set({ [STORAGE_KEYS.pipEnabled]: true });
});

// Inject script into the current YouTube tab
function updateVideoProperty(prop, value) {
  chrome.scripting.executeScript({
    target: { tabId: chrome.tabs.TAB_ID_CURRENT },
    func: (property, val) => {
      const video = document.querySelector("video");
      if (video) video[property] = val;
    },
    args: [prop, value]
  });
}
