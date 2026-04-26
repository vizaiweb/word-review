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
let isWordReading = false;
let isSentenceReading = false;
let currentWordReadButton = null;
let currentSentenceReadButton = null;
let currentWordText = "";
let currentSentenceText = "";
let isStopping = false;

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

// ====================== 語音邏輯 (保持不變) ======================
function getHighQualityVoice() {
    return new Promise(resolve => {
        let voices = synth.getVoices();
        const findBest = (vList) => {
            return vList.find(v => v.name.includes('Google US English')) || 
                   vList.find(v => v.lang.includes('en-US')) ||
                   vList[0];
        };
        if (voices.length > 0) resolve(findBest(voices));
        else {
            synth.onvoiceschanged = () => resolve(findBest(synth.getVoices()));
        }
    });
}

async function speakTextWithCallback(text, onEnd) {
    if (!text || isStopping) { onEnd?.(); return; }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const bestVoice = await getHighQualityVoice();
    if (bestVoice) utterance.voice = bestVoice;
    utterance.lang = "en-US";
    utterance.rate = 0.85; 
    utterance.onend = () => { if (!isStopping) onEnd?.(); };
    utterance.onerror = () => { if (!isStopping) onEnd?.(); };
    setTimeout(() => synth.speak(utterance), 50);
}

function stopAllReading() {
    isStopping = true;
    isWordReading = false;
    isSentenceReading = false;
    if (currentWordReadButton) {
        currentWordReadButton.textContent = "🔊 Read 3x";
        currentWordReadButton.classList.remove('reading-disabled');
    }
    if (currentSentenceReadButton) {
        currentSentenceReadButton.textContent = "🔊 Read 3x";
        currentSentenceReadButton.classList.remove('reading-disabled');
    }
    synth.cancel();
    setTimeout(() => { isStopping = false; }, 300);
}

function startWordReading(word, buttonElement) {
    currentWordReadButton = buttonElement;
    buttonElement.textContent = "⏹️ Stop";
    buttonElement.classList.add('reading-disabled');
    let readCount = 0;
    isWordReading = true;
    function speakNext() {
        if (!isWordReading || isStopping) return;
        if (readCount >= 3) { stopAllReading(); return; }
        speakTextWithCallback(word, () => {
            readCount++;
            if (readCount < 3 && isWordReading && !isStopping) setTimeout(speakNext, 500);
            else stopAllReading();
        });
    }
    setTimeout(speakNext, 100);
}

function startSentenceReading(sentenceText, buttonElement) {
    currentSentenceReadButton = buttonElement;
    buttonElement.textContent = "⏹️ Stop";
    buttonElement.classList.add('reading-disabled');
    let readCount = 0;
    isSentenceReading = true;
    function speakNext() {
        if (!isSentenceReading || isStopping) return;
        if (readCount >= 3) { stopAllReading(); return; }
        speakTextWithCallback(sentenceText, () => {
            readCount++;
            if (readCount < 3 && isSentenceReading && !isStopping) setTimeout(speakNext, 600);
            else stopAllReading();
        });
    }
    setTimeout(speakNext, 100);
}

