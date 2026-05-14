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
let currentReadCount = 0;

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

// ====================== 语音模块（最终修复版） ======================

// 获取可用语音（同步）
function getAvailableVoice() {
    const voices = synth.getVoices();
    if (!voices || voices.length === 0) return null;
    
    return voices.find(v => v.name && v.name.includes('Google US English')) ||
           voices.find(v => v.name && v.name.includes('Samantha')) ||
           voices.find(v => v.lang && v.lang === 'en-US') ||
           voices.find(v => v.lang && v.lang.includes('en')) ||
           voices[0];
}

// 确保语音引擎就绪
let voiceEngineReady = false;
function ensureVoiceEngine(callback) {
    if (voiceEngineReady) {
        if (callback) callback();
        return true;
    }
    
    try {
        // 发送一个静默的语音来激活引擎
        const silent = new SpeechSynthesisUtterance('');
        silent.volume = 0;
        const voice = getAvailableVoice();
        if (voice) silent.voice = voice;
        
        silent.onend = () => {
            voiceEngineReady = true;
            if (callback) callback();
        };
        
        synth.speak(silent);
        setTimeout(() => {
            if (!voiceEngineReady) {
                voiceEngineReady = true;
                if (callback) callback();
            }
        }, 500);
    } catch(e) {
        voiceEngineReady = true;
        if (callback) callback();
    }
    return false;
}

// 朗读一次（强化版，确保 onend 被调用）
function speakOnce(text, onEnd, rate = 0.85) {
    if (!text) {
        if (onEnd) onEnd();
        return;
    }
    
    // 取消之前的播放
    try { synth.cancel(); } catch(e) {}
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1;
    
    const voice = getAvailableVoice();
    if (voice) utterance.voice = voice;
    
    let ended = false;
    
    utterance.onend = () => {
        if (!ended) {
            ended = true;
            if (onEnd) onEnd();
        }
    };
    
    utterance.onerror = (err) => {
        console.error('Speech error:', err);
        if (!ended) {
            ended = true;
            if (onEnd) onEnd();
        }
    };
    
    try { 
        synth.speak(utterance);
        // 设置一个安全超时，确保 onend 一定会被调用
        setTimeout(() => {
            if (!ended) {
                ended = true;
                if (onEnd) onEnd();
            }
        }, Math.max(1000, text.length * 80));
    } catch(e) { 
        if (onEnd) onEnd(); 
    }
}

// 单词朗读（3次）- 修复第一次只读2遍的问题
function startWordReading(word, buttonElement) {
    if (isWordReading && currentWordText === word && currentWordReadButton === buttonElement) {
        stopWordReading();
        return;
    }
    
    stopAllReading();
    
    currentWordText = word;
    currentWordReadButton = buttonElement;
    currentReadCount = 0;
    isWordReading = true;
    
    buttonElement.textContent = "⏹️ Stop";
    buttonElement.classList.add('reading-disabled');
    
    // 核心修复：先确保语音引擎就绪，再开始朗读
    function beginReading() {
        if (!isWordReading) return;
        speakNext();
    }
    
    function speakNext() {
        if (!isWordReading) return;
        if (currentReadCount >= 3) {
            stopWordReading();
            return;
        }
        
        // 先增加计数
        currentReadCount++;
        
        speakOnce(word, () => {
            if (isWordReading && currentReadCount < 3) {
                setTimeout(speakNext, 450);
            } else if (currentReadCount >= 3) {
                stopWordReading();
            }
        });
    }
    
    // 等待引擎就绪后开始（第一次会等待，后续直接执行）
    ensureVoiceEngine(beginReading);
}

function stopWordReading() {
    if (!isWordReading) return;
    isWordReading = false;
    
    try { synth.cancel(); } catch(e) {}
    
    if (currentWordReadButton) {
        currentWordReadButton.textContent = "🔊 Read 3x";
        currentWordReadButton.classList.remove('reading-disabled');
        currentWordReadButton = null;
    }
    currentWordText = "";
    currentReadCount = 0;
}

