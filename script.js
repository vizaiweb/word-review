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

// ====================== 終極兼容版語音邏輯 ======================

function getHighQualityVoice() {
    return new Promise(resolve => {
        let voices = synth.getVoices();
        
        const findBest = (vList) => {
            return vList.find(v => v.name.includes('Google US English')) || 
                   vList.find(v => v.name.includes('Samantha') && v.name.includes('Premium')) || 
                   vList.find(v => v.name.includes('Samantha')) || 
                   vList.find(v => v.lang === 'en-US' && v.localService === true) || 
                   vList.find(v => v.lang.includes('en-US')) ||
                   vList[0];
        };

        if (voices.length > 0) {
            resolve(findBest(voices));
        } else {
            const timer = setTimeout(() => resolve(null), 1000);
            synth.onvoiceschanged = () => {
                clearTimeout(timer);
                resolve(findBest(synth.getVoices()));
            };
        }
    });
}

async function speakTextWithCallback(text, onEnd) {
    if (!text || isStopping) {
        onEnd?.();
        return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const bestVoice = await getHighQualityVoice();
    if (bestVoice) {
        utterance.voice = bestVoice;
        utterance.voiceURI = bestVoice.voiceURI;
    }
    utterance.lang = "en-US";
    utterance.rate = 0.85; 
    utterance.pitch = 1.0;
    utterance.onend = () => { if (!isStopping) onEnd?.(); };
    utterance.onerror = () => { if (!isStopping) onEnd?.(); };
    setTimeout(() => { synth.speak(utterance); }, 50);
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
    setTimeout(() => { startWordReading(word, buttonElement); }, 350);
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
    setTimeout(() => { startSentenceReading(sentenceText, buttonElement); }, 350);
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
                setTimeout(speakNext, 600);
            } else {
                stopSentenceReading();
            }
        });
    }
    synth.cancel();
    setTimeout(speakNext, 100);
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
    }
}

async function loadFromLocalFile(file) {
    if (!file) return false;
    stopAllReading();
    currentFileName = file.name;
    currentFileNameForSentences = file.name;
    currentExternalUrl = file.name;
    currentLevel = "";
    const wordDiv = document.getElementById("wordContent");
    wordDiv.innerHTML = '<p>📖 Loading words & sentences...</p>';
    try {
        const buf = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
        return await parseExcelBufferAndLoad(buf, file.name);
    } catch (err) {
        return false;
    }
}

// ====================== 篩選與導航 ======================
function filterByDay() {
    stopAllReading();
    const daySelect = document.getElementById('daySelect');
    const dayNum = document.getElementById('dayNum');
    if (daySelect.value === 'all') {
        filteredWords = JSON.parse(JSON.stringify(allWords));
        currentWordIdx = 0;
        showWord();
    } else {
        const day = Number(dayNum.value);
        filteredWords = allWords.filter(item => item.day === day);
        currentWordIdx = 0;
        showWord();
    }
    updateInfoTip();
}

