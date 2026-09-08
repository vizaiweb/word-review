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
let currentCategory = "";   // 新增

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

// ====================== 新增：獲取 Category 下的 Level 列表 ======================
async function loadLevelsByCategory(category) {
    const levelSelect = document.getElementById('levelSelect');
    const fileSelect = document.getElementById('fileSelect');
    
    levelSelect.innerHTML = '<option value="">Loading...</option>';
    fileSelect.innerHTML = '<option value="">Please select level first</option>';
    
    try {
        const base = getRawBaseUrl();
        const url = `${base}/data/${category}/category.json`;
        const res = await fetch(url);
        
        // 處理 404 情況
        if (res.status === 404) {
            levelSelect.innerHTML = '<option value="">No levels available</option>';
            fileSelect.innerHTML = '<option value="">Please select level first</option>';
            
            allWords = [];
            filteredWords = [];
            allSentences = [];
            currentFileName = "";
            currentFileNameForSentences = "";
            currentWordIdx = 0;
            currentSentenceIdx = 0;
            currentLevel = "";
            
            const wordDiv = document.getElementById("wordContent");
            wordDiv.innerHTML = '<p style="color:#f59e0b;">⚠️ No content available for this category.</p>';
            
            document.getElementById("sentenceArea").style.display = 'none';
            document.getElementById("showAllBtn").style.display = 'none';
            document.getElementById("dayRow").style.display = 'none';
            document.getElementById("infoTipContainer").innerHTML = '';
            
            resetDayArea();
            stopAllReading();
            return;
        }
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const config = await res.json();
        const levels = config.levels || [];
        
        levelSelect.innerHTML = '';
        
        if (levels.length === 0) {
            levelSelect.innerHTML = '<option value="">No levels available</option>';
            fileSelect.innerHTML = '<option value="">Please select level first</option>';
            return;
        }
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Please Select';
        levelSelect.appendChild(defaultOption);
        
        levels.forEach(level => {
            const option = document.createElement('option');
            option.value = level;
            option.textContent = level;
            levelSelect.appendChild(option);
        });
        
        levelSelect.value = '';
        fileSelect.innerHTML = '<option value="">Please select level first</option>';
        
        allWords = [];
        filteredWords = [];
        allSentences = [];
        currentFileName = "";
        currentFileNameForSentences = "";
        currentWordIdx = 0;
        currentSentenceIdx = 0;
        currentLevel = "";
        
        const wordDiv = document.getElementById("wordContent");
        wordDiv.innerHTML = '<p style="color:#64748b;">✨ Select Level & File to start ✨</p>';
        
        document.getElementById("sentenceArea").style.display = 'none';
        document.getElementById("showAllBtn").style.display = 'none';
        document.getElementById("dayRow").style.display = 'none';
        document.getElementById("infoTipContainer").innerHTML = '';
        
        resetDayArea();
        stopAllReading();
        
    } catch (e) {
        if (e.message && e.message.includes('404')) {
            levelSelect.innerHTML = '<option value="">No levels available</option>';
        } else {
            levelSelect.innerHTML = '<option value="">Load failed</option>';
        }
        console.error("Level list loading failed:", e);
    }
}

// ====================== 工具函數 ======================
function removeFileExtension(filename) {
    return filename.replace(/\.xlsx$/i, '');
}

// 修改：加入 category 參數
function getFileListUrlWithCategory(category, level) {
    const base = getRawBaseUrl();
    return `${base}/data/${category}/${level}/fileList.json`;
}

