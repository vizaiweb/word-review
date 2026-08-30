// ====================== 核心資料載入模組 ======================
// ⚠️ 警告：此檔案包含所有與 Excel 讀取相關的核心函數。
// 為了確保系統穩定性，請勿修改此檔案的任何內容。
// 所有 UI 相關的修改請在 script.js 中進行。

// ====================== 全局狀態變量 ======================
let allWords = [];          
let filteredWords = [];     
let currentWordIdx = 0;     
let currentFileName = "";   
let currentLevel = "";      

let allSentences = [];      
let currentSentenceIdx = 0; 
let currentFileNameForSentences = ""; 

// ====================== 語音引擎（供所有模組使用） ======================
const synth = window.speechSynthesis;

// ====================== 動態分支路徑工具 ======================
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

// ====================== 工具函數 ======================
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

function resetDayArea() {
    const daySelect = document.getElementById('daySelect');
    const dayNum = document.getElementById('dayNum');
    if (daySelect) {
        daySelect.value = 'all';
        daySelect.dispatchEvent(new Event('change'));
    }
}

// ====================== 數據加載邏輯 ======================
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
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Please Select';
        fileSelect.appendChild(defaultOption);
        
        files.forEach(file => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = removeFileExtension(file);
            fileSelect.appendChild(option);
        });
        
        fileSelect.value = '';
        
        allWords = [];
        filteredWords = [];
        allSentences = [];
        currentFileName = "";
        currentFileNameForSentences = "";
        currentWordIdx = 0;
        currentSentenceIdx = 0;
        
        const wordDiv = document.getElementById("wordContent");
        wordDiv.innerHTML = '<p style="color:#64748b;">✨ Select Level & File to start ✨</p>';
        
        document.getElementById("sentenceArea").style.display = 'none';
        document.getElementById("showAllBtn").style.display = 'none';
        document.getElementById("dayRow").style.display = 'none';
        document.getElementById("infoTipContainer").innerHTML = '';
        
        resetDayArea();
        stopAllReading();
        
    } catch (e) {
        fileSelect.innerHTML = '<option value="">Load failed</option>';
        console.error("文件列表加載失敗:", e);
    }
}

async function parseExcelBufferAndLoad(buf, sourceLabel = "file") {
    try {
        const wb = XLSX.read(buf, { type: "array" });
        const sheetName0 = wb.SheetNames[0];
        const wordData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName0]);
        
        allWords = wordData.filter(item => item.word && item.meaning && item.day).map(item => ({
            word: String(item.word).trim(),
            meaning: String(item.meaning).trim(),
            day: Number(item.day),
            englishExplanation: String(item['English explanation'] || '').trim(),
            phonetics: item.phonetics || item.phonetic || item.pronunciation || item.音標 || null,
            syllable: item.syllable || item.syllable_splitting || item.syllables || item.音節 || item.音節劃分 || null
        }));
        
        filteredWords = [...allWords];
        currentWordIdx = 0;
        
        allSentences = [];
        if (wb.SheetNames.length >= 2) {
            const sheetName1 = wb.SheetNames[1];
            const rawSentences = XLSX.utils.sheet_to_json(wb.Sheets[sheetName1]);
            
            if (rawSentences && rawSentences.length > 0) {
                for (let row of rawSentences) {
                    let en = row.sentence || row.sentence_en || row.english || row.en || row.Sentence || row.English;
                    let zh = row.chinese || row.meaning || row.zh || row.sentence_zh || row.Chinese || row.Meaning;
                    
                    if (en && String(en).trim()) {
                        allSentences.push({
                            sentence_en: String(en).trim(),
                            sentence_zh: zh ? String(zh).trim() : "✨ Practice sentence"
                        });
                    }
                }
            }
        }
        
        const wordDiv = document.getElementById("wordContent");
        if (filteredWords.length) {
            showWord();
            updateInfoTip();
        } else {
            wordDiv.innerHTML = '<p>⚠️ No word data in this source.</p>';
        }
        document.getElementById("showAllBtn").style.display = allWords.length ? 'inline-block' : 'none';
        document.getElementById("dayRow").style.display = 'flex';
        
        if (allSentences.length === 0) {
            document.getElementById("sentenceArea").style.display = 'none';
        } else {
            document.getElementById("sentenceArea").style.display = 'block';
            currentSentenceIdx = 0;
            updateSentenceUI();
            updateSentenceStats();
        }
        
        return true;
    } catch (parseErr) {
        console.error("Excel parsing failed", parseErr);
        return false;
    }
}

async function loadSelectedFile(filename) {
    if (!filename || !currentLevel) return;
    
    stopAllReading();
    currentFileName = filename;
    currentFileNameForSentences = filename;
    
    const wordDiv = document.getElementById("wordContent");
    wordDiv.innerHTML = '<p>📖 Loading words & sentences...</p>';
    document.getElementById("dayRow").style.display = 'flex';
    document.getElementById("sentenceArea").style.display = 'none';
    document.getElementById("showAllBtn").style.display = 'none';
    document.getElementById("infoTipContainer").innerHTML = '';
    
    try {
        const url = getXlsxFileUrl(currentLevel, filename);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        await parseExcelBufferAndLoad(buf, filename);
    } catch (err) {
        wordDiv.innerHTML = '<p style="color:#ef4444;">❌ Failed to load file.</p>';
        document.getElementById("sentenceArea").style.display = 'none';
        console.error(err);
    }
}

// ====================== 核心功能初始化 ======================
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

function bindCoreEvents() {
    const levelSelect = document.getElementById('levelSelect');
    const fileSelect = document.getElementById('fileSelect');
    const filterBtn = document.getElementById('filterBtn');
    const saveBtn = document.getElementById('saveSettingsBtn');
    
    if (levelSelect) {
        levelSelect.addEventListener('change', async (e) => {
            const level = e.target.value;
            if (!level) return;
            currentLevel = level;
            await loadFileListByLevel(level);
        });
    }
    
    if (fileSelect) {
        fileSelect.addEventListener('change', async (e) => {
            const filename = e.target.value;
            if (!filename || !currentLevel) return;
            await loadSelectedFile(filename);
        });
    }
    
    if (filterBtn) {
        // 移除可能存在的舊監聽器
        filterBtn.removeEventListener('click', filterByDay);
        // 綁定新監聽器
        filterBtn.addEventListener('click', function(e) {
            console.log('Filter button clicked!'); // 測試用
            filterByDay();
        });
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            localStorage.setItem('savedLevel', currentLevel);
            localStorage.setItem('savedFile', currentFileName);
            alert('Progress saved!');
        });
    }
    
    const savedLevel = localStorage.getItem('savedLevel');
    const savedFile = localStorage.getItem('savedFile');
    if (savedLevel && savedFile) {
        levelSelect.value = savedLevel;
        currentLevel = savedLevel;
        loadFileListByLevel(savedLevel).then(() => {
            fileSelect.value = savedFile;
            if (savedFile) loadSelectedFile(savedFile);
        });
    }
}

// ====================== 核心模組初始化 ======================
initDaySelectToggle();
document.addEventListener('DOMContentLoaded', function() {
    bindCoreEvents();
});
console.log('✅ Core module loaded successfully');