function getMaxDay() {
    if (allWords.length === 0) return 0;
    let max = 0;
    for (let i = 0; i < allWords.length; i++) {
        if (allWords[i].day > max) max = allWords[i].day;
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
    if (readBtn) readBtn.onclick = () => toggleWordReading(w.word, readBtn);
    document.getElementById("btnPrevWord")?.addEventListener("click", () => {
        if (currentWordIdx > 0) { currentWordIdx--; showWord(); }
    });
    document.getElementById("btnNextWord")?.addEventListener("click", () => {
        if (currentWordIdx + 1 <= filteredWords.length) { currentWordIdx++; showWord(); }
    });
}

function updateInfoTip() {
    const container = document.getElementById('infoTipContainer');
    if (!container) return;
    const maxDay = getMaxDay();
    const currentDay = filteredWords[currentWordIdx]?.day;
    const dayDisplay = maxDay > 0 && currentDay ? `Day ${currentDay}/${maxDay}` : `Day ${currentDay}`;
    if (currentFileName && filteredWords.length && filteredWords[currentWordIdx]) {
        const displayFile = removeFileExtension(currentFileName);
        container.innerHTML = `${displayFile} | ${dayDisplay} | ${currentWordIdx + 1}/${filteredWords.length} words | ✏️ Sentences: ${allSentences.length}`;
    }
}

// ====================== 句子相關功能 ======================
function updateSentenceUI() {
    if (!allSentences.length) return;
    const sent = allSentences[currentSentenceIdx];
    const meaningDiv = document.querySelector("#sentenceContent .sentence-meaning");
    const enSpan = document.getElementById("sentenceEnHidden");
    if (meaningDiv) meaningDiv.innerHTML = `📖 ${sent.sentence_zh}`;
    if (enSpan) { enSpan.innerText = sent.sentence_en; enSpan.style.display = "none"; }
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
        currentSentenceIdx--; updateSentenceUI(); stopAllReading();
    }
}

