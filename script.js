// 全局状态变量
let allWords = [];          // 存储当前文件的所有单词
let filteredWords = [];     // 存储筛选后的单词（按Day/All）
let currentIdx = 0;         // 当前显示的单词索引
let currentFileName = "";   // 当前选中的文件名
let currentLevel = "";      // 当前选中的级别(P1/P2)
const synth = window.speechSynthesis; // 语音合成API

// ====================== 新增：动态分支路径工具（核心修复） ======================
function getRawBaseUrl() {
  if (window.location.protocol === 'file:') {
    return 'https://raw.githubusercontent.com/vizaiweb/word-review/main';
  }
  
  const host = window.location.hostname;
  const path = window.location.pathname;

  if (host.includes('dev') || path.includes('dev')) {
    return 'https://raw.githubusercontent.com/vizaiweb/word-review/dev';
  }

  return 'https://raw.githubusercontent.com/vizaiweb/word-review/main';
}

// ====================== 工具函数 ======================
function removeFileExtension(filename) {
  return filename.replace(/\.xlsx$/i, '');
}

function getFileListUrl(level) {
  const base = getRawBaseUrl();
  return `${base}/data/${level}/fileList.json`;
}

function getXlsxFileUrl(level, filename) {
  const base = getRawBaseUrl();
  return `${base}/data/${level}/${filename}`;
}

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
  updateDayInputState();
}

// ====================== 数据加载逻辑 ======================
async function loadFileListByLevel(level) {
  const fileSelect = document.getElementById('fileSelect');
  const fileRow = document.getElementById('fileRow');
  
  fileSelect.innerHTML = '<option value="">Loading...</option>';
  fileRow.style.display = 'flex';
  
  try {
    const res = await fetch(getFileListUrl(level));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
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
    console.error("文件列表加载失败:", e);
  }
}

async function loadSelectedFile(filename) {
  if (!filename || !currentLevel) return;
  
  currentFileName = filename;
  const wordContent = document.getElementById("wordContent");
  wordContent.innerHTML = '<p style="color:#3b82f6;">Loading words...</p>';
  document.getElementById("dayRow").style.display = 'flex';
  
  try {
    const url = getXlsxFileUrl(currentLevel, filename);
    console.log("正在加载 Excel：", url); // 你可以在控制台看到真实路径
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`文件不存在 (${res.status})`);
    
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    const rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
    
    // ✅ 这里修复了笔误 bug！
    allWords = rawData.filter(item => item.word && item.meaning && item.day).map(item => ({
      word: String(item.word).trim(),
      meaning: String(item.meaning).trim(), // 原来写成 meaning 导致报错！
      day: Number(item.day)
    }));
    
    filteredWords = [...allWords];
    currentIdx = 0;
    showWord();
    
    document.getElementById('showAllBtn').style.display = 'inline-block';
    
  } catch (e) {
    wordContent.innerHTML = '<p style="color:#ef4444;">Failed to load words</p>';
    document.getElementById('showAllBtn').style.display = 'none';
    console.error("单词加载失败:", e);
  }
}

// ====================== 筛选逻辑（Day/All） ======================
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

// ====================== 语音朗读功能 ======================
function getVoices() {
  return new Promise(resolve => {
    let voices = synth.getVoices();
    if (voices.length) {
      resolve(voices);
    } else {
      const onVoicesChanged = () => {
        resolve(synth.getVoices());
        synth.onvoiceschanged = null;
      };
      synth.onvoiceschanged = onVoicesChanged;
    }
  });
}

async function speak(text) {
  if (!text) return;
  synth.cancel();
  
  const voices = await getVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  
  utterance.lang = "en-US";
  utterance.rate = 0.8;
  utterance.volume = 1;
  utterance.pitch = 1;
  
  const femaleVoice = voices.find(voice => 
    voice.lang.includes("en") && 
    (voice.name.includes("Female") || voice.name.includes("Samantha") || voice.name.includes("Google") || voice.name.includes("Microsoft"))
  );
  if (femaleVoice) utterance.voice = femaleVoice;
  
  synth.speak(utterance);
}

function read3Times(word) {
  clearInterval(window.readTimer);
  let count = 0;
  
  speak(word);
  count++;
  
  window.readTimer = setInterval(() => {
    if (count < 3) {
      speak(word);
      count++;
    } else {
      clearInterval(window.readTimer);
    }
  }, 2000);
}

// ====================== 单词导航逻辑 ======================
function prevWord() {
  if (currentIdx <= 0) return;
  currentIdx--;
  showWord();
}

function nextWord() {
  currentIdx++;
  showWord();
}

function showWord() {
  clearInterval(window.readTimer);
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
}

// ====================== 显示所有单词 ======================
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
        body { font-family: Arial, sans-serif; padding: 20px; background: #f0f4f8; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 25px; border-radius: 15px; }
        h1 { color: #ff9a56; text-align: center; }
        .word-table { width:100%; border-collapse: collapse; }
        .word-table th, .word-table td { padding:12px; border-bottom:1px solid #e2e8f0; text-align:left; }
        .close-btn { padding:10px 20px; background:#ff9a56; color:white; border:none; border-radius:8px; cursor:pointer; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>All Words - ${currentLevel} | ${removeFileExtension(currentFileName)}</h1>
        <table class="word-table">
          <tr><th>Day</th><th>Word</th><th>Meaning</th></tr>
          ${allWords.map(w => `<tr><td>${w.day}</td><td><strong>${w.word.toUpperCase()}</strong></td><td>${w.meaning}</td></tr>`).join('')}
        </table>
        <button class="close-btn" onclick="window.close()">❌ Close</button>
      </div>
    </body>
    </html>
  `;

  const newWindow = window.open('', '_blank', 'width=900,height=700');
  newWindow.document.write(allWordsHtml);
  newWindow.document.close();
}

// ====================== 初始化 ======================
document.addEventListener('DOMContentLoaded', () => {
  const showAllBtn = document.getElementById('showAllBtn');
  initDaySelectToggle();

  document.getElementById('levelConfirm').addEventListener('click', function() {
    this.style.opacity = '0.7';
    setTimeout(() => this.style.opacity = '1', 200);
    
    const level = document.getElementById('levelSelect').value;
    if (!level) { alert('Please select P1 or P2 first!'); return; }
    currentLevel = level;
    loadFileListByLevel(level);
    showAllBtn.style.display = 'none';
  });

  document.getElementById('fileConfirm').addEventListener('click', function() {
    this.style.opacity = '0.7';
    setTimeout(() => this.style.opacity = '1', 200);
    
    const file = document.getElementById('fileSelect').value;
    const invalid = ["", "Loading...", "No files available", "Load failed"];
    if (invalid.includes(file)) { alert('Please select a valid file!'); return; }
    loadSelectedFile(file);
  });

  document.getElementById('filterBtn').addEventListener('click', function() {
    this.style.opacity = '0.7';
    setTimeout(() => this.style.opacity = '1', 200);
    filterByDay();
  });

  showAllBtn.addEventListener('click', showAllWords);
});
