// 全域狀態變數
let allWords = [];          // 儲存目前檔案的所有單詞
let filteredWords = [];     // 儲存篩選後的單詞（依 Day/All）
let currentIdx = 0;         // 目前顯示的單詞索引
let currentFileName = "";   // 目前選中的檔案名稱
let currentLevel = "";      // 目前選中的級別 (P1/P2)
const synth = window.speechSynthesis; // 語音合成 API

// ====================== 分支自動切換邏輯 ======================
/**
 * 取得當前使用的分支名稱
 * - 優先讀取 URL 參數 ?branch=xxx
 * - 若在 GitHub Pages 上，嘗試從路徑中提取（如 /repo/dev/ → dev）
 * - 預設返回 'main'
 */
function getCurrentBranch() {
  // 1. URL 參數
  const urlParams = new URLSearchParams(window.location.search);
  const branchParam = urlParams.get('branch');
  if (branchParam) return branchParam;

  // 2. GitHub Pages 路徑解析
  const hostname = window.location.hostname;
  if (hostname.endsWith('github.io')) {
    const pathParts = window.location.pathname.split('/').filter(p => p);
    // 路徑結構通常為 /repo/branch/...，取第二段作為分支名
    if (pathParts.length >= 2) {
      const candidate = pathParts[1];
      // 排除檔案名稱或無效字元
      if (candidate !== 'index.html' && !candidate.includes('.')) {
        return candidate;
      }
    }
  }

  // 3. 預設
  return 'main';
}

/**
 * 移除檔案的 .xlsx 副檔名
 */
function removeFileExtension(filename) {
  return filename.replace(/\.xlsx$/i, '');
}

/**
 * 取得對應級別的檔案列表 JSON 位址（支援指定分支）
 */
function getFileListUrl(level, branch = null) {
  const useBranch = branch || getCurrentBranch();
  return `https://raw.githubusercontent.com/vizaiweb/word-review/${useBranch}/data/${level}/fileList.json`;
}

/**
 * 取得 Excel 檔案的完整 URL（支援指定分支）
 */
function getXlsxFileUrl(level, filename, branch = null) {
  const useBranch = branch || getCurrentBranch();
  return `https://raw.githubusercontent.com/vizaiweb/word-review/${useBranch}/data/${level}/${filename}`;
}

/**
 * 初始化 Day 下拉選單與數字輸入框的切換邏輯
 */
function initDaySelectToggle() {
  const daySelect = document.getElementById('daySelect');
  const dayNum = document.getElementById('dayNum');

  function updateDayInputState() {
    if (daySelect.value === 'all') {
      dayNum.type = 'text';
      dayNum.value = '--';
      dayNum.readOnly = true;
      dayNum.min = '';
    } else {
      dayNum.type = 'number';
      dayNum.value = '1';
      dayNum.readOnly = false;
      dayNum.min = '1';
    }
  }

  daySelect.addEventListener('change', updateDayInputState);
  updateDayInputState(); // 初始化
}

// ====================== 語音朗讀功能（跨平台優化） ======================
/**
 * 取得可用的語音清單（Promise 包裝，確保聲音載入完成）
 */
function getVoices() {
  return new Promise(resolve => {
    let voices = synth.getVoices();
    if (voices.length) {
      resolve(voices);
    } else {
      synth.onvoiceschanged = () => {
        resolve(synth.getVoices());
        synth.onvoiceschanged = null;
      };
    }
  });
}

/**
 * 智慧選擇英語語音
 * @param {SpeechSynthesisVoice[]} voices - 可用語音清單
 * @returns {SpeechSynthesisVoice|null} 選中的語音，若無則回傳 null
 */
function selectEnglishVoice(voices) {
  // 1. 優先尋找高品質女性英語語音（常見名稱）
  const highQualityFemale = voices.find(voice =>
    voice.lang.includes('en') &&
    (voice.name.includes('Samantha') ||
     voice.name.includes('Google UK') ||
     voice.name.includes('Microsoft') ||
     voice.name.includes('Female') ||
     voice.name.includes('Zira') ||
     voice.name.includes('Siri'))
  );
  if (highQualityFemale) return highQualityFemale;

  // 2. 其次找任何高品質英語語音（不分性別）
  const highQualityAny = voices.find(voice =>
    voice.lang.includes('en') &&
    (voice.name.includes('Google') ||
     voice.name.includes('Microsoft') ||
     voice.name.includes('Daniel') ||
     voice.name.includes('Fred'))
  );
  if (highQualityAny) return highQualityAny;

  // 3. 再找任何英語語音（只要語言是英文）
  const anyEnglish = voices.find(voice => voice.lang.includes('en'));
  if (anyEnglish) return anyEnglish;

  // 4. 完全沒有英語語音，回傳 null
  return null;
}

