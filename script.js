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

// 朗读相关变量
let wordReadTimer = null;
let sentenceReadTimer = null;
let isWordReading = false;
let isSentenceReading = false;
let currentWordReadButton = null;
let currentSentenceReadButton = null;
let currentWordText = "";
let currentSentenceText = "";
let isStopping = false;
let pendingStart = null;

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

// ====================== 语音朗读功能 (已升级) ======================

/**
 * 獲取高品質語音：優先尋找 Google、Natural 或高品質美式英語
 */
// ====================== 語音功能 (手機兼容強化版) ======================

// ====================== 終極兼容版語音邏輯 ======================

function getHighQualityVoice() {
    return new Promise(resolve => {
        let voices = synth.getVoices();
        
        const findBest = (vList) => {
            // 優先順序調整：針對手機優化
            return vList.find(v => v.name.includes('Google US English')) || // Android Chrome
                   vList.find(v => v.name.includes('Samantha') && v.name.includes('Premium')) || // iOS 高品質
                   vList.find(v => v.name.includes('Samantha')) || // iOS 標準
                   vList.find(v => v.lang === 'en-US' && v.localService === true) || // 本地美語
                   vList.find(v => v.lang.includes('en-US')) ||
                   vList[0];
        };

        if (voices.length > 0) {
            resolve(findBest(voices));
        } else {
            // 關鍵：某些手機瀏覽器必須監聽此事件才能抓到聲音
            const timer = setTimeout(() => resolve(null), 1000); // 防止死等
            synth.onvoiceschanged = () => {
                clearTimeout(timer);
                resolve(findBest(synth.getVoices()));
            };
        }
    });
}

// 修正朗讀邏輯：增加「喚醒」步驟
async function speakTextWithCallback(text, onEnd) {
    if (!text || isStopping) {
        onEnd?.();
        return;
    }

    // 解決手機連讀問題：先取消，再強制重新實例化
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const bestVoice = await getHighQualityVoice();
    
    if (bestVoice) {
        utterance.voice = bestVoice;
        utterance.voiceURI = bestVoice.voiceURI; // 強制指定路徑
    }

    utterance.lang = "en-US";
    utterance.rate = 0.85; 
    utterance.pitch = 1.0;
    
    utterance.onend = () => { if (!isStopping) onEnd?.(); };
    utterance.onerror = () => { if (!isStopping) onEnd?.(); };

    // 手機版的小技巧：稍微延遲 50 毫秒給系統切換聲音
    setTimeout(() => {
        synth.speak(utterance);
    }, 50);
}

function stopWordReading() {
    if (isStopping) return;
    isStopping = true;
    isWordReading = false; 
    
    if (currentWordReadButton) {
        currentWordReadButton.textContent = "🔊 Read 3x";
        currentWordReadButton.classList.remove('reading-disabled');
        currentWordReadButton = null;
    }
    
    synth.cancel();
    currentWordText = "";
    
    setTimeout(() => { isStopping = false; }, 300);
}

function stopSentenceReading() {
    if (isStopping) return;
    isStopping = true;
    isSentenceReading = false;

    if (currentSentenceReadButton) {
        currentSentenceReadButton.textContent = "🔊 Read 3x";
        currentSentenceReadButton.classList.remove('reading-disabled');
        currentSentenceReadButton = null;
    }

    synth.cancel();
    currentSentenceText = "";
    
    setTimeout(() => { isStopping = false; }, 300);
}

function stopAllReading() {
    stopWordReading();
    stopSentenceReading();
}

function toggleWordReading(word, buttonElement) {
    if (isWordReading && currentWordText === word && currentWordReadButton === buttonElement) {
        stopWordReading();
        return;
    }
    
    stopAllReading();
    setTimeout(() => {
        startWordReading(word, buttonElement);
    }, 350);
}

function startWordReading(word, buttonElement) {
    currentWordText = word;
    currentWordReadButton = buttonElement;
    buttonElement.textContent = "⏹️ Stop";
    buttonElement.classList.add('reading-disabled');
    
    let readCount = 0;
    isWordReading = true;
    
    function speakNext() {
        if (!isWordReading || isStopping) return;
        if (readCount >= 3) {
            stopWordReading();
            return;
        }
        speakTextWithCallback(word, () => {
            readCount++;
            if (readCount < 3 && isWordReading && !isStopping) {
                // 每次朗讀間隔 500ms，聽起來更自然
                setTimeout(speakNext, 500);
            } else {
                stopWordReading();
            }
        });
    }
    
    synth.cancel();
    setTimeout(speakNext, 100);
}