// 句子朗读（3次）- 同样修复
function startSentenceReading(sentenceText, buttonElement) {
    if (isSentenceReading && currentSentenceText === sentenceText && currentSentenceReadButton === buttonElement) {
        stopSentenceReading();
        return;
    }
    
    stopAllReading();
    
    currentSentenceText = sentenceText;
    currentSentenceReadButton = buttonElement;
    currentReadCount = 0;
    isSentenceReading = true;
    
    buttonElement.textContent = "⏹️ Stop";
    buttonElement.classList.add('reading-disabled');
    
    function beginReading() {
        if (!isSentenceReading) return;
        speakNext();
    }
    
    function speakNext() {
        if (!isSentenceReading) return;
        if (currentReadCount >= 3) {
            stopSentenceReading();
            return;
        }
        
        currentReadCount++;
        
        speakOnce(sentenceText, () => {
            if (isSentenceReading && currentReadCount < 3) {
                setTimeout(speakNext, 550);
            } else if (currentReadCount >= 3) {
                stopSentenceReading();
            }
        }, 0.85);
    }
    
    ensureVoiceEngine(beginReading);
}

function stopSentenceReading() {
    if (!isSentenceReading) return;
    isSentenceReading = false;
    
    try { synth.cancel(); } catch(e) {}
    
    if (currentSentenceReadButton) {
        currentSentenceReadButton.textContent = "🔊 Read 3x";
        currentSentenceReadButton.classList.remove('reading-disabled');
        currentSentenceReadButton = null;
    }
    currentSentenceText = "";
    currentReadCount = 0;
}

function stopAllReading() {
    stopWordReading();
    stopSentenceReading();
}

function toggleWordReading(word, buttonElement) {
    startWordReading(word, buttonElement);
}

function toggleSentenceReading(sentenceText, buttonElement) {
    startSentenceReading(sentenceText, buttonElement);
}

// 预热语音（页面加载时调用一次）
function preheatVoice() {
    ensureVoiceEngine(function() {
        console.log('Voice engine ready');
    });
}

// 页面加载后自动预热
setTimeout(function() {
    preheatVoice();
}, 1000);

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

// ====================== 筛选与导航逻辑 ======================
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
        readBtn.onclick = () => {
            preheatVoice();
            toggleWordReading(w.word, readBtn);
        };
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
            if (currentSent) {
                preheatVoice();
                toggleSentenceReading(currentSent.sentence_en, readBtn);
            }
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

