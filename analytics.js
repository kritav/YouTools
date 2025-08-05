// Analytics storage keys
const ANALYTICS_KEYS = {
  watchHistory: 'youtools_watch_history',
  categories: 'youtools_categories',
  dailyStats: 'youtools_daily_stats'
};

let currentPeriod = 'day';

document.addEventListener('DOMContentLoaded', () => {
  initializeTimeSelector();
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
      ANALYTICS_KEYS.dailyStats
    ], data => {
      const filtered = filterDataByPeriod(data, period);
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
    default:
      return new Date(0);
  }
}

function updateStats(data) {
  const totalWatchTime = calculateTotalWatchTime(data.watchHistory);
  const videoCount = data.watchHistory.length;
  const avgSpeed = calculateAverageSpeed(data.watchHistory);

  document.getElementById('totalWatchTime').textContent = 
    `${Math.round(totalWatchTime / 60)} min`;
  document.getElementById('videoCount').textContent = videoCount;
  document.getElementById('avgSpeed').textContent = 
    `${avgSpeed.toFixed(1)}x`;
}

function updateCharts(data) {
  updateCategoryChart(data.categories);
  updateTimelineChart(data.dailyStats);
}

function updateCategoryChart(categories) {
  const ctx = document.getElementById('categoryChart');
  const sortedCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1]);

  new Chart(ctx, {
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
  const dates = Object.keys(dailyStats).sort();
  
  new Chart(ctx, {
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