/**
 * 朗讀指定文字（支援所有平台，自動降級）
 * @param {string} text - 要朗讀的文字
 */
async function speak(text) {
  if (!text) return;

  // 停止目前正在播放的任何語音
  synth.cancel();

  const voices = await getVoices();
  const utterance = new SpeechSynthesisUtterance(text);

  // 基本設定：語言設定為英文，語速放慢適合學習
  utterance.lang = "en-US";
  utterance.rate = 0.8;
  utterance.volume = 1;
  utterance.pitch = 1;

  // 智慧選擇英語語音
  const selectedVoice = selectEnglishVoice(voices);
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  } else {
    // 極罕見情況：裝置完全沒有英語語音，使用系統預設（但發音可能不準）
    console.warn('No English voice found on this device. Using system default, pronunciation may be poor.');
    // 不指定 voice，讓瀏覽器用預設語音
  }

  // 開始朗讀
  synth.speak(utterance);
}

/**
 * 重複朗讀指定文字 3 次（間隔 2 秒）
 * @param {string} word - 要朗讀的單詞
 */
function read3Times(word) {
  clearInterval(window.readTimer); // 清除之前的定時器
  let count = 0;

  // 第一次朗讀
  speak(word);
  count++;

  // 定時重複朗讀
  window.readTimer = setInterval(() => {
    if (count < 3) {
      speak(word);
      count++;
    } else {
      clearInterval(window.readTimer);
    }
  }, 2000);
}

// ====================== 資料載入邏輯（含自動回退 main） ======================
/**
 * 根據級別載入檔案列表（自動回退到 main）
 */
async function loadFileListByLevel(level) {
  const fileSelect = document.getElementById('fileSelect');
  const fileRow = document.getElementById('fileRow');

  fileSelect.innerHTML = '<option value="">Loading...</option>';
  fileRow.style.display = 'flex';

  let branch = getCurrentBranch();
  let res = await fetch(getFileListUrl(level, branch));
  if (!res.ok && branch !== 'main') {
    console.warn(`Failed to load from branch ${branch}, trying main...`);
    res = await fetch(getFileListUrl(level, 'main'));
  }

  try {
    if (!res.ok) throw new Error(`HTTP ${res.status}: 無法載入檔案列表`);

    const config = await res.json();
    const files = config.files || [];

    fileSelect.innerHTML = '';
    if (files.length === 0) {
      fileSelect.innerHTML = '<option value="">No files available</option>';
      return;
    }

    files.forEach(file => {
      const option = document.createElement('option');
      option.value = file;
      option.textContent = removeFileExtension(file);
      fileSelect.appendChild(option);
    });
  } catch (e) {
    fileSelect.innerHTML = '<option value="">Load failed</option>';
    console.error("檔案列表載入失敗:", e);
    alert(`載入檔案列表失敗: ${e.message}`);
  }
}

/**
 * 載入並解析選中的 Excel 檔案（自動回退到 main）
 */
async function loadSelectedFile(filename) {
  if (!filename || !currentLevel) return;

  currentFileName = filename;
  const wordContent = document.getElementById("wordContent");
  wordContent.innerHTML = '<p style="color:#3b82f6;">Loading words...</p>';
  document.getElementById("dayRow").style.display = 'flex';

  let branch = getCurrentBranch();
  let url = getXlsxFileUrl(currentLevel, filename, branch);
  let res = await fetch(url);
  if (!res.ok && branch !== 'main') {
    console.warn(`Failed to load from branch ${branch}, trying main...`);
    url = getXlsxFileUrl(currentLevel, filename, 'main');
    res = await fetch(url);
  }

  try {
    if (!res.ok) throw new Error(`檔案不存在 (${res.status})`);

    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    const rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

    allWords = rawData.filter(item => item.word && item.meaning && item.day).map(item => ({
      word: String(item.word).trim(),
      meaning: String(item.meaning).trim(),
      day: Number(item.day)
    }));

    filteredWords = [...allWords];
    currentIdx = 0;
    showWord();

    document.getElementById('showAllBtn').style.display = 'inline-block';
  } catch (e) {
    wordContent.innerHTML = '<p style="color:#ef4444;">Failed to load words</p>';
    document.getElementById('showAllBtn').style.display = 'none';
    console.error("單詞檔案載入失敗:", e);
    alert(`載入單詞失敗: ${e.message}`);
  }
}