function toggleSentenceReading(sentenceText, buttonElement) {
    if (isSentenceReading && currentSentenceText === sentenceText && currentSentenceReadButton === buttonElement) {
        stopSentenceReading();
        return;
    }
    
    stopAllReading();
    setTimeout(() => {
        startSentenceReading(sentenceText, buttonElement);
    }, 350);
}

function startSentenceReading(sentenceText, buttonElement) {
    currentSentenceText = sentenceText;
    currentSentenceReadButton = buttonElement;
    buttonElement.textContent = "⏹️ Stop";
    buttonElement.classList.add('reading-disabled');
    
    let readCount = 0;
    isSentenceReading = true;
    
    function speakNext() {
        if (!isSentenceReading || isStopping) return;
        if (readCount >= 3) {
            stopSentenceReading();
            return;
        }
        speakTextWithCallback(sentenceText, () => {
            readCount++;
            if (readCount < 3 && isSentenceReading && !isStopping) {
                setTimeout(speakNext, 600); // 句子較長，間隔稍微久一點
            } else {
                stopSentenceReading();
            }
        });
    }
    
    synth.cancel();
    setTimeout(speakNext, 100);
}

// ====================== 数据加载逻辑 (保持原樣) ======================
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
    currentExternalUrl = "";
    
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

async function loadFromLocalFile(file) {
    if (!file) {
        alert("Please select an Excel file (.xlsx, .xls, .csv)");
        return false;
    }
    
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = file.name;
    const fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(fileExt)) {
        alert("Please select a valid Excel file (.xlsx, .xls, .csv)");
        return false;
    }
    
    stopAllReading();
    currentFileName = fileName;
    currentFileNameForSentences = fileName;
    currentExternalUrl = fileName;
    currentLevel = "";
    
    const wordDiv = document.getElementById("wordContent");
    wordDiv.innerHTML = '<p>📖 Loading words & sentences...</p>';
    document.getElementById("dayRow").style.display = 'flex';
    document.getElementById("sentenceArea").style.display = 'none';
    document.getElementById("showAllBtn").style.display = 'none';
    document.getElementById("infoTipContainer").innerHTML = '';
    
    try {
        const buf = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
        
        const success = await parseExcelBufferAndLoad(buf, fileName);
        if (success) {
            return true;
        } else {
            throw new Error("Parse failed, please check file format");
        }
    } catch (err) {
        wordDiv.innerHTML = `<p style="color:#ef4444;">❌ Load failed: ${err.message}</p>`;
        document.getElementById("sentenceArea").style.display = 'none';
        document.getElementById("showAllBtn").style.display = 'none';
        console.error(err);
        return false;
    }
}

// ====================== 篩選與導航 (保持原樣) ======================
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
}

function getMaxDay() {
    if (allWords.length === 0) return 0;
    let max = 0;
    for (let i = 0; i < allWords.length; i++) {
        if (allWords[i].day > max) {
            max = allWords[i].day;
        }
    }
    return max;
}

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
    
    const readBtn = document.getElementById("btnReadWord");
    if (readBtn) {
        readBtn.onclick = () => toggleWordReading(w.word, readBtn);
    }
    
    document.getElementById("btnPrevWord")?.addEventListener("click", () => {
        if (currentWordIdx > 0) {
            currentWordIdx--;
            showWord();
        }
    });
    
    document.getElementById("btnNextWord")?.addEventListener("click", () => {
        if (currentWordIdx + 1 <= filteredWords.length) {
            currentWordIdx++;
            showWord();
        }
    });
}

function updateInfoTip() {
    const container = document.getElementById('infoTipContainer');
    if (!container) return;
    
    const maxDay = getMaxDay();
    const dayDisplay = maxDay > 0 && filteredWords[currentWordIdx] ? `Day ${filteredWords[currentWordIdx].day}/${maxDay}` : `Day ${filteredWords[currentWordIdx]?.day}`;
    
    if (currentMode === "local" && currentFileName && filteredWords.length && filteredWords[currentWordIdx]) {
        const displayFile = removeFileExtension(currentFileName);
        container.innerHTML = `${displayFile} | ${dayDisplay} | ${currentWordIdx + 1}/${filteredWords.length} words | ✏️ Sentences: ${allSentences.length}`;
    } else if (currentMode === "external" && currentFileName && filteredWords.length && filteredWords[currentWordIdx]) {
        const displayFile = removeFileExtension(currentFileName);
        container.innerHTML = `${displayFile} | ${dayDisplay} | ${currentWordIdx + 1}/${filteredWords.length} words | ✏️ Sentences: ${allSentences.length}`;
    } else if (allSentences.length > 0) {
        container.innerHTML = `✨ Total ${allSentences.length} sentences available ✨`;
    } else {
        container.innerHTML = '';
    }
}