function nextSentence() {
    if (allSentences.length && currentSentenceIdx < allSentences.length - 1) {
        currentSentenceIdx++; updateSentenceUI(); stopAllReading();
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
    const tableRows = allSentences.map((s, idx) => `<tr><td style="padding:12px; text-align:center;">${idx + 1}</td><td style="padding:12px;"><strong>${s.sentence_en}</strong></td><td style="padding:12px;">${s.sentence_zh}</td></tr>`).join('');
    const winHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial;padding:20px;background:#f0f4f8;}.container{max-width:1000px;margin:0 auto;background:white;border-radius:20px;padding:20px;}h2{color:#ff9a56;text-align:center;}table{width:100%;border-collapse:collapse;}th,td{padding:12px;border-bottom:1px solid #e2e8f0;}th{background:#ff9a56;color:white;}.close-btn{display:block;width:120px;margin:20px auto;padding:10px;background:#ff6b35;color:white;border:none;border-radius:30px;cursor:pointer;}</style></head><body><div class="container"><h2>Sentences List</h2><table><thead><tr><th>#</th><th>English</th><th>Chinese</th></tr></thead><tbody>${tableRows}</tbody></table><button class="close-btn" onclick="window.close()">Close</button></div></body></html>`;
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(winHtml);
    win.document.close();
}

function showAllWords() {
    if (allWords.length === 0) return;
    const tableRows = allWords.map(w => `<tr><td style="padding:12px; border-bottom:1px solid #ffcd94; text-align:center;">${w.day}</td><td style="padding:12px; border-bottom:1px solid #ffcd94;"><strong>${w.word.toUpperCase()}</strong></td><td style="padding:12px; border-bottom:1px solid #ffcd94;">${w.meaning}</td></tr>`).join('');
    const allWordsHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial;padding:20px;background:#f0f4f8;}.container{max-width:900px;margin:0 auto;background:white;border-radius:20px;padding:20px;}h2{color:#ff9a56;text-align:center;}table{width:100%;border-collapse:collapse;}th,td{padding:12px;border-bottom:1px solid #e2e8f0;}th{background:#ff9a56;color:white;}.close-btn{display:block;width:120px;margin:20px auto;padding:10px;background:#ff6b35;color:white;border:none;border-radius:30px;cursor:pointer;}</style></head><body><div class="container"><h2>Words List</h2><table><thead><tr><th>Day</th><th>Word</th><th>Meaning</th></tr></thead><tbody>${tableRows}</tbody></table><button class="close-btn" onclick="window.close()">Close</button></div></body></html>`;
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
    if (mode === "local") {
        fileRow.style.display = 'flex';
        externalRow.style.display = 'none';
        levelRow.classList.remove('hidden-level');
        toggleBtn.textContent = "📁 Built-in DB";
        toggleBtn.classList.add('active');
    } else {
        fileRow.style.display = 'none';
        externalRow.style.display = 'flex';
        levelRow.classList.add('hidden-level');
        toggleBtn.textContent = "📂 Local File";
        toggleBtn.classList.remove('active');
    }
}

// ====================== 【新增】自動記憶功能核心邏輯 ======================

function saveCurrentSettings() {
    const settings = {
        mode: currentMode,
        level: document.getElementById('levelSelect').value,
        file: document.getElementById('fileSelect').value,
        daySelect: document.getElementById('daySelect').value,
        dayNum: document.getElementById('dayNum').value
    };
    localStorage.setItem('kidsEnglishConfig', JSON.stringify(settings));
    
    const btn = document.getElementById('saveSettingsBtn');
    btn.textContent = "✅ Saved!";
    setTimeout(() => btn.textContent = "Save", 1500);
}

async function loadSavedSettings() {
    const savedData = localStorage.getItem('kidsEnglishConfig');
    if (!savedData) return;

    const config = JSON.parse(savedData);

    // 1. 恢復模式
    if (config.mode && config.mode !== currentMode) {
        toggleMode(config.mode);
    }

    // 2. 恢復 Level 並加載文件清單
    if (config.level && config.mode === "local") {
        const lvSelect = document.getElementById('levelSelect');
        lvSelect.value = config.level;
        currentLevel = config.level;
        
        await loadFileListByLevel(config.level);

        // 3. 恢復 File 並加載數據
        const fileSelect = document.getElementById('fileSelect');
        if (config.file) {
            fileSelect.value = config.file;
            await loadSelectedFile(config.file);
            
            // 4. 恢復 Day
            if (config.daySelect) {
                document.getElementById('daySelect').value = config.daySelect;
                // 觸發一次切換邏輯
                document.getElementById('daySelect').dispatchEvent(new Event('change'));
            }
            if (config.dayNum) document.getElementById('dayNum').value = config.dayNum;
            
            // 最後自動篩選一次
            filterByDay();
        }
    }
}

// ====================== 初始化 ======================
document.addEventListener('DOMContentLoaded', () => {
    initDaySelectToggle();
    const showAllBtn = document.getElementById('showAllBtn');
    const levelConfirm = document.getElementById('levelConfirm');
    const fileConfirm = document.getElementById('fileConfirm');
    const filterBtn = document.getElementById('filterBtn');
    const modeToggle = document.getElementById('modeToggleBtn');
    const localFileConfirm = document.getElementById('localFileConfirmBtn');
    const localFileInput = document.getElementById('localFileInput');
    const selectFileBtn = document.getElementById('selectFileBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');

    modeToggle.addEventListener('click', () => {
        toggleMode(currentMode === "local" ? "external" : "local");
    });
    
    levelConfirm.addEventListener('click', async function() {
        const level = document.getElementById('levelSelect').value;
        if (!level) return;
        currentLevel = level;
        await loadFileListByLevel(level);
    });
    
    fileConfirm.addEventListener('click', async function() {
        const selected = document.getElementById('fileSelect').value;
        if (selected) await loadSelectedFile(selected);
    });
    
    if (selectFileBtn) selectFileBtn.onclick = () => localFileInput.click();
    if (localFileInput) {
        localFileInput.onchange = (e) => {
            const file = e.target.files[0];
            document.getElementById('fileNameDisplay').textContent = file ? file.name : 'No file selected';
        };
    }
    if (localFileConfirm) {
        localFileConfirm.onclick = () => {
            const file = localFileInput.files[0];
            if (file) loadFromLocalFile(file);
        };
    }
    
    filterBtn.addEventListener('click', filterByDay);
    showAllBtn.addEventListener('click', showAllWords);
    
    // 綁定 Save 按鈕
    if (saveSettingsBtn) saveSettingsBtn.onclick = saveCurrentSettings;

    // 啟動時加載設定
    setTimeout(loadSavedSettings, 500);
});
