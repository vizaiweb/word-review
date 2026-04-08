// 全局状态变量
let allWords = [];          
let filteredWords = [];     
let currentWordIdx = 0;     
let currentFileName = "";   
let currentLevel = "";      

let allSentences = [];      
let currentSentenceIdx = 0; 
let currentFileNameForSentences = ""; 
let currentExternalUrl = ""; 
let currentMode = "local";   

const synth = window.speechSynthesis;

let wordReadTimer = null;
let sentenceReadTimer = null;
let isSentenceReading = false;
let currentReadButton = null;

// ====================== 本地存储键名常量 ======================
const STORAGE_KEYS = {
    MODE: 'wordReview_mode',
    LEVEL: 'wordReview_level',
    FILE_NAME: 'wordReview_fileName',
    EXTERNAL_URL: 'wordReview_externalUrl',
    WORD_INDEX: 'wordReview_wordIndex',
    SENTENCE_INDEX: 'wordReview_sentenceIndex',
    DAY_MODE: 'wordReview_dayMode',
    DAY_NUMBER: 'wordReview_dayNumber'
};

// ====================== 本地存储功能 ======================
function saveCurrentState() {
    console.log('🔵 saveCurrentState 被调用了！');
    const daySelect = document.getElementById('daySelect');
    const dayNum = document.getElementById('dayNum');
    
    const state = {
        mode: currentMode,
        level: currentLevel,
        fileName: currentFileName,
        externalUrl: currentExternalUrl,
        wordIndex: currentWordIdx,
        sentenceIndex: currentSentenceIdx,
        dayMode: daySelect ? daySelect.value : 'all',
        dayNumber: dayNum ? dayNum.value : '1'
    };
    
    try {
        localStorage.setItem(STORAGE_KEYS.MODE, state.mode);
        localStorage.setItem(STORAGE_KEYS.LEVEL, state.level);
        localStorage.setItem(STORAGE_KEYS.FILE_NAME, state.fileName);
        localStorage.setItem(STORAGE_KEYS.EXTERNAL_URL, state.externalUrl);
        localStorage.setItem(STORAGE_KEYS.WORD_INDEX, state.wordIndex);
        localStorage.setItem(STORAGE_KEYS.SENTENCE_INDEX, state.sentenceIndex);
        localStorage.setItem(STORAGE_KEYS.DAY_MODE, state.dayMode);
        localStorage.setItem(STORAGE_KEYS.DAY_NUMBER, state.dayNumber);
        console.log('✅ State saved:', state);
    } catch (e) {
        console.error('Failed to save state:', e);
    }
}

function loadSavedState() {
    try {
        const savedMode = localStorage.getItem(STORAGE_KEYS.MODE);
        const savedLevel = localStorage.getItem(STORAGE_KEYS.LEVEL);
        const savedFileName = localStorage.getItem(STORAGE_KEYS.FILE_NAME);
        const savedExternalUrl = localStorage.getItem(STORAGE_KEYS.EXTERNAL_URL);
        const savedWordIndex = localStorage.getItem(STORAGE_KEYS.WORD_INDEX);
        const savedSentenceIndex = localStorage.getItem(STORAGE_KEYS.SENTENCE_INDEX);
        const savedDayMode = localStorage.getItem(STORAGE_KEYS.DAY_MODE);
        const savedDayNumber = localStorage.getItem(STORAGE_KEYS.DAY_NUMBER);
        
        return {
            mode: savedMode || 'local',
            level: savedLevel || '',
            fileName: savedFileName || '',
            externalUrl: savedExternalUrl || '',
            wordIndex: savedWordIndex ? parseInt(savedWordIndex) : 0,
            sentenceIndex: savedSentenceIndex ? parseInt(savedSentenceIndex) : 0,
            dayMode: savedDayMode || 'all',
            dayNumber: savedDayNumber || '1'
        };
    } catch (e) {
        console.error('Failed to load state:', e);
        return {
            mode: 'local',
            level: '',
            fileName: '',
            externalUrl: '',
            wordIndex: 0,
            sentenceIndex: 0,
            dayMode: 'all',
            dayNumber: '1'
        };
    }
}