// ====================== 句子相关功能 (已優化朗讀) ======================
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
    }
}

function nextSentence() {
    if (allSentences.length && currentSentenceIdx < allSentences.length - 1) {
        currentSentenceIdx++;
        updateSentenceUI();
        stopAllReading();
    } else if (allSentences.length) {
        alert("🎉 You've completed all sentences!");
    }
}

function attachSentenceEvents() {
    const showBtn = document.getElementById("showSentenceBtn");
    const readBtn = document.getElementById("readSentenceBtn");
    const prevBtn = document.getElementById("prevSentenceBtn");
    const nextBtn = document.getElementById("nextSentenceBtn");
    const allBtn = document.getElementById("showAllSentencesBtn");
    
    if (showBtn) showBtn.onclick = () => showCurrentSentence();
    if (readBtn) {
        readBtn.onclick = () => {
            const currentSent = allSentences[currentSentenceIdx];
            if (currentSent) toggleSentenceReading(currentSent.sentence_en, readBtn);
        };
    }
    if (prevBtn) prevBtn.onclick = () => prevSentence();
    if (nextBtn) nextBtn.onclick = () => nextSentence();
    if (allBtn) allBtn.onclick = () => showAllSentencesPopup();
}

function showAllSentencesPopup() {
    if (!allSentences.length) return;
    
    const fileNice = currentMode === "local" ? removeFileExtension(currentFileNameForSentences) : removeFileExtension(currentFileName);
    const tableRows = allSentences.map((s, idx) => `
        <tr>
            <td style="padding: 12px; text-align: center;">${idx + 1}</td>
            <td style="padding: 12px;"><strong>${s.sentence_en}</strong></td>
            <td style="padding: 12px;">${s.sentence_zh}</td>
        </tr>
    `).join('');
    
    const winHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>All Sentences</title><style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f0f4f8; }
        .container { max-width: 1000px; margin: 0 auto; background: white; border-radius: 20px; padding: 20px; }
        h2 { color: #ff9a56; text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
        th { background: #ff9a56; color: white; }
        .close-btn { display: block; width: 120px; margin: 20px auto; padding: 10px; background: #ff6b35; color: white; border: none; border-radius: 30px; cursor: pointer; }
    </style></head><body><div class="container"><h2>${currentLevel} - ${fileNice}</h2>${tableRows ? `<table><thead><tr><th>#</th><th>English</th><th>Chinese</th></tr></thead><tbody>${tableRows}</tbody></table>` : ''}<button class="close-btn" onclick="window.close()">Close</button></div></body></html>`;
    
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(winHtml);
    win.document.close();
}

function showAllWords() {
    if (allWords.length === 0) return;
    
    const fileNice = currentMode === "local" ? removeFileExtension(currentFileName) : removeFileExtension(currentFileName);
    const tableRows = allWords.map(w => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #ffcd94; text-align: center;">${w.day}</td>
            <td style="padding: 12px; border-bottom: 1px solid #ffcd94;"><strong>${w.word.toUpperCase()}</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #ffcd94;">${w.meaning}</td>
        </tr>
    `).join('');
    
    const allWordsHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>All Words</title><style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f0f4f8; }
        .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 20px; padding: 20px; }
        h2 { color: #ff9a56; text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
        th { background: #ff9a56; color: white; }
        .close-btn { display: block; width: 120px; margin: 20px auto; padding: 10px; background: #ff6b35; color: white; border: none; border-radius: 30px; cursor: pointer; }
    </style></head><body><div class="container"><h2>${currentLevel} - ${fileNice}</h2>${tableRows ? `<table><thead><tr><th>Day</th><th>Word</th><th>Meaning</th></tr></thead><tbody>${tableRows}</tbody></table>` : ''}<button class="close-btn" onclick="window.close()">Close</button></div></body></html>`;
    
    const newWindow = window.open('', '_blank', 'width=900,height=700');
    newWindow.document.write(allWordsHtml);
    newWindow.document.close();
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
        
        if (!(currentFileName && allWords.length > 0)) {
            allWords = [];
            filteredWords = [];
            allSentences = [];
            document.getElementById("wordContent").innerHTML = '<p style="color:#64748b;">✨ Select Level & File to start ✨</p>';
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
        toggleBtn.textContent = "📂 Local File";
        toggleBtn.classList.remove('active');
        
        if (!(currentFileName && allWords.length > 0)) {
            allWords = [];
            filteredWords = [];
            allSentences = [];
            document.getElementById("wordContent").innerHTML = '<p style="color:#64748b;">✨ Select a local Excel file to start ✨</p>';
            document.getElementById("sentenceArea").style.display = 'none';
            document.getElementById("showAllBtn").style.display = 'none';
            dayRow.style.display = 'none';
            document.getElementById("infoTipContainer").innerHTML = '';
            currentLevel = "";
        }
    }
}

// [ ... 前面所有的語音與解析邏輯保持不變 ... ]
// (請直接使用您原本 script.js 從第 1 行到第 504 行的內容)

// ====================== 初始化與事件綁定 (已植入儲存邏輯) ======================
document.addEventListener('DOMContentLoaded', () => {
    initDaySelectToggle();
    
    const showAllBtn = document.getElementById('showAllBtn');
    const levelSelect = document.getElementById('levelSelect');
    const levelConfirm = document.getElementById('levelConfirm');
    const fileSelect = document.getElementById('fileSelect');
    const fileConfirm = document.getElementById('fileConfirm');
    const daySelect = document.getElementById('daySelect');
    const dayNum = document.getElementById('dayNum');
    const filterBtn = document.getElementById('filterBtn');
    const modeToggle = document.getElementById('modeToggleBtn');
    const localFileConfirm = document.getElementById('localFileConfirmBtn');
    const localFileInput = document.getElementById('localFileInput');
    const selectFileBtn = document.getElementById('selectFileBtn');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    
    modeToggle.addEventListener('click', () => {
        if (currentMode === "local") toggleMode("external");
        else toggleMode("local");
    });
    
    // Level Confirm 邏輯
    levelConfirm.addEventListener('click', function() {
        this.style.opacity = '0.7';
        setTimeout(() => this.style.opacity = '1', 200);
        
        if (currentMode !== "local") return;
        stopAllReading();
        
        const level = levelSelect.value;
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
    });
    
    // File Confirm 邏輯
    fileConfirm.addEventListener('click', async function() {
        this.style.opacity = '0.7';
        setTimeout(() => this.style.opacity = '1', 200);
        
        if (currentMode !== "local") return;
        
        const selected = fileSelect.value;
        const invalid = ["", "Loading...", "No files available", "Load failed"];
        
        if (invalid.includes(selected)) {
            alert('Please select a valid file!');
            return;
        }
        
        await loadSelectedFile(selected);
    });

    // [ ... 其餘 filterBtn, showAllBtn 等監聽器保持不變 ... ]
    filterBtn.addEventListener('click', function() {
        this.style.opacity = '0.7';
        setTimeout(() => this.style.opacity = '1', 200);
        filterByDay();
    });
    
    showAllBtn.addEventListener('click', showAllWords);
    
    // ======================================================
    // ✨ 新增：Save 按鈕與自動恢復功能 (修正版本)
    // ======================================================
    
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            const config = {
                mode: currentMode,
                level: levelSelect.value,
                file: fileSelect.value,
                daySelect: daySelect.value,
                dayNum: dayNum.value
            };
            localStorage.setItem('kidsEnglish_Config_V2', JSON.stringify(config));
            alert("All current options have been saved.");
        });
    }

    async function autoRestore() {
        const saved = localStorage.getItem('kidsEnglish_Config_V2');
        if (!saved) return;
        
        const config = JSON.parse(saved);

        // 1. 恢復模式
        if (config.mode && config.mode !== currentMode) {
            toggleMode(config.mode);
        }

        // 2. 針對 Built-in 模式恢復數據
        if (config.mode === "local" && config.level) {
            levelSelect.value = config.level;
            currentLevel = config.level;
            
            // 執行原本的 Level Confirm 邏輯
            await loadFileListByLevel(config.level);

            if (config.file) {
                // 給選單一點點渲染時間
                setTimeout(async () => {
                    fileSelect.value = config.file;
                    if (fileSelect.value === config.file) {
                        await loadSelectedFile(config.file);
                        
                        // 恢復 Day 設定
                        if (config.daySelect) {
                            daySelect.value = config.daySelect;
                            // 觸發原始 JS 的輸入框切換邏輯
                            daySelect.dispatchEvent(new Event('change'));
                            dayNum.value = config.dayNum;
                            filterByDay();
                        }
                    }
                }, 400);
            }
        }
    }

    // 啟動後稍微延遲載入，確保 GitHub API 請求順利
    setTimeout(autoRestore, 800);
    
    toggleMode("local");
});