// 修改：加入 category 參數
function getXlsxFileUrlWithCategory(category, level, filename) {
    const base = getRawBaseUrl();
    return `${base}/data/${category}/${level}/${filename}`;
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
// 修改：加入 category 參數
async function loadFileListByLevel(category, level) {
    const fileSelect = document.getElementById('fileSelect');
    const fileRow = document.getElementById('fileRow');
    
    fileSelect.innerHTML = '<option value="">Loading...</option>';
    fileRow.style.display = 'flex';
    
    try {
        const res = await fetch(getFileListUrlWithCategory(category, level));
        
        // 處理 404 情況
        if (res.status === 404) {
            fileSelect.innerHTML = '<option value="">No files available for this level</option>';
            
            allWords = [];
            filteredWords = [];
            allSentences = [];
            currentFileName = "";
            currentFileNameForSentences = "";
            currentWordIdx = 0;
            currentSentenceIdx = 0;
            
            const wordDiv = document.getElementById("wordContent");
            wordDiv.innerHTML = '<p style="color:#f59e0b;">⚠️ No files found for this level. Please check back later.</p>';
            
            document.getElementById("sentenceArea").style.display = 'none';
            document.getElementById("showAllBtn").style.display = 'none';
            document.getElementById("dayRow").style.display = 'none';
            document.getElementById("infoTipContainer").innerHTML = '';
            
            resetDayArea();
            stopAllReading();
            return;
        }
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const config = await res.json();
        const files = config.files || [];
        
        fileSelect.innerHTML = '';
        
        if (files.length === 0) {
            fileSelect.innerHTML = '<option value="">No files available</option>';
            
            allWords = [];
            filteredWords = [];
            allSentences = [];
            currentFileName = "";
            currentFileNameForSentences = "";
            currentWordIdx = 0;
            currentSentenceIdx = 0;
            
            const wordDiv = document.getElementById("wordContent");
            wordDiv.innerHTML = '<p style="color:#f59e0b;">⚠️ No files found for this level.</p>';
            
            document.getElementById("sentenceArea").style.display = 'none';
            document.getElementById("showAllBtn").style.display = 'none';
            document.getElementById("dayRow").style.display = 'none';
            document.getElementById("infoTipContainer").innerHTML = '';
            
            resetDayArea();
            stopAllReading();
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
        if (e.message && e.message.includes('404')) {
            fileSelect.innerHTML = '<option value="">No files available for this level</option>';
        } else {
            fileSelect.innerHTML = '<option value="">Load failed</option>';
        }
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

// 修改：加入 category 參數
async function loadSelectedFile(category, filename) {
    if (!filename || !category || !currentLevel) return;
    
    stopAllReading();
    currentFileName = filename;
    currentFileNameForSentences = filename;
    currentCategory = category;
    
    const wordDiv = document.getElementById("wordContent");
    wordDiv.innerHTML = '<p>📖 Loading words & sentences...</p>';
    document.getElementById("dayRow").style.display = 'flex';
    document.getElementById("sentenceArea").style.display = 'none';
    document.getElementById("showAllBtn").style.display = 'none';
    document.getElementById("infoTipContainer").innerHTML = '';
    
    try {
        const url = getXlsxFileUrlWithCategory(category, currentLevel, filename);
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
    const categorySelect = document.getElementById('categorySelect');
    const levelSelect = document.getElementById('levelSelect');
    const fileSelect = document.getElementById('fileSelect');
    const filterBtn = document.getElementById('filterBtn');
    const saveBtn = document.getElementById('saveSettingsBtn');
    
    // Category 變更事件
    if (categorySelect) {
        categorySelect.addEventListener('change', async (e) => {
            const category = e.target.value;
            if (!category) {
                levelSelect.innerHTML = '<option value="">Please Select</option>';
                fileSelect.innerHTML = '<option value="">Please select level first</option>';
                currentCategory = '';
                currentLevel = '';
                return;
            }
            currentCategory = category;
            await loadLevelsByCategory(category);
        });
    }
    
    if (levelSelect) {
        levelSelect.addEventListener('change', async (e) => {
            const level = e.target.value;
            if (!level) return;
            currentLevel = level;
            await loadFileListByLevel(currentCategory, level);
        });
    }
    
    if (fileSelect) {
        fileSelect.addEventListener('change', async (e) => {
            const filename = e.target.value;
            if (!filename || !currentCategory || !currentLevel) return;
            await loadSelectedFile(currentCategory, filename);
        });
    }
    
    if (filterBtn) {
        filterBtn.removeEventListener('click', filterByDay);
        filterBtn.addEventListener('click', function(e) {
            console.log('Filter button clicked!');
            filterByDay();
        });
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const category = currentCategory || '未選擇';
            const level = currentLevel || '未選擇';
            const file = currentFileName || '未選擇';
            
            const daySelect = document.getElementById('daySelect');
            const dayNum = document.getElementById('dayNum');
            const dayFilterMode = daySelect ? daySelect.value : 'all';
            const dayFilterValue = dayFilterMode === 'custom' ? (dayNum ? dayNum.value : '1') : 'all';
            const modeDisplay = dayFilterMode === 'all' ? 'All Words' : 'Custom Day';
            const dayDisplay = dayFilterMode === 'all' ? '--' : 'Day ' + dayFilterValue;
            
            const currentWord = filteredWords[currentWordIdx]?.word || '無';
            const currentSentence = allSentences[currentSentenceIdx]?.sentence_en || '無';
            
            localStorage.setItem('savedCategory', currentCategory || '');
            localStorage.setItem('savedLevel', currentLevel || '');
            localStorage.setItem('savedFile', currentFileName || '');
            localStorage.setItem('savedDayMode', dayFilterMode);
            localStorage.setItem('savedDayValue', dayFilterValue);
            localStorage.setItem('savedWordIdx', currentWordIdx.toString());
            localStorage.setItem('savedSentenceIdx', currentSentenceIdx.toString());
            
            alert(
                '✅ Progress Saved!\n\n' +
                '📊 儲存的參數：\n' +
                '─────────────────────\n' +
                '📂 Category (分類)     : ' + category + '\n' +
                '📁 Level (級別)        : ' + level + '\n' +
                '📄 File (檔案)         : ' + file + '\n' +
                '📋 Mode (模式)         : ' + modeDisplay + '\n' +
                '📅 Day Filter (過濾)   : ' + dayDisplay + '\n' +
                '📍 Current Word (當前)  : ' + currentWord + '\n' +
                '✏️ Current Sentence (當前) : ' + currentSentence + '\n' +
                '─────────────────────\n' +
                '💾 已儲存至瀏覽器！\n' +
                '🔄 下次開啟頁面時會自動載入。'
            );
        });
    }
    
    // ===== 自動載入儲存的進度 =====
    const savedCategory = localStorage.getItem('savedCategory') || '';
    const savedLevel = localStorage.getItem('savedLevel') || '';
    const savedFile = localStorage.getItem('savedFile') || '';
    const savedDayMode = localStorage.getItem('savedDayMode') || 'all';
    const savedDayValue = localStorage.getItem('savedDayValue') || '1';
    const savedWordIdx = parseInt(localStorage.getItem('savedWordIdx')) || 0;
    const savedSentenceIdx = parseInt(localStorage.getItem('savedSentenceIdx')) || 0;
    
    if (savedCategory && savedLevel && savedFile) {
        categorySelect.value = savedCategory;
        currentCategory = savedCategory;
        
        loadLevelsByCategory(savedCategory).then(() => {
            levelSelect.value = savedLevel;
            currentLevel = savedLevel;
            
            loadFileListByLevel(savedCategory, savedLevel).then(() => {
                fileSelect.value = savedFile;
                if (savedFile) {
                    loadSelectedFile(savedCategory, savedFile).then(() => {
                        const daySelect = document.getElementById('daySelect');
                        const dayNum = document.getElementById('dayNum');
                        
                        if (daySelect) {
                            daySelect.value = savedDayMode;
                            daySelect.dispatchEvent(new Event('change'));
                        }
                        if (dayNum) {
                            dayNum.value = savedDayValue;
                        }
                        
                        if (savedDayMode === 'all') {
                            filteredWords = JSON.parse(JSON.stringify(allWords));
                        } else {
                            const day = Number(savedDayValue);
                            if (!isNaN(day) && day > 0) {
                                filteredWords = allWords.filter(item => item.day === day);
                            } else {
                                filteredWords = JSON.parse(JSON.stringify(allWords));
                            }
                        }
                        
                        if (savedWordIdx < filteredWords.length) {
                            currentWordIdx = savedWordIdx;
                        } else {
                            currentWordIdx = 0;
                        }
                        
                        if (savedSentenceIdx < allSentences.length) {
                            currentSentenceIdx = savedSentenceIdx;
                        } else {
                            currentSentenceIdx = 0;
                        }
                        
                        showWord();
                        updateSentenceUI();
                        updateInfoTip();
                        
                        console.log('✅ Progress restored: Category=' + savedCategory + ', Level=' + savedLevel + ', File=' + savedFile + ', Day=' + savedDayMode + ', Value=' + savedDayValue + ', WordIdx=' + savedWordIdx + ', SentenceIdx=' + savedSentenceIdx);
                    });
                }
            });
        });
    }
}

// ====================== 核心模組初始化 ======================
initDaySelectToggle();
document.addEventListener('DOMContentLoaded', function() {
    bindCoreEvents();
});
console.log('✅ Core module loaded successfully');