// ====================== 数据加载逻辑 ======================
async function loadFileListByLevel(level) {
    const fileSelect = document.getElementById('fileSelect');
    fileSelect.innerHTML = '<option value="">Loading...</option>';
    try {
        const res = await fetch(getFileListUrl(level));
        const config = await res.json();
        const files = config.files || [];
        fileSelect.innerHTML = '<option value="">Select File</option>';
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

async function parseExcelBufferAndLoad(buf) {
    try {
        const wb = XLSX.read(buf, { type: "array" });
        const wordData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        
        allWords = wordData.filter(item => item.word && item.meaning && item.day).map(item => ({
            word: String(item.word).trim(),
            meaning: String(item.meaning).trim(),
            day: Number(item.day)
        }));
        
        filteredWords = [...allWords];
        currentWordIdx = 0;
        
        allSentences = [];
        if (wb.SheetNames.length >= 2) {
            const rawSentences = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]]);
            rawSentences.forEach(row => {
                let en = row.sentence || row.sentence_en || row.english || row.en || row.Sentence || row.English;
                let zh = row.chinese || row.meaning || row.zh || row.sentence_zh || row.Chinese || row.Meaning;
                if (en) allSentences.push({ sentence_en: String(en).trim(), sentence_zh: zh ? String(zh).trim() : "✨" });
            });
        }
        
        // ✨ 強制解除隱藏：確保單字區與句子區顯示
        const dayRow = document.getElementById("dayRow");
        const sentenceArea = document.getElementById("sentenceArea");
        const showAllBtn = document.getElementById("showAllBtn");
        
        if (dayRow) dayRow.style.display = 'flex';
        
        if (allWords.length > 0) {
            showWord();
            updateInfoTip();
            if (showAllBtn) showAllBtn.style.display = 'inline-block';
        }

        if (allSentences.length > 0) {
            if (sentenceArea) sentenceArea.style.display = 'block';
            currentSentenceIdx = 0;
            updateSentenceUI();
        } else {
            if (sentenceArea) sentenceArea.style.display = 'none';
        }
        return true;
    } catch (e) {
        console.error("Excel Parse Error:", e);
        return false;
    }
}

async function loadSelectedFile(filename) {
    if (!filename || !currentLevel) return;
    stopAllReading();
    currentFileName = filename;
    currentFileNameForSentences = filename;
    
    const wordContent = document.getElementById("wordContent");
    wordContent.innerHTML = '<p>📖 Loading...</p>';

    try {
        const res = await fetch(getXlsxFileUrl(currentLevel, filename));
        if (!res.ok) throw new Error("Fetch failed");
        const buf = await res.arrayBuffer();
        await parseExcelBufferAndLoad(buf);
    } catch (err) {
        wordContent.innerHTML = '<p style="color:red;">❌ Load failed.</p>';
    }
}

async function loadFromLocalFile(file) {
    stopAllReading();
    currentFileName = file.name;
    currentFileNameForSentences = file.name;
    try {
        const buf = await file.arrayBuffer();
        return await parseExcelBufferAndLoad(buf);
    } catch (err) {
        return false;
    }
}

// ====================== 導航與顯示 (保持不變) ======================
function filterByDay() {
    stopAllReading();
    const daySelect = document.getElementById('daySelect');
    const dayNum = document.getElementById('dayNum');
    if (daySelect.value === 'all') {
        filteredWords = [...allWords];
    } else {
        const day = Number(dayNum.value);
        filteredWords = allWords.filter(item => item.day === day);
    }
    currentWordIdx = 0;
    showWord();
    updateInfoTip();
}

function showWord() {
    stopAllReading();
    const container = document.getElementById("wordContent");
    if (filteredWords.length === 0) {
        container.innerHTML = '<p>No words for this day</p>';
        return;
    }
    const w = filteredWords[currentWordIdx];
    container.innerHTML = `
        <div class="meaning">💡 ${w.meaning}</div>
        <div class="word" id="currentWordSpan" style="display:none;">${w.word.toUpperCase()}</div>
        <div class="btn-group">
            <button class="btn-show" id="btnShowWord">👀 Show Word</button>
            <button class="btn-read" id="btnReadWord">🔊 Read 3x</button>
            <button class="btn-prev" id="btnPrevWord" ${currentWordIdx === 0 ? "disabled" : ""}>⬅️ Previous</button>
            <button class="btn-next" id="btnNextWord">➡️ Next</button>
        </div>
    `;
    document.getElementById("btnShowWord").onclick = () => document.getElementById("currentWordSpan").style.display = "block";
    const readBtn = document.getElementById("btnReadWord");
    readBtn.onclick = () => {
        if (isWordReading && currentWordReadButton === readBtn) stopAllReading();
        else { stopAllReading(); setTimeout(() => startWordReading(w.word, readBtn), 350); }
    };
    document.getElementById("btnPrevWord").onclick = () => { if(currentWordIdx > 0) { currentWordIdx--; showWord(); updateInfoTip(); }};
    document.getElementById("btnNextWord").onclick = () => { if(currentWordIdx < filteredWords.length - 1) { currentWordIdx++; showWord(); updateInfoTip(); }};
}