function restoreDaySelectState(dayMode, dayNumber) {
    const daySelect = document.getElementById('daySelect');
    const dayNum = document.getElementById('dayNum');
    
    if (daySelect && dayNum) {
        daySelect.value = dayMode;
        const changeEvent = new Event('change');
        daySelect.dispatchEvent(changeEvent);
        if (dayMode === 'custom') {
            dayNum.value = dayNumber;
        }
    }
}

async function applySavedState(savedState) {
    console.log('🔄 Applying saved state:', savedState);
    
    if (savedState.mode === 'external') {
        const toggleBtn = document.getElementById('modeToggleBtn');
        if (toggleBtn && currentMode !== 'external') {
            toggleBtn.click();
        }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (savedState.mode === 'local') {
        if (savedState.level) {
            const levelSelect = document.getElementById('levelSelect');
            if (levelSelect) {
                levelSelect.value = savedState.level;
                currentLevel = savedState.level;
                await loadFileListByLevel(savedState.level);
                await new Promise(resolve => setTimeout(resolve, 300));
                
                if (savedState.fileName) {
                    const fileSelect = document.getElementById('fileSelect');
                    const fileOptions = Array.from(fileSelect.options);
                    const fileExists = fileOptions.some(opt => opt.value === savedState.fileName);
                    
                    if (fileExists) {
                        fileSelect.value = savedState.fileName;
                        await loadSelectedFile(savedState.fileName);
                        await new Promise(resolve => setTimeout(resolve, 500));
                        restoreDaySelectState(savedState.dayMode, savedState.dayNumber);
                        
                        if (savedState.dayMode === 'custom') {
                            filterByDay();
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                        
                        if (filteredWords.length > 0 && savedState.wordIndex < filteredWords.length) {
                            currentWordIdx = savedState.wordIndex;
                            showWord();
                        }
                        
                        if (allSentences.length > 0 && savedState.sentenceIndex < allSentences.length) {
                            currentSentenceIdx = savedState.sentenceIndex;
                            updateSentenceUI();
                        }
                    }
                }
            }
        }
    } else if (savedState.mode === 'external' && savedState.externalUrl) {
        const urlInput = document.getElementById('externalUrlInput');
        if (urlInput) {
            urlInput.value = savedState.externalUrl;
            await loadFromExternalUrl(savedState.externalUrl);
            await new Promise(resolve => setTimeout(resolve, 500));
            restoreDaySelectState(savedState.dayMode, savedState.dayNumber);
            
            if (savedState.dayMode === 'custom') {
                filterByDay();
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            if (filteredWords.length > 0 && savedState.wordIndex < filteredWords.length) {
                currentWordIdx = savedState.wordIndex;
                showWord();
            }
            
            if (allSentences.length > 0 && savedState.sentenceIndex < allSentences.length) {
                currentSentenceIdx = savedState.sentenceIndex;
                updateSentenceUI();
            }
        }
    }
}

// ====================== 动态分支路径工具 ======================
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

function speakTextWithCallback(text, onEnd, rate = 0.8) {
    if (!text) {
        if (onEnd) onEnd();
        return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = rate;
    utterance.volume = 1;
    utterance.pitch = 1;
    
    getVoices().then(voices => {
        const femaleVoice = voices.find(voice => 
            voice.lang.includes("en") && 
            (voice.name.includes("Female") || voice.name.includes("Samantha") || voice.name.includes("Google") || voice.name.includes("Microsoft"))
        );
        if (femaleVoice) utterance.voice = femaleVoice;
        
        utterance.onend = () => { if (onEnd) onEnd(); };
        utterance.onerror = () => { if (onEnd) onEnd(); };
        synth.speak(utterance);
    });
}

function read3Times(word) {
    if (wordReadTimer) clearInterval(wordReadTimer);
    synth.cancel();
    let count = 0;
    
    function speakNext() {
        if (count >= 3) return;
        speakTextWithCallback(word, () => {
            count++;
            if (count < 3) speakNext();
        }, 0.8);
    }
    speakNext();
}

function readSentence3Times(sentenceText, buttonElement) {
    if (!sentenceText) return;
    if (sentenceReadTimer) clearInterval(sentenceReadTimer);
    if (isSentenceReading) {
        synth.cancel();
        isSentenceReading = false;
        if (currentReadButton) {
            currentReadButton.classList.remove('reading-disabled');
            currentReadButton.disabled = false;
        }
    }
    
    currentReadButton = buttonElement;
    if (currentReadButton) {
        currentReadButton.classList.add('reading-disabled');
        currentReadButton.disabled = true;
    }
    
    let readCount = 0;
    isSentenceReading = true;
    
    function speakNext() {
        if (readCount >= 3) {
            if (currentReadButton) {
                currentReadButton.classList.remove('reading-disabled');
                currentReadButton.disabled = false;
            }
            isSentenceReading = false;
            currentReadButton = null;
            return;
        }
        speakTextWithCallback(sentenceText, () => {
            readCount++;
            speakNext();
        }, 0.8);
    }
    
    synth.cancel();
    speakNext();
}

function stopAllReading() {
    synth.cancel();
    if (wordReadTimer) clearInterval(wordReadTimer);
    if (sentenceReadTimer) clearInterval(sentenceReadTimer);
    if (isSentenceReading) {
        isSentenceReading = false;
        if (currentReadButton) {
            currentReadButton.classList.remove('reading-disabled');
            currentReadButton.disabled = false;
            currentReadButton = null;
        }
    }
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

async function parseExcelBufferAndLoad(buf, sourceLabel = "file") {
    try {
        const wb = XLSX.read(buf, { type: "array" });
        const sheetName0 = wb.SheetNames[0];
        const wordData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName0]);
        
        allWords = wordData.filter(item => item.word && item.meaning && item.day).map(item => ({
            word: String(item.word).trim(),
            meaning: String(item.meaning).trim(),
            day: Number(item.day)
        }));
        
        console.log(`✅ Successfully loaded ${allWords.length} words`);
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
                console.log(`✅ Successfully loaded ${allSentences.length} sentences`);
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
        
        saveCurrentState();
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
    currentExternalUrl = "";
    
    const wordDiv = document.getElementById("wordContent");
    wordDiv.innerHTML = '<p>📖 Loading words & sentences...</p>';
    document.getElementById("dayRow").style.display = 'flex';
    document.getElementById("sentenceArea").style.display = 'none';
    document.getElementById("showAllBtn").style.display = 'none';
    document.getElementById("infoTipContainer").innerHTML = '';
    
    try {
        const url = getXlsxFileUrl(currentLevel, filename);
        console.log("正在加载 Excel：", url);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const success = await parseExcelBufferAndLoad(buf, filename);
        if (!success) {
            wordDiv.innerHTML = '<p>❌ Invalid file format</p>';
        }
    } catch (err) {
        wordDiv.innerHTML = '<p style="color:#ef4444;">❌ Failed to load file.</p>';
        document.getElementById("sentenceArea").style.display = 'none';
        console.error(err);
    }
}

async function loadFromExternalUrl(url) {
    if (!url) {
        alert("Please enter a valid Excel direct link (.xlsx)");
        return false;
    }
    
    stopAllReading();
    currentFileName = "";
    currentFileNameForSentences = url;
    currentExternalUrl = url;
    currentLevel = "";
    
    const wordDiv = document.getElementById("wordContent");
    wordDiv.innerHTML = '<p>🌐 Loading external Excel file ...</p>';
    document.getElementById("dayRow").style.display = 'none';
    document.getElementById("sentenceArea").style.display = 'none';
    document.getElementById("showAllBtn").style.display = 'none';
    document.getElementById("infoTipContainer").innerHTML = '';
    
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const success = await parseExcelBufferAndLoad(buf, url);
        if (success) {
            const tipDiv = document.getElementById("infoTipContainer");
            if (tipDiv && filteredWords.length) {
                const shortUrl = url.length > 60 ? url.substring(0, 57) + "..." : url;
                tipDiv.innerHTML = `🔗 External: ${shortUrl} | ${filteredWords.length} words | Sentences: ${allSentences.length}`;
            }
            saveCurrentState();
            return true;
        } else {
            throw new Error("Parse failed, please check file format");
        }
    } catch (err) {
        wordDiv.innerHTML = `<p style="color:#ef4444;">❌ Load failed: ${err.message}<br>Please ensure you provide a raw Excel download link</p>`;
        document.getElementById("sentenceArea").style.display = 'none';
        document.getElementById("showAllBtn").style.display = 'none';
        console.error(err);
        return false;
    }
}

// ====================== 筛选逻辑（Day/All） ======================
function filterByDay() {
    stopAllReading();
    const daySelect = document.getElementById('daySelect');
    const dayNum = document.getElementById('dayNum');
    
    if (daySelect.value === 'all') {
        filteredWords = JSON.parse(JSON.stringify(allWords));
        currentWordIdx = 0;
        showWord();
        alert(`✅ Loaded all ${filteredWords.length} words!`);
    } else {
        const day = Number(dayNum.value);
        if (isNaN(day) || day < 1) {
            alert('Please enter a valid day number (≥1)!');
            dayNum.focus();
            return;
        }
        filteredWords = allWords.filter(item => item.day === day);
        if (filteredWords.length === 0) {
            alert(`No words for Day ${day}.`);
        }
        currentWordIdx = 0;
        showWord();
    }
    updateInfoTip();
    saveCurrentState();
}

// ====================== 单词导航逻辑 ======================
function showWord() {
    stopAllReading();
    const container = document.getElementById("wordContent");
    
    if (filteredWords.length === 0) {
        container.innerHTML = '<p style="color:#ef4444;">No words for this day</p>';
        updateInfoTip();
        return;
    }
    
    if (currentWordIdx >= filteredWords.length) {
        container.innerHTML = '<p style="color:#22c55e; font-size:24px;">🎉 Practice Complete!</p>';
        updateInfoTip();
        return;
    }
    
    const w = filteredWords[currentWordIdx];
    const isFirst = currentWordIdx === 0;
    
    container.innerHTML = `
        <div class="meaning">💡 ${w.meaning}</div>
        <div class="word" id="currentWordSpan" style="display:none;">${w.word.toUpperCase()}</div>
        <div class="btn-group">
            <button class="btn-show" id="btnShowWord">👀 Show Word</button>
            <button class="btn-read" id="btnReadWord">🔊 Read 3x</button>
            <button class="btn-prev" id="btnPrevWord" ${isFirst ? "disabled" : ""}>⬅️ Previous</button>
            <button class="btn-next" id="btnNextWord">➡️ Next</button>
        </div>
    `;
    
    updateInfoTip();
    
    document.getElementById("btnShowWord")?.addEventListener("click", () => {
        const span = document.getElementById("currentWordSpan");
        if (span) span.style.display = "block";
    });
    
    document.getElementById("btnReadWord")?.addEventListener("click", () => read3Times(w.word));
    
    document.getElementById("btnPrevWord")?.addEventListener("click", () => {
        if (currentWordIdx > 0) {
            currentWordIdx--;
            showWord();
            saveCurrentState();
        }
    });
    
    document.getElementById("btnNextWord")?.addEventListener("click", () => {
        if (currentWordIdx + 1 <= filteredWords.length) {
            currentWordIdx++;
            showWord();
            saveCurrentState();
        }
    });
}

function updateInfoTip() {
    const container = document.getElementById('infoTipContainer');
    if (!container) return;
    
    if (currentMode === "local" && currentFileName && filteredWords.length && filteredWords[currentWordIdx]) {
        const displayFile = removeFileExtension(currentFileName);
        const currentWord = filteredWords[currentWordIdx];
        container.innerHTML = `${displayFile} | Day ${currentWord.day} | ${currentWordIdx + 1}/${filteredWords.length} words | ✏️ Sentences: ${allSentences.length}`;
    } else if (currentMode === "external" && currentExternalUrl && filteredWords.length && filteredWords[currentWordIdx]) {
        const currentWord = filteredWords[currentWordIdx];
        container.innerHTML = `🔗 External | Day ${currentWord.day} | ${currentWordIdx + 1}/${filteredWords.length} words | ✏️ Sentences: ${allSentences.length}`;
    } else if (allSentences.length > 0) {
        container.innerHTML = `✨ Total ${allSentences.length} sentences available ✨`;
    } else {
        container.innerHTML = '';
    }
}

// ====================== 显示所有单词 ======================
function showAllWords() {
    if (allWords.length === 0) return;
    
    const fileNice = currentMode === "local" ? removeFileExtension(currentFileName) : "External Link";
    const tableRows = allWords.map(w => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #ffcd94; text-align: center;">${w.day}</td>
            <td style="padding: 12px; border-bottom: 1px solid #ffcd94;"><strong>${w.word.toUpperCase()}</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #ffcd94;">${w.meaning}</td>
        </tr>
    `).join('');
    
    const allWordsHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>All Words - ${fileNice}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    padding: 30px 20px;
                    background: linear-gradient(135deg, #fef3e8 0%, #fff5eb 100%);
                    min-height: 100vh;
                }
                .container {
                    max-width: 900px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    overflow: hidden;
                }
                h2 {
                    background: linear-gradient(135deg, #ff9a56, #ff6b35);
                    color: white;
                    padding: 20px;
                    margin: 0;
                    text-align: center;
                    font-size: 24px;
                }
                .word-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .word-table th {
                    background: #ff9a56;
                    color: white;
                    padding: 14px 12px;
                    font-weight: bold;
                    font-size: 16px;
                    text-align: left;
                }
                .word-table td {
                    padding: 12px;
                    border-bottom: 1px solid #ffe0b5;
                }
                .word-table tr:hover {
                    background: #fff7ed;
                }
                .close-btn {
                    display: block;
                    width: 120px;
                    margin: 20px auto;
                    padding: 10px 20px;
                    background: #ff6b35;
                    color: white;
                    border: none;
                    border-radius: 30px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: transform 0.1s;
                }
                .close-btn:hover {
                    transform: scale(1.02);
                    background: #ff8c5a;
                }
                .stats {
                    text-align: center;
                    padding: 12px;
                    background: #fff1e0;
                    color: #b45f2b;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>📖 ${currentLevel} - ${fileNice} (All Words)</h2>
                <div class="stats">✨ Total: ${allWords.length} words ✨</div>
                <table class="word-table">
                    <thead>
                        <tr>
                            <th style="width: 80px;">Day</th>
                            <th>Word</th>
                            <th>Meaning</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                <button class="close-btn" onclick="window.close()">Close</button>
            </div>
        </body>
        </html>
    `;
    
    const newWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
    newWindow.document.write(allWordsHtml);
    newWindow.document.close();
}

// ====================== 句子相关功能 ======================
function updateSentenceUI() {
    if (!allSentences.length) return;
    
    const sent = allSentences[currentSentenceIdx];
    const meaningDiv = document.querySelector("#sentenceContent .sentence-meaning");
    const enSpan = document.getElementById("sentenceEnHidden");
    
    if (meaningDiv) meaningDiv.innerHTML = `📖 ${sent.sentence_zh}`;
    if (enSpan) {
        enSpan.innerText = sent.sentence_en;
        enSpan.style.display = "none";
    }
    
    const tipSpan = document.getElementById("sentenceTip");
    if (tipSpan) tipSpan.innerText = `📌 ${currentSentenceIdx + 1} / ${allSentences.length} sentences`;
    
    updateSentenceStats();
    
    const prevBtn = document.getElementById("prevSentenceBtn");
    if (prevBtn) prevBtn.disabled = currentSentenceIdx === 0;
    
    attachSentenceEvents();
}

function updateSentenceStats() {
    const statsSpan = document.getElementById("sentenceStats");
    if (statsSpan) statsSpan.innerText = `${allSentences.length} sentences`;
}

function showCurrentSentence() {
    const hiddenSpan = document.getElementById("sentenceEnHidden");
    if (hiddenSpan) hiddenSpan.style.display = "block";
}

function prevSentence() {
    if (allSentences.length && currentSentenceIdx > 0) {
        currentSentenceIdx--;
        updateSentenceUI();
        stopAllReading();
        saveCurrentState();
    }
}

function nextSentence() {
    if (allSentences.length && currentSentenceIdx < allSentences.length - 1) {
        currentSentenceIdx++;
        updateSentenceUI();
        stopAllReading();
        saveCurrentState();
    } else if (allSentences.length) {
        alert("🎉 You've completed all sentences!");
    }
}

function showAllSentencesPopup() {
    if (!allSentences.length) return;
    
    const fileNice = currentMode === "local" ? removeFileExtension(currentFileNameForSentences) : "External Link";
    const tableRows = allSentences.map((s, idx) => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #ffcd94; text-align: center; width: 70px;">${idx + 1}</td>
            <td style="padding: 12px; border-bottom: 1px solid #ffcd94;"><strong>${s.sentence_en}</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #ffcd94;">${s.sentence_zh}</td>
        </tr>
    `).join('');
    
    const winHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>All Sentences - ${fileNice}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    padding: 30px 20px;
                    background: linear-gradient(135deg, #fef3e8 0%, #fff5eb 100%);
                    min-height: 100vh;
                }
                .container {
                    max-width: 1000px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    overflow: hidden;
                }
                h2 {
                    background: linear-gradient(135deg, #ff9a56, #ff6b35);
                    color: white;
                    padding: 20px;
                    margin: 0;
                    text-align: center;
                    font-size: 24px;
                }
                .sentence-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .sentence-table th {
                    background: #ff9a56;
                    color: white;
                    padding: 14px 12px;
                    font-weight: bold;
                    font-size: 16px;
                    text-align: left;
                }
                .sentence-table td {
                    padding: 12px;
                    border-bottom: 1px solid #ffe0b5;
                    vertical-align: top;
                }
                .sentence-table tr:hover {
                    background: #fff7ed;
                }
                .close-btn {
                    display: block;
                    width: 120px;
                    margin: 20px auto;
                    padding: 10px 20px;
                    background: #ff6b35;
                    color: white;
                    border: none;
                    border-radius: 30px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: transform 0.1s;
                }
                .close-btn:hover {
                    transform: scale(1.02);
                    background: #ff8c5a;
                }
                .stats {
                    text-align: center;
                    padding: 12px;
                    background: #fff1e0;
                    color: #b45f2b;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>📝 ${currentLevel} - ${fileNice} (All Sentences)</h2>
                <div class="stats">✨ Total: ${allSentences.length} sentences ✨</div>
                <table class="sentence-table">
                    <thead>
                        <tr>
                            <th style="width: 70px;">#</th>
                            <th>English Sentence</th>
                            <th>Chinese</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                <button class="close-btn" onclick="window.close()">Close</button>
            </div>
        </body>
        </html>`;
    
    const win = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
    win.document.write(winHtml);
    win.document.close();
}

function attachSentenceEvents() {
    const showBtn = document.getElementById("showSentenceBtn");
    const readBtn = document.getElementById("readSentenceBtn");
    const prevBtn = document.getElementById("prevSentenceBtn");
    const nextBtn = document.getElementById("nextSentenceBtn");
    const allBtn = document.getElementById("showAllSentencesBtn");
    
    if (showBtn) showBtn.onclick = () => showCurrentSentence();
    if (readBtn) readBtn.onclick = () => {
        const currentSent = allSentences[currentSentenceIdx];
        if (currentSent) readSentence3Times(currentSent.sentence_en, readBtn);
    };
    if (prevBtn) prevBtn.onclick = () => prevSentence();
    if (nextBtn) nextBtn.onclick = () => nextSentence();
    if (allBtn) allBtn.onclick = () => showAllSentencesPopup();
}

// ====================== 模式切换 ======================
function toggleMode(mode) {
    currentMode = mode;
    const fileRow = document.getElementById('fileRow');
    const externalRow = document.getElementById('externalUrlRow');
    const levelRow = document.getElementById('levelRow');
    const toggleBtn = document.getElementById('modeToggleBtn');
    const dayRow = document.getElementById('dayRow');
    
    if (mode === "local") {
        fileRow.style.display = 'flex';
        externalRow.style.display = 'none';
        levelRow.classList.remove('hidden-level');
        toggleBtn.textContent = "📁 Built-in DB";
        toggleBtn.classList.add('active');
        
        if (currentExternalUrl) {
            allWords = [];
            filteredWords = [];
            allSentences = [];
            document.getElementById("wordContent").innerHTML = '<p style="color:#64748b;">✨ Switched to built-in mode, please select Level and file ✨</p>';
            document.getElementById("sentenceArea").style.display = 'none';
            document.getElementById("showAllBtn").style.display = 'none';
            dayRow.style.display = 'none';
            document.getElementById("infoTipContainer").innerHTML = '';
            currentLevel = "";
        }
    } else {
        fileRow.style.display = 'none';
        externalRow.style.display = 'flex';
        levelRow.classList.add('hidden-level');
        toggleBtn.textContent = "🌐 External Link";
        toggleBtn.classList.remove('active');
        
        if (currentFileName && allWords.length > 0) {
            allWords = [];
            filteredWords = [];
            allSentences = [];
            document.getElementById("wordContent").innerHTML = '<p>🔗 External mode activated, paste Excel direct link and click Load</p>';
            document.getElementById("sentenceArea").style.display = 'none';
            document.getElementById("showAllBtn").style.display = 'none';
            dayRow.style.display = 'none';
            document.getElementById("infoTipContainer").innerHTML = '';
            currentLevel = "";
        }
    }
    
    saveCurrentState();
}

function clearSavedState() {
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
    console.log('All saved states cleared');
}

// ====================== 初始化 ======================
document.addEventListener('DOMContentLoaded', async () => {
    initDaySelectToggle();
    
    if (synth.getVoices().length === 0) {
        synth.onvoiceschanged = () => {};
    }
    
    const showAllBtn = document.getElementById('showAllBtn');
    const levelConfirm = document.getElementById('levelConfirm');
    const fileConfirm = document.getElementById('fileConfirm');
    const filterBtn = document.getElementById('filterBtn');
    const modeToggle = document.getElementById('modeToggleBtn');
    const externalConfirm = document.getElementById('externalUrlConfirmBtn');
    
    modeToggle.addEventListener('click', () => {
        if (currentMode === "local") toggleMode("external");
        else toggleMode("local");
    });
    
    levelConfirm.addEventListener('click', function() {
        this.style.opacity = '0.7';
        setTimeout(() => this.style.opacity = '1', 200);
        
        if (currentMode !== "local") return;
        stopAllReading();
        
        const level = document.getElementById('levelSelect').value;
        if (!level) {
            alert('Please select P1 or P2 first!');
            return;
        }
        
        currentLevel = level;
        loadFileListByLevel(level);
        
        document.getElementById("sentenceArea").style.display = 'none';
        document.getElementById("wordContent").innerHTML = '<p>✅ Level selected, choose a file.</p>';
        document.getElementById("showAllBtn").style.display = 'none';
        document.getElementById("infoTipContainer").innerHTML = '';
        
        allWords = [];
        filteredWords = [];
        allSentences = [];
        
        saveCurrentState();
    });
    
    fileConfirm.addEventListener('click', async function() {
        this.style.opacity = '0.7';
        setTimeout(() => this.style.opacity = '1', 200);
        
        if (currentMode !== "local") return;
        
        const fileSelect = document.getElementById('fileSelect');
        const selected = fileSelect.value;
        const invalid = ["", "Loading...", "No files available", "Load failed"];
        
        if (invalid.includes(selected)) {
            alert('Please select a valid file!');
            return;
        }
        
        await loadSelectedFile(selected);
    });
    
    externalConfirm.addEventListener('click', async () => {
        if (currentMode !== "external") return;
        
        let url = document.getElementById('externalUrlInput').value.trim();
        if (!url) {
            alert("Please enter a valid Excel direct link (.xlsx)");
            return;
        }
        
        if (url.includes("github.com") && url.includes("/blob/")) {
            url = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
            document.getElementById('externalUrlInput').value = url;
        }
        
        await loadFromExternalUrl(url);
    });
    
    filterBtn.addEventListener('click', function() {
        this.style.opacity = '0.7';
        setTimeout(() => this.style.opacity = '1', 200);
        filterByDay();
    });
    
    showAllBtn.addEventListener('click', showAllWords);
    
    toggleMode("local");
    
    const savedState = loadSavedState();
    if (savedState.mode === 'local' && savedState.level) {
        setTimeout(() => {
            applySavedState(savedState);
        }, 500);
    } else if (savedState.mode === 'external' && savedState.externalUrl) {
        setTimeout(() => {
            applySavedState(savedState);
        }, 500);
    }
});
