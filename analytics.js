// Analytics storage keys
const ANALYTICS_KEYS = {
  watchHistory: 'youtools_watch_history',
  categories: 'youtools_categories',
  dailyStats: 'youtools_daily_stats',
  channelStats: 'youtools_channel_stats'
};

let currentPeriod = 'day';
let currentSort = 'watchTime';

document.addEventListener('DOMContentLoaded', () => {
  initializeTimeSelector();
  initializeSortButtons();
  loadAnalytics(currentPeriod);
});

function initializeTimeSelector() {
  const buttons = document.querySelectorAll('.time-selector button');
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      currentPeriod = button.dataset.period;
      loadAnalytics(currentPeriod);
    });
  });
}

function initializeSortButtons() {
  const buttons = document.querySelectorAll('.sort-buttons button');
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      currentSort = button.dataset.sort;
      loadAnalytics(currentPeriod);
    });
  });
}

async function loadAnalytics(period) {
  const data = await getAnalyticsData(period);
  updateStats(data);
  updateCharts(data);
}

async function getAnalyticsData(period) {
  return new Promise(resolve => {
    chrome.storage.local.get([
      ANALYTICS_KEYS.watchHistory,
      ANALYTICS_KEYS.categories,
      ANALYTICS_KEYS.dailyStats,
      ANALYTICS_KEYS.channelStats
    ], data => {
      console.log('Retrieved analytics data:', data); // Debug line
      const filtered = filterDataByPeriod(data, period);
      console.log('Filtered data:', filtered); // Debug line
      resolve(filtered);
    });
  });
}

function filterDataByPeriod(data, period) {
  const now = new Date();
  const startDate = getStartDate(now, period);
  
  return {
    watchHistory: (data[ANALYTICS_KEYS.watchHistory] || [])
      .filter(entry => new Date(entry.timestamp) >= startDate),
    categories: data[ANALYTICS_KEYS.categories] || {},
    dailyStats: filterDailyStats(data[ANALYTICS_KEYS.dailyStats] || {}, startDate)
  };
}

function getStartDate(now, period) {
  switch(period) {
    case 'day':
      return new Date(now.setHours(0, 0, 0, 0));
    case 'week':
      return new Date(now.setDate(now.getDate() - 7));
    case 'month':
      return new Date(now.setMonth(now.getMonth() - 1));
    case 'year':
      return new Date(now.setFullYear(now.getFullYear() - 1));
    default:
      return new Date(0);
  }
}

function updateStats(data) {
  const totalWatchTime = calculateTotalWatchTime(data.watchHistory);
  const timeSaved = calculateTimeSaved(data.watchHistory);
  const videoCount = data.watchHistory.length;
  const avgSpeed = calculateAverageSpeed(data.watchHistory);

  document.getElementById('totalWatchTime').textContent = 
    `${formatTime(totalWatchTime)}`;
  document.getElementById('timeSaved').textContent = 
    `${formatTime(timeSaved)}`;
  document.getElementById('videoCount').textContent = videoCount;
  document.getElementById('avgSpeed').textContent = 
    `${avgSpeed.toFixed(1)}x`;
}

// Store chart instances
let charts = {
  category: null,
  timeline: null,
  channel: null
};

function updateCharts(data) {
  updateCategoryChart(data.categories);
  updateTimelineChart(data.dailyStats);
  updateChannelChart(data);
}

function updateCategoryChart(categories) {
  const ctx = document.getElementById('categoryChart');
  
  // Destroy existing chart if it exists
  if (charts.category) {
    charts.category.destroy();
  }
  
  const sortedCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1]);

  charts.category = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sortedCategories.map(([cat]) => cat),
      datasets: [{
        data: sortedCategories.map(([, time]) => time),
        backgroundColor: generateColors(sortedCategories.length)
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right'
        }
      }
    }
  });
}

function updateTimelineChart(dailyStats) {
  const ctx = document.getElementById('timelineChart');
  
  // Destroy existing chart if it exists
  if (charts.timeline) {
    charts.timeline.destroy();
  }
  
  const dates = Object.keys(dailyStats).sort();
  
  charts.timeline = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(date => new Date(date).toLocaleDateString()),
      datasets: [{
        label: 'Watch Time (minutes)',
        data: dates.map(date => dailyStats[date] / 60),
        borderColor: '#cc0000',
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Minutes'
          }
        }
      }
    }
  });
}

function updateChannelChart(data) {
  const ctx = document.getElementById('channelChart');
  
  // Destroy existing chart if it exists
  if (charts.channel) {
    charts.channel.destroy();
  }
  
  const channelData = Object.entries(data.channelStats || {})
    .sort((a, b) => b[1][currentSort] - a[1][currentSort])
    .slice(0, 10); // Show top 10 channels

  charts.channel = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: channelData.map(([channel]) => channel),
      datasets: [{
        label: currentSort === 'watchTime' ? 'Watch Time (min)' : 'Videos Watched',
        data: channelData.map(([, stats]) => 
          currentSort === 'watchTime' ? 
          Math.round(stats.watchTime / 60) : 
          stats.videoCount
        ),
        backgroundColor: '#cc0000'
      }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

function generateColors(count) {
  return Array.from({ length: count }, (_, i) => 
    `hsl(${(i * 360) / count}, 70%, 50%)`);
}

function calculateTotalWatchTime(history) {
  return history.reduce((total, entry) => total + (entry.watchTime || 0), 0);
}

function calculateAverageSpeed(history) {
  if (history.length === 0) return 1.0;
  const totalSpeed = history.reduce((sum, entry) => sum + (entry.speed || 1), 0);
  return totalSpeed / history.length;
}

//time formatting function
function formatTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

//function to calculate time saved
function calculateTimeSaved(history) {
  return history.reduce((total, entry) => 
    total + (entry.timeSaved || 0), 0);
}

// function filters daily states based on start date to current
function filterDailyStats(dailyStats, startDate) {
  return Object.entries(dailyStats)
    .filter(([date]) => new Date(date) >= startDate)
    .reduce((acc, [date, value]) => {
      acc[date] = value;
      return acc;
    }, {});
}