function updateInfoTip() {
    const container = document.getElementById('infoTipContainer');
    if (!container || !filteredWords[currentWordIdx]) return;
    const displayFile = removeFileExtension(currentFileName);
    container.innerHTML = `${displayFile} | Day ${filteredWords[currentWordIdx].day} | ${currentWordIdx + 1}/${filteredWords.length} words`;
}

function updateSentenceUI() {
    if (!allSentences.length) return;
    const sent = allSentences[currentSentenceIdx];
    document.querySelector("#sentenceContent .sentence-meaning").innerHTML = `📖 ${sent.sentence_zh}`;
    const enSpan = document.getElementById("sentenceEnHidden");
    enSpan.innerText = sent.sentence_en;
    enSpan.style.display = "none";
    document.getElementById("sentenceTip").innerText = `📌 ${currentSentenceIdx + 1} / ${allSentences.length} sentences`;
    document.getElementById("prevSentenceBtn").disabled = currentSentenceIdx === 0;
    
    document.getElementById("showSentenceBtn").onclick = () => document.getElementById("sentenceEnHidden").style.display = "block";
    const readBtn = document.getElementById("readSentenceBtn");
    readBtn.onclick = () => {
        if (isSentenceReading && currentSentenceReadButton === readBtn) stopAllReading();
        else { stopAllReading(); setTimeout(() => startSentenceReading(sent.sentence_en, readBtn), 350); }
    };
    document.getElementById("prevSentenceBtn").onclick = () => { if(currentSentenceIdx > 0) { currentSentenceIdx--; updateSentenceUI(); }};
    document.getElementById("nextSentenceBtn").onclick = () => { if(currentSentenceIdx < allSentences.length - 1) { currentSentenceIdx++; updateSentenceUI(); }};
    document.getElementById("showAllSentencesBtn").onclick = showAllSentencesPopup;
}

function showAllSentencesPopup() {
    const tableRows = allSentences.map((s, idx) => `<tr><td>${idx+1}</td><td>${s.sentence_en}</td><td>${s.sentence_zh}</td></tr>`).join('');
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>All Sentences</title></head><body><table border="1">${tableRows}</table></body></html>`);
}

function showAllWords() {
    const tableRows = allWords.map(w => `<tr><td>${w.day}</td><td>${w.word}</td><td>${w.meaning}</td></tr>`).join('');
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>All Words</title></head><body><table border="1">${tableRows}</table></body></html>`);
}

// ====================== 模式切换 ======================
function toggleMode(mode) {
    currentMode = mode;
    const fileRow = document.getElementById('fileRow');
    const externalRow = document.getElementById('externalUrlRow');
    const levelRow = document.getElementById('levelRow');
    const toggleBtn = document.getElementById('modeToggleBtn');
    const dayRow = document.getElementById('dayRow');
    const sentenceArea = document.getElementById('sentenceArea');

    if (mode === "local") {
        fileRow.style.display = 'flex';
        externalRow.style.display = 'none';
        levelRow.classList.remove('hidden-level');
        toggleBtn.textContent = "📁 Built-in DB";
        
        if (allWords.length > 0) {
            dayRow.style.display = 'flex';
            if (allSentences.length > 0) sentenceArea.style.display = 'block';
        } else {
            document.getElementById("wordContent").innerHTML = '<p style="color:#64748b;">✨ Select Level & File to start ✨</p>';
            dayRow.style.display = 'none';
            sentenceArea.style.display = 'none';
        }
    } else {
        fileRow.style.display = 'none';
        externalRow.style.display = 'flex';
        levelRow.classList.add('hidden-level');
        toggleBtn.textContent = "📂 Local File";
        
        document.getElementById("wordContent").innerHTML = '<p style="color:#64748b;">✨ Please import an Excel file (.xlsx) ✨</p>';
        dayRow.style.display = 'none';
        sentenceArea.style.display = 'none';
        if (document.getElementById("showAllBtn")) document.getElementById("showAllBtn").style.display = 'none';
        document.getElementById("infoTipContainer").innerHTML = '';
    }
}

