// 全域狀態變數（保持不變）
let allWords = [];
let filteredWords = [];
let currentIdx = 0;
let currentFileName = "";
let currentLevel = "";
const synth = window.speechSynthesis;

// ... 中間所有函式保持不變（initDaySelectToggle、getVoices、speak、read3Times、loadFileListByLevel、loadSelectedFile、filterByDay、prevWord、nextWord、showWord、showAllWords）...

// ====================== 新增：獲取最後更新時間 ======================
/**
 * 從 GitHub API 取得 script.js 的最後 commit 時間
 * @returns {Promise<string>} 格式化後的時間字串，若失敗則回傳 'Unknown'
 */
async function fetchLastCommitTime() {
  const repoOwner = 'vizaiweb';
  const repoName = 'word-review';
  const filePath = 'script.js'; // 要追蹤的檔案
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/commits?path=${filePath}&page=1&per_page=1`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
    const data = await response.json();
    if (data && data.length > 0) {
      const commitDate = data[0].commit.committer.date; // ISO 8601 格式
      const date = new Date(commitDate);
      // 格式化為英文：Month DD, YYYY HH:MM (24h)
      const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
      return date.toLocaleString('en-US', options);
    }
    return 'Unknown';
  } catch (error) {
    console.error('Failed to fetch commit time:', error);
    return 'Unknown';
  }
}

/**
 * 在網頁底部插入更新時間
 */
async function insertLastUpdatedFooter() {
  const footer = document.createElement('div');
  footer.id = 'last-updated-footer';
  footer.style.textAlign = 'center';
  footer.style.fontSize = '12px';
  footer.style.color = '#888';
  footer.style.marginTop = '20px';
  footer.style.padding = '10px';
  footer.style.borderTop = '1px solid #eee';

  const commitTime = await fetchLastCommitTime();
  footer.textContent = `Last updated: ${commitTime}`;
  document.body.appendChild(footer);
}

// ====================== 初始化事件綁定（修改部分） ======================
document.addEventListener('DOMContentLoaded', () => {
  // 原有初始化
  const showAllBtn = document.getElementById('showAllBtn');
  initDaySelectToggle();

  document.getElementById('levelConfirm').addEventListener('click', function() {
    this.style.opacity = '0.7';
    setTimeout(() => this.style.opacity = '1', 200);

    const level = document.getElementById('levelSelect').value;
    if (!level) {
      alert('Please select P1 or P2 first!');
      return;
    }
    currentLevel = level;
    loadFileListByLevel(level);
    showAllBtn.style.display = 'none';
  });

  document.getElementById('fileConfirm').addEventListener('click', function() {
    this.style.opacity = '0.7';
    setTimeout(() => this.style.opacity = '1', 200);

    const file = document.getElementById('fileSelect').value;
    const invalidValues = ["", "Loading...", "No files available", "Load failed"];
    if (invalidValues.includes(file)) {
      alert('Please select a valid file first!');
      return;
    }
    loadSelectedFile(file);
  });

  document.getElementById('filterBtn').addEventListener('click', function() {
    this.style.opacity = '0.7';
    setTimeout(() => this.style.opacity = '1', 200);
    filterByDay();
  });

  showAllBtn.addEventListener('click', showAllWords);

  // ===== 新增：載入完成後顯示最後更新時間 =====
  insertLastUpdatedFooter();
});