// ====================== 篩選邏輯（Day/All） ======================
function filterByDay() {
  const daySelect = document.getElementById('daySelect');
  const dayNum = document.getElementById('dayNum');

  if (daySelect.value === 'all') {
    filteredWords = JSON.parse(JSON.stringify(allWords));
    currentIdx = 0;
    showWord();
    alert(`✅ Loaded all ${filteredWords.length} words!`);
    return;
  }

  const day = Number(dayNum.value);
  if (isNaN(day) || day < 1) {
    alert('Please enter a valid day number (≥1)!');
    dayNum.focus();
    return;
  }

  filteredWords = allWords.filter(item => item.day === day);
  currentIdx = 0;
  showWord();
}

// ====================== 單詞導航邏輯 ======================
function prevWord() {
  if (currentIdx <= 0) return;
  currentIdx--;
  showWord();
}

function nextWord() {
  currentIdx++;
  showWord();
}

/**
 * 顯示目前單詞（核心渲染函式）
 */
function showWord() {
  clearInterval(window.readTimer); // 清除朗讀定時器
  const el = document.getElementById("wordContent");

  if (filteredWords.length === 0) {
    el.innerHTML = '<p style="color:#ef4444;">No words for this day</p>';
    return;
  }

  if (currentIdx >= filteredWords.length) {
    el.innerHTML = '<p style="color:#22c55e; font-size:24px;">🎉 Practice Complete!</p>';
    return;
  }

  const wordData = filteredWords[currentIdx];
  const isFirstWord = currentIdx <= 0;
  const displayFileName = removeFileExtension(currentFileName);

  el.innerHTML = `
    <div class="meaning">💡 ${wordData.meaning}</div>
    <div class="word" id="currentWord" style="display:none;">${wordData.word.toUpperCase()}</div>
    <div class="btn-group">
      <button class="btn-show" onclick="document.getElementById('currentWord').style.display='block'">👀 Show Word</button>
      <button class="btn-read" onclick="read3Times('${wordData.word}')">🔊 Read 3x</button>
      <button class="btn-prev" onclick="prevWord()" ${isFirstWord ? "disabled" : ""}>⬅️ Previous</button>
      <button class="btn-next" onclick="nextWord()">➡️ Next</button>
    </div>
    <div class="tip">Level: ${currentLevel} | File: ${displayFileName} | Day: ${wordData.day} | ${currentIdx + 1}/${filteredWords.length}</div>
  `;

  // 超長單詞自動縮小字體
  const wordEl = document.getElementById('currentWord');
  if (wordData.word.length > 10) {
    wordEl.style.fontSize = 'clamp(20px, 6vw, 40px)';
  }
}

// ====================== 顯示所有單詞（新視窗） ======================
function showAllWords() {
  if (allWords.length === 0) return;

  const allWordsHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>All Words - ${removeFileExtension(currentFileName)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.8; background: #f0f4f8; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 25px; border-radius: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        h1 { color: #ff9a56; text-align: center; margin-bottom: 20px; font-size: 22px; }
        .word-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .word-table th, .word-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        .word-table th { background: #f8fafc; color: #333; }
        .close-btn { display: block; margin: 20px auto 0; padding: 10px 20px; background: #ff9a56; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; }
        .close-btn:hover { background: #ff6b35; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>All Words - ${currentLevel} | ${removeFileExtension(currentFileName)}</h1>
        <table class="word-table">
           <tr><th>Day</th><th>English Word</th><th>Chinese Meaning</th></tr>
          ${allWords.map(word => `<tr><td>${word.day}</td><td><strong>${word.word.toUpperCase()}</strong></td><td>${word.meaning}</td></tr>`).join('')}
        </table>
        <button class="close-btn" onclick="window.close()">❌ Close Window</button>
      </div>
    </body>
    </html>
  `;

  const newWindow = window.open('', '_blank', 'width=900,height=700');
  newWindow.document.write(allWordsHtml);
  newWindow.document.close();
}

// ====================== 初始化事件綁定 ======================
document.addEventListener('DOMContentLoaded', () => {
  const showAllBtn = document.getElementById('showAllBtn');

  // 初始化 Day 切換邏輯
  initDaySelectToggle();

  // Level 確認按鈕
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

  // File 確認按鈕
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

  // Filter 按鈕（Day/All）
  document.getElementById('filterBtn').addEventListener('click', function() {
    this.style.opacity = '0.7';
    setTimeout(() => this.style.opacity = '1', 200);

    filterByDay();
  });

  // 顯示所有單詞按鈕
  showAllBtn.addEventListener('click', showAllWords);
});