// ====================== 初始化 ======================
document.addEventListener('DOMContentLoaded', () => {
    initDaySelectToggle();
    const levelSelect = document.getElementById('levelSelect');
    const levelConfirm = document.getElementById('levelConfirm');
    const fileSelect = document.getElementById('fileSelect');
    const fileConfirm = document.getElementById('fileConfirm');
    const daySelect = document.getElementById('daySelect');
    const modeToggle = document.getElementById('modeToggleBtn');
    const localFileConfirm = document.getElementById('localFileConfirmBtn');
    const localFileInput = document.getElementById('localFileInput');
    const selectFileBtn = document.getElementById('selectFileBtn'); // 關鍵按鈕
    const fileNameDisplay = document.getElementById('fileNameDisplay');

    modeToggle.onclick = () => toggleMode(currentMode === "local" ? "external" : "local");

    levelConfirm.onclick = () => {
        if (!levelSelect.value) return;
        stopAllReading();
        fileSelect.innerHTML = '<option value="">Loading...</option>';
        daySelect.value = 'all';
        daySelect.dispatchEvent(new Event('change'));
        
        currentLevel = levelSelect.value;
        loadFileListByLevel(currentLevel);
        document.getElementById("wordContent").innerHTML = '<p>✅ Level selected, choose a file.</p>';
        document.getElementById("dayRow").style.display = 'none';
        document.getElementById("sentenceArea").style.display = 'none';
    };

    fileConfirm.onclick = () => {
        const selected = fileSelect.value;
        if (!selected || selected === "" || selected.includes("Select")) {
            alert("Please select a file!");
            return;
        }
        daySelect.value = 'all';
        daySelect.dispatchEvent(new Event('change'));
        loadSelectedFile(selected);
    };

    document.getElementById('filterBtn').onclick = filterByDay;
    const showAllBtn = document.getElementById('showAllBtn');
    if (showAllBtn) showAllBtn.onclick = showAllWords;

    // ✨ 修復 Local File 選擇按鈕
    if (selectFileBtn && localFileInput) {
        selectFileBtn.onclick = () => {
            console.log("Select File button clicked"); // 除錯用
            localFileInput.click();
        };
        localFileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file && fileNameDisplay) {
                fileNameDisplay.textContent = file.name;
                fileNameDisplay.classList.remove('empty');
            }
        };
    }

    localFileConfirm.onclick = async () => {
        const file = localFileInput.files[0];
        if (file) {
            daySelect.value = 'all';
            daySelect.dispatchEvent(new Event('change'));
            await loadFromLocalFile(file);
        } else {
            alert("Please select a file first!");
        }
    };

    // Save & Auto Restore
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.onclick = () => {
            const config = {
                mode: currentMode,
                level: levelSelect.value,
                file: fileSelect.value,
                daySelect: daySelect.value,
                dayNum: document.getElementById('dayNum').value,
                wordIdx: currentWordIdx,
                sentenceIdx: currentSentenceIdx
            };
            localStorage.setItem('kidsEnglish_Config_V2', JSON.stringify(config));
            alert("Progress saved!");
        };
    }

    setTimeout(async () => {
        const saved = localStorage.getItem('kidsEnglish_Config_V2');
        if (saved) {
            const config = JSON.parse(saved);
            if (config.mode === "local" && config.level) {
                levelSelect.value = config.level;
                currentLevel = config.level;
                await loadFileListByLevel(config.level);
                if (config.file) {
                    fileSelect.value = config.file;
                    await loadSelectedFile(config.file);
                }
            }
        }
    }, 800);

    toggleMode("local");
});