// ====================== 模式切换（修复版） ======================
function toggleMode(mode) {
    // 如果模式没有变化，不做任何操作
    if (currentMode === mode) return;
    
    // 更新当前模式
    currentMode = mode;
    
    // 获取相关的 DOM 元素
    const fileRow = document.getElementById('fileRow');
    const externalRow = document.getElementById('externalUrlRow');
    const levelRow = document.getElementById('levelRow');
    const toggleBtn = document.getElementById('modeToggleBtn');
    const dayRow = document.getElementById('dayRow');
    
    if (mode === "local") {
        // --- 切换到 Built-in DB 模式 ---
        fileRow.style.display = 'flex';
        externalRow.style.display = 'none';
        levelRow.classList.remove('hidden-level');
        toggleBtn.textContent = "📁 Built-in DB";
        toggleBtn.classList.add('active');
        
        // 只有在没有有效数据时才清空界面
        if (!currentFileName || allWords.length === 0) {
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
        // --- 切换到 Local File 模式 ---
        fileRow.style.display = 'none';
        externalRow.style.display = 'flex';
        levelRow.classList.add('hidden-level');
        toggleBtn.textContent = "📂 Local File";
        toggleBtn.classList.remove('active');
        
        // 只有在没有有效数据时才清空界面
        if (!currentFileName || allWords.length === 0) {
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
    
    // 重要：清除可能干扰的自动恢复计时器，防止状态覆盖
    if (window._autoRestoreTimer) {
        clearTimeout(window._autoRestoreTimer);
        window._autoRestoreTimer = null;
    }
}

// ====================== 初始化与事件绑定 ======================
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
    
    if (selectFileBtn && localFileInput) {
        selectFileBtn.addEventListener('click', () => {
            localFileInput.click();
        });
        
        localFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && fileNameDisplay) {
                fileNameDisplay.textContent = file.name;
                fileNameDisplay.classList.remove('empty');
            } else if (fileNameDisplay) {
                fileNameDisplay.textContent = 'No file selected';
                fileNameDisplay.classList.add('empty');
            }
        });
    }
    
    if (localFileConfirm) {
        localFileConfirm.addEventListener('click', async () => {
            if (currentMode !== "external") {
                alert('Please switch to "Local File" mode first (click Mode button)');
                return;
            }
            
            const file = localFileInput ? localFileInput.files[0] : null;
            if (!file) {
                alert("Please select an Excel file first");
                return;
            }
            
            await loadFromLocalFile(file);
        });
    }
    
    filterBtn.addEventListener('click', function() {
        this.style.opacity = '0.7';
        setTimeout(() => this.style.opacity = '1', 200);
        filterByDay();
    });
    
    showAllBtn.addEventListener('click', showAllWords);
    
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            const config = {
                mode: currentMode,
                level: levelSelect.value,
                file: fileSelect.value,
                daySelect: daySelect.value,
                dayNum: dayNum.value,
                wordIdx: currentWordIdx,
                sentenceIdx: currentSentenceIdx
            };
            localStorage.setItem('kidsEnglish_Config_V2', JSON.stringify(config));
            alert("Progress and settings have been saved!");
        });
    }
    
        // 自动恢复保存的设置
    async function autoRestore() {
        const saved = localStorage.getItem('kidsEnglish_Config_V2');
        if (!saved) return;
        
        let config;
        try {
            config = JSON.parse(saved);
        } catch(e) {
            console.error("Failed to parse saved config", e);
            return;
        }
        
        // 如果保存的模式与当前模式不同，先切换模式（这步很重要）
        if (config.mode && config.mode !== currentMode) {
            toggleMode(config.mode);
        }
        
        // 等待一小段时间，让 DOM 更新
        await new Promise(r => setTimeout(r, 100));
        
        // 如果是 Built-in 模式且有保存的等级
        if (config.mode === "local" && config.level) {
            const levelSelect = document.getElementById('levelSelect');
            if (levelSelect) levelSelect.value = config.level;
            currentLevel = config.level;
            
            // 加载文件列表
            await loadFileListByLevel(config.level);
            
            // 如果有保存的文件名
            if (config.file) {
                const fileSelect = document.getElementById('fileSelect');
                // 等待文件列表加载完成
                await new Promise(r => setTimeout(r, 300));
                
                if (fileSelect) {
                    // 检查文件中是否存在该选项
                    let optionExists = false;
                    for (let i = 0; i < fileSelect.options.length; i++) {
                        if (fileSelect.options[i].value === config.file) {
                            optionExists = true;
                            break;
                        }
                    }
                    
                    if (optionExists) {
                        fileSelect.value = config.file;
                        // 加载选中的文件
                        await loadSelectedFile(config.file);
                        
                        // 恢复 Day 筛选和索引
                        if (config.daySelect) {
                            const daySelect = document.getElementById('daySelect');
                            const dayNum = document.getElementById('dayNum');
                            if (daySelect) daySelect.value = config.daySelect;
                            if (dayNum) dayNum.value = config.dayNum;
                            // 触发 change 事件
                            if (daySelect) daySelect.dispatchEvent(new Event('change'));
                            filterByDay();
                            
                            // 恢复单词索引
                            if (config.wordIdx !== undefined && filteredWords[config.wordIdx]) {
                                currentWordIdx = config.wordIdx;
                                showWord();
                            }
                            
                            // 恢复句子索引
                            if (config.sentenceIdx !== undefined && allSentences[config.sentenceIdx]) {
                                currentSentenceIdx = config.sentenceIdx;
                                updateSentenceUI();
                            }
                        }
                    }
                }
            }
        }
    }
    
    window._autoRestoreTimer = setTimeout(autoRestore, 800);
    toggleMode("local");
});
