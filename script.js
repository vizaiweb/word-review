// 全局状态变量
let allWords = [];          
let filteredWords = [];     
let currentWordIdx = 0;     
let currentFileName = "";   
let currentLevel = "";      

let allSentences = [];      
let currentSentenceIdx = 0; 
let currentFileNameForSentences = ""; 

const synth = window.speechSynthesis;

// 英文朗读相关变量
let isWordReading = false;
let isSentenceReading = false;
let currentWordReadButton = null;
let currentSentenceReadButton = null;
let currentWordText = "";
let currentSentenceText = "";
let currentReadCount = 0;

// 粤语朗读相关变量
let isCantoneseReading = false;
let currentCantoneseButton = null;
let currentCantoneseText = "";

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

// ====================== 英文语音模块 ======================
function getAvailableVoice() {
    const voices = synth.getVoices();
    if (!voices || voices.length === 0) return null;
    
    return voices.find(v => v.name && v.name.includes('Google US English')) ||
           voices.find(v => v.name && v.name.includes('Samantha')) ||
           voices.find(v => v.lang && v.lang === 'en-US') ||
           voices.find(v => v.lang && v.lang.includes('en')) ||
           voices[0];
}

let voiceEngineReady = false;
function ensureVoiceEngine(callback) {
    if (voiceEngineReady) {
        if (callback) callback();
        return true;
    }
    
    try {
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

function speakOnce(text, onEnd, rate = 0.85) {
    if (!text) {
        if (onEnd) onEnd();
        return;
    }
    
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
        
        currentReadCount++;
        
        speakOnce(word, () => {
            if (isWordReading && currentReadCount < 3) {
                setTimeout(speakNext, 450);
            } else if (currentReadCount >= 3) {
                stopWordReading();
            }
        });
    }
    
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

function toggleWordReading(word, buttonElement) {
    startWordReading(word, buttonElement);
}

function toggleSentenceReading(sentenceText, buttonElement) {
    startSentenceReading(sentenceText, buttonElement);
}

// ====================== 粤语语音模块（复用主页逻辑） ======================
function getCantoneseVoice() {
    const voices = synth.getVoices();
    if (!voices || voices.length === 0) return null;
    
    return voices.find(v => v.name && v.name === 'Sin-Ji') ||
           voices.find(v => v.name && v.name.includes('Google') && (v.lang === 'yue' || v.lang === 'zh-HK')) ||
           voices.find(v => v.name && v.name.includes('Cantonese')) ||
           voices.find(v => v.lang === 'yue') ||
           voices.find(v => v.lang === 'zh-HK') ||
           voices.find(v => v.lang && v.lang.includes('hk')) ||
           null;
}

let cantoneseVoiceEngineReady = false;
let cantoneseVoice = null;

function ensureCantoneseEngine(callback) {
    if (cantoneseVoiceEngineReady && cantoneseVoice) {
        if (callback) callback();
        return true;
    }
    
    try {
        const silent = new SpeechSynthesisUtterance('');
        silent.volume = 0;
        const voice = getCantoneseVoice();
        if (voice) {
            cantoneseVoice = voice;
            silent.voice = voice;
        }
        
        silent.onend = () => {
            cantoneseVoiceEngineReady = true;
            if (callback) callback();
        };
        
        synth.speak(silent);
        setTimeout(() => {
            if (!cantoneseVoiceEngineReady) {
                cantoneseVoiceEngineReady = true;
                if (callback) callback();
            }
        }, 500);
    } catch(e) {
        cantoneseVoiceEngineReady = true;
        if (callback) callback();
    }
    return false;
}

function speakCantoneseOnce(text, onEnd) {
    if (!text) {
        if (onEnd) onEnd();
        return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "yue";
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1;
    
    const voice = getCantoneseVoice();
    if (voice) {
        utterance.voice = voice;
        cantoneseVoice = voice;
    }
    
    let ended = false;
    
    utterance.onend = () => {
        if (!ended) {
            ended = true;
            if (onEnd) onEnd();
        }
    };
    
    utterance.onerror = (err) => {
        console.error('Cantonese speech error:', err);
        if (!ended) {
            ended = true;
            if (onEnd) onEnd();
        }
    };
    
    try {
        synth.speak(utterance);
        setTimeout(() => {
            if (!ended) {
                ended = true;
                if (onEnd) onEnd();
            }
        }, Math.max(1000, text.length * 100));
    } catch(e) {
        if (onEnd) onEnd();
    }
}

function startCantoneseReading(text, buttonElement) {
    if (isCantoneseReading && currentCantoneseText === text && currentCantoneseButton === buttonElement) {
        stopCantoneseReading();
        return;
    }
    
    stopCantoneseReading();
    
    currentCantoneseText = text;
    currentCantoneseButton = buttonElement;
    isCantoneseReading = true;
    
    buttonElement.textContent = "⏹️停";
    buttonElement.style.opacity = "0.6";
    
    function beginReading() {
        if (!isCantoneseReading) return;
        speakCantoneseOnce(text, () => {
            stopCantoneseReading();
        });
    }
    
    ensureCantoneseEngine(beginReading);
}

function stopCantoneseReading() {
    if (!isCantoneseReading) return;
    isCantoneseReading = false;
    
    if (currentCantoneseButton) {
        currentCantoneseButton.textContent = "🔊粵 1x";
        currentCantoneseButton.style.opacity = "1";
        currentCantoneseButton = null;
    }
    currentCantoneseText = "";
}

function toggleCantoneseReading(text, buttonElement) {
    startCantoneseReading(text, buttonElement);
}

// 预热语音引擎
function preheatVoice() {
    ensureVoiceEngine(function() {
        console.log('English voice engine ready');
    });
    ensureCantoneseEngine(function() {
        console.log('Cantonese voice engine ready');
    });
}

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
            day: Number(item.day),
            phonetics: item.phonetics || item.phonetic || item.pronunciation || item.音标 || null,
            syllable: item.syllable || item.syllable_splitting || item.syllables || item.音节 || item.音节划分 || null
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
    
    // 构建详细信息（音标和音节）
    let detailsHtml = '';
    if (w.syllable || w.phonetics) {
        if (w.syllable && w.syllable.trim() !== '') {
            detailsHtml += `<div class="syllable" style="font-size: 20px; color: #ff9a56; letter-spacing: 1px; margin-top: 8px;">${w.syllable}</div>`;
        }
        if (w.phonetics && w.phonetics.trim() !== '') {
            detailsHtml += `<div class="phonetics" style="font-size: 16px; color: #64748b; font-family: monospace; margin-top: 4px;">${w.phonetics}</div>`;
        }
    }
    
    // 完整的隐藏内容（单词 + 详细信息）
    const hiddenContent = `
        <div style="font-size: clamp(28px, 8vw, 52px); font-weight: bold; color: #dc2626;">${w.word.toUpperCase()}</div>
        ${detailsHtml}
    `;
    
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 8px;">
            <div class="meaning" style="margin-bottom: 0; flex: 1;">💡 ${w.meaning}</div>
            <button id="readCantoneseBtn" style="background: #333; color: white; border: none; border-radius: 40px; padding: 6px 12px; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.2s;">🔊粵 1x</button>
        </div>
        <div id="currentWordSpan" style="display: none;">${hiddenContent}</div>
        <div class="btn-group">
            <button class="btn-show" id="btnShowWord">👀 Show Word</button>
            <button class="btn-read" id="btnReadWord">🔊 Read 3x</button>
            <button class="btn-prev" id="btnPrevWord" ${isFirst ? "disabled" : ""}>⬅️ Previous</button>
            <button class="btn-next" id="btnNextWord">➡️ Next</button>
        </div>
    `;
    
    updateInfoTip();
    
    // 绑定粤语按钮事件
    const cantoneseBtn = document.getElementById("readCantoneseBtn");
    if (cantoneseBtn) {
        cantoneseBtn.onclick = () => {
            toggleCantoneseReading(w.meaning, cantoneseBtn);
        };
    }
    
    const showBtn = document.getElementById("btnShowWord");
    if (showBtn) {
        showBtn.onclick = () => {
            const span = document.getElementById("currentWordSpan");
            if (span) {
                span.style.display = "block";
                console.log('显示单词区域');
            }
        };
    }
    
    const readBtn = document.getElementById("btnReadWord");
    if (readBtn) {
        readBtn.onclick = () => {
            preheatVoice();
            toggleWordReading(w.word, readBtn);
        };
    }
    
    const prevBtn = document.getElementById("btnPrevWord");
    if (prevBtn) {
        prevBtn.onclick = () => {
            if (currentWordIdx > 0) {
                currentWordIdx--;
                showWord();
            }
        };
    }
    
    const nextBtn = document.getElementById("btnNextWord");
    if (nextBtn) {
        nextBtn.onclick = () => {
            if (currentWordIdx + 1 <= filteredWords.length) {
                currentWordIdx++;
                showWord();
            }
        };
    }
}

function updateInfoTip() {
    const container = document.getElementById('infoTipContainer');
    if (!container) return;
    
    const maxDay = getMaxDay();
    const dayDisplay = maxDay > 0 && filteredWords[currentWordIdx] ? `Day ${filteredWords[currentWordIdx].day}/${maxDay}` : `Day ${filteredWords[currentWordIdx]?.day}`;
    
    if (currentFileName && filteredWords.length && filteredWords[currentWordIdx]) {
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

// ====================== 辅助函数 ======================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// 停止所有朗读
function stopAllReading() {
    stopWordReading();
    stopSentenceReading();
    stopCantoneseReading();
    
    // 停止弹窗内的自动播放
    if (window.wordsAutoPlayInterval) {
        clearTimeout(window.wordsAutoPlayInterval);
        window.wordsAutoPlayInterval = null;
    }
    if (window.sentencesAutoPlayInterval) {
        clearTimeout(window.sentencesAutoPlayInterval);
        window.sentencesAutoPlayInterval = null;
    }
}

// ====================== Speak Word/Sequence with Cantonese (复用粤语引擎) ======================
function speakWordWithEnglishAndCantonese(word, meaning, onComplete) {
    let step = 0;
    let repeatCount = 0;
    let isCancelled = false;
    
    function cancelPlayback() {
        isCancelled = true;
        try { synth.cancel(); } catch(e) {}
    }
    
    function speakNext() {
        if (isCancelled || (wordsAutoPlayState && (wordsAutoPlayState.isPaused || !wordsAutoPlayState.isPlaying))) {
            if (onComplete) onComplete();
            return;
        }
        
        if (step === 0) {
            // Read English 3 times
            speakOnce(word, () => {
                if (isCancelled) return;
                repeatCount++;
                if (repeatCount < 3) {
                    setTimeout(speakNext, 450);
                } else {
                    step = 1;
                    repeatCount = 0;
                    setTimeout(speakNext, 450);
                }
            });
        } else if (step === 1) {
            // Read Cantonese meaning - must complete fully before next
            const utterance = new SpeechSynthesisUtterance(meaning);
            utterance.lang = "yue";
            utterance.rate = 0.85;
            utterance.pitch = 1.0;
            utterance.volume = 1;
            
            const voice = getCantoneseVoice();
            if (voice) {
                utterance.voice = voice;
            }
            
            let completed = false;
            
            // Calculate timeout based on text length
            const estimatedDuration = Math.max(1500, meaning.length * 200);
            
            const safetyTimeout = setTimeout(() => {
                if (!completed) {
                    completed = true;
                    console.warn('Cantonese speech timeout, continuing...');
                    setTimeout(() => {
                        if (onComplete) onComplete();
                    }, 300);
                }
            }, estimatedDuration + 1000);
            
            utterance.onend = () => {
                if (completed) return;
                completed = true;
                clearTimeout(safetyTimeout);
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, 400);
            };
            
            utterance.onerror = (err) => {
                console.error('Cantonese speech error:', err);
                if (completed) return;
                completed = true;
                clearTimeout(safetyTimeout);
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, 300);
            };
            
            try {
                synth.speak(utterance);
            } catch(e) {
                console.error('Failed to speak Cantonese:', e);
                if (completed) return;
                completed = true;
                clearTimeout(safetyTimeout);
                if (onComplete) onComplete();
            }
        }
    }
    
    speakNext();
}

function speakSentenceWithEnglishAndCantonese(sentenceEn, sentenceZh, onComplete) {
    let step = 0;
    let repeatCount = 0;
    let isCancelled = false;
    
    function cancelPlayback() {
        isCancelled = true;
        try { synth.cancel(); } catch(e) {}
    }
    
    function speakNext() {
        if (isCancelled || (sentencesAutoPlayState && (sentencesAutoPlayState.isPaused || !sentencesAutoPlayState.isPlaying))) {
            if (onComplete) onComplete();
            return;
        }
        
        if (step === 0) {
            // Read English 3 times
            speakOnce(sentenceEn, () => {
                if (isCancelled) return;
                repeatCount++;
                if (repeatCount < 3) {
                    setTimeout(speakNext, 600);
                } else {
                    step = 1;
                    repeatCount = 0;
                    setTimeout(speakNext, 600);
                }
            });
        } else if (step === 1) {
            // Read Cantonese meaning - must complete fully before next
            const utterance = new SpeechSynthesisUtterance(sentenceZh);
            utterance.lang = "yue";
            utterance.rate = 0.85;
            utterance.pitch = 1.0;
            utterance.volume = 1;
            
            // Get the best Cantonese voice
            const voice = getCantoneseVoice();
            if (voice) {
                utterance.voice = voice;
            }
            
            let completed = false;
            
            // Calculate a generous timeout based on text length
            // Chinese takes about 0.3-0.5 seconds per character
            const estimatedDuration = Math.max(2000, sentenceZh.length * 200);
            
            const safetyTimeout = setTimeout(() => {
                if (!completed) {
                    completed = true;
                    console.warn('Cantonese speech timeout after', estimatedDuration, 'ms, continuing...');
                    setTimeout(() => {
                        if (onComplete) onComplete();
                    }, 300);
                }
            }, estimatedDuration + 1000);
            
            utterance.onend = () => {
                if (completed) return;
                completed = true;
                clearTimeout(safetyTimeout);
                // Wait extra 500ms to ensure playback fully ended
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, 500);
            };
            
            utterance.onerror = (err) => {
                console.error('Cantonese speech error:', err);
                if (completed) return;
                completed = true;
                clearTimeout(safetyTimeout);
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, 300);
            };
            
            try {
                synth.speak(utterance);
            } catch(e) {
                console.error('Failed to speak Cantonese:', e);
                if (completed) return;
                completed = true;
                clearTimeout(safetyTimeout);
                if (onComplete) onComplete();
            }
        }
    }
    
    speakNext();
}

// ====================== Show All Words 弹窗（带自动播放功能，全英文界面） ======================

let wordsAutoPlayState = {
    isPlaying: false,
    isPaused: false,
    currentIndex: 0,
    mode: 'sequential',  // 'sequential' or 'random'
    playedIndices: [],
    remainingIndices: [],
    totalCount: 0,
    playWindow: null,
    timeoutId: null
};

function resetWordsAutoPlay() {
    if (wordsAutoPlayState.timeoutId) {
        clearTimeout(wordsAutoPlayState.timeoutId);
        wordsAutoPlayState.timeoutId = null;
    }
    wordsAutoPlayState.isPlaying = false;
    wordsAutoPlayState.isPaused = false;
    wordsAutoPlayState.currentIndex = 0;
    wordsAutoPlayState.playedIndices = [];
    wordsAutoPlayState.remainingIndices = [];
    if (wordsAutoPlayState.playWindow && !wordsAutoPlayState.playWindow.closed) {
        try {
            const doc = wordsAutoPlayState.playWindow.document;
            const playBtn = doc.getElementById('wordsPlayBtn');
            const modeSwitch = doc.getElementById('wordsModeSwitch');
            if (playBtn) {
                playBtn.textContent = '▶️ Play All';
                playBtn.disabled = false;
                playBtn.style.background = '#22c55e';
            }
            if (modeSwitch) modeSwitch.disabled = false;
            const progressSpan = doc.getElementById('wordsProgress');
            if (progressSpan) progressSpan.textContent = `0 / ${wordsAutoPlayState.totalCount}`;
        } catch(e) {}
    }
}

function updateWordsProgress() {
    if (!wordsAutoPlayState.playWindow || wordsAutoPlayState.playWindow.closed) return;
    try {
        const progressSpan = wordsAutoPlayState.playWindow.document.getElementById('wordsProgress');
        if (progressSpan) {
            progressSpan.textContent = `${wordsAutoPlayState.playedIndices.length} / ${wordsAutoPlayState.totalCount}`;
        }
    } catch(e) {}
}

function highlightWordRow(index) {
    if (!wordsAutoPlayState.playWindow || wordsAutoPlayState.playWindow.closed) return;
    try {
        const doc = wordsAutoPlayState.playWindow.document;
        for (let i = 0; i < wordsAutoPlayState.totalCount; i++) {
            const row = doc.getElementById(`word_row_${i}`);
            if (row) {
                if (i === index) {
                    row.style.backgroundColor = '#fff3cd';
                    const firstCell = row.cells[0];
                    if (firstCell && !firstCell.innerHTML.includes('🎵')) {
                        firstCell.innerHTML = '🎵 ' + firstCell.innerHTML;
                    }
                } else {
                    row.style.backgroundColor = '';
                    const firstCell = row.cells[0];
                    if (firstCell) {
                        firstCell.innerHTML = firstCell.innerHTML.replace(/^🎵 /, '');
                    }
                }
            }
        }
    } catch(e) {}
}

function markWordAsPlayed(index) {
    if (!wordsAutoPlayState.playWindow || wordsAutoPlayState.playWindow.closed) return;
    try {
        const doc = wordsAutoPlayState.playWindow.document;
        const row = doc.getElementById(`word_row_${index}`);
        if (row) {
            const meaningCell = row.cells[2];
            if (meaningCell && !meaningCell.innerHTML.includes('✓')) {
                meaningCell.innerHTML = meaningCell.innerHTML + ' ✓';
                meaningCell.style.color = '#999';
            }
            const wordCell = row.cells[1];
            if (wordCell) wordCell.style.color = '#999';
        }
    } catch(e) {}
}

function playNextWord() {
    if (!wordsAutoPlayState.isPlaying || wordsAutoPlayState.isPaused) return;
    
    if (wordsAutoPlayState.playedIndices.length >= wordsAutoPlayState.totalCount) {
        // Playback complete - silent reset
        wordsAutoPlayState.isPlaying = false;
        wordsAutoPlayState.isPaused = false;
        if (wordsAutoPlayState.timeoutId) clearTimeout(wordsAutoPlayState.timeoutId);
        
        if (wordsAutoPlayState.playWindow && !wordsAutoPlayState.playWindow.closed) {
            try {
                const doc = wordsAutoPlayState.playWindow.document;
                const playBtn = doc.getElementById('wordsPlayBtn');
                const modeSwitch = doc.getElementById('wordsModeSwitch');
                if (playBtn) {
                    playBtn.textContent = '▶️ Play All';
                    playBtn.disabled = false;
                    playBtn.style.background = '#22c55e';
                }
                if (modeSwitch) modeSwitch.disabled = false;
            } catch(e) {}
        }
        resetWordsAutoPlay();
        return;
    }
    
    let nextIndex;
    if (wordsAutoPlayState.mode === 'sequential') {
        nextIndex = wordsAutoPlayState.playedIndices.length;
    } else {
        if (wordsAutoPlayState.remainingIndices.length === 0) {
            wordsAutoPlayState.remainingIndices = Array.from({length: wordsAutoPlayState.totalCount}, (_, i) => i);
        }
        const randomPos = Math.floor(Math.random() * wordsAutoPlayState.remainingIndices.length);
        nextIndex = wordsAutoPlayState.remainingIndices[randomPos];
        wordsAutoPlayState.remainingIndices.splice(randomPos, 1);
    }
    
    wordsAutoPlayState.currentIndex = nextIndex;
    highlightWordRow(nextIndex);
    updateWordsProgress();
    
    const word = allWords[nextIndex];
    speakWordWithEnglishAndCantonese(word.word, word.meaning, () => {
        wordsAutoPlayState.playedIndices.push(nextIndex);
        markWordAsPlayed(nextIndex);
        updateWordsProgress();
        
        wordsAutoPlayState.timeoutId = setTimeout(() => {
            playNextWord();
        }, 500);
    });
}

function toggleWordsAutoPlay() {
    const playBtn = wordsAutoPlayState.playWindow ? wordsAutoPlayState.playWindow.document.getElementById('wordsPlayBtn') : null;
    
    if (!wordsAutoPlayState.isPlaying && !wordsAutoPlayState.isPaused) {
        // Start playing
        resetWordsAutoPlay();
        wordsAutoPlayState.isPlaying = true;
        wordsAutoPlayState.isPaused = false;
        wordsAutoPlayState.playedIndices = [];
        wordsAutoPlayState.remainingIndices = [];
        wordsAutoPlayState.totalCount = allWords.length;
        
        if (wordsAutoPlayState.mode === 'random') {
            wordsAutoPlayState.remainingIndices = Array.from({length: allWords.length}, (_, i) => i);
        }
        
        if (wordsAutoPlayState.playWindow && !wordsAutoPlayState.playWindow.closed) {
            try {
                const doc = wordsAutoPlayState.playWindow.document;
                const modeSwitch = doc.getElementById('wordsModeSwitch');
                if (playBtn) {
                    playBtn.textContent = '⏸️ Pause';
                    playBtn.style.background = '#f59e0b';
                }
                if (modeSwitch) modeSwitch.disabled = true;
                
                // Reset all rows visual
                for (let i = 0; i < allWords.length; i++) {
                    const row = doc.getElementById(`word_row_${i}`);
                    if (row) {
                        row.style.backgroundColor = '';
                        row.style.color = '';
                        const firstCell = row.cells[0];
                        if (firstCell) firstCell.innerHTML = firstCell.innerHTML.replace(/^🎵 /, '');
                        const meaningCell = row.cells[2];
                        if (meaningCell) {
                            meaningCell.innerHTML = meaningCell.innerHTML.replace(/ ✓$/, '');
                            meaningCell.style.color = '';
                        }
                        const wordCell = row.cells[1];
                        if (wordCell) wordCell.style.color = '';
                    }
                }
                const progressSpan = doc.getElementById('wordsProgress');
                if (progressSpan) progressSpan.textContent = `0 / ${allWords.length}`;
            } catch(e) {}
        }
        
        playNextWord();
    } else if (wordsAutoPlayState.isPlaying && !wordsAutoPlayState.isPaused) {
        // Pause
        wordsAutoPlayState.isPaused = true;
        wordsAutoPlayState.isPlaying = false;
        if (wordsAutoPlayState.timeoutId) {
            clearTimeout(wordsAutoPlayState.timeoutId);
            wordsAutoPlayState.timeoutId = null;
        }
        if (playBtn) {
            playBtn.textContent = '▶️ Resume';
            playBtn.style.background = '#22c55e';
        }
    } else if (wordsAutoPlayState.isPaused) {
        // Resume
        wordsAutoPlayState.isPaused = false;
        wordsAutoPlayState.isPlaying = true;
        if (playBtn) {
            playBtn.textContent = '⏸️ Pause';
            playBtn.style.background = '#f59e0b';
        }
        playNextWord();
    }
}

function switchWordsPlayMode() {
    const modeSwitch = wordsAutoPlayState.playWindow ? wordsAutoPlayState.playWindow.document.getElementById('wordsModeSwitch') : null;
    const newMode = wordsAutoPlayState.mode === 'sequential' ? 'random' : 'sequential';
    
    // Stop playback if active
    if (wordsAutoPlayState.isPlaying || wordsAutoPlayState.isPaused) {
        if (wordsAutoPlayState.timeoutId) {
            clearTimeout(wordsAutoPlayState.timeoutId);
            wordsAutoPlayState.timeoutId = null;
        }
        wordsAutoPlayState.isPlaying = false;
        wordsAutoPlayState.isPaused = false;
        
        if (wordsAutoPlayState.playWindow && !wordsAutoPlayState.playWindow.closed) {
            try {
                const playBtn = wordsAutoPlayState.playWindow.document.getElementById('wordsPlayBtn');
                if (playBtn) {
                    playBtn.textContent = '▶️ Play All';
                    playBtn.style.background = '#22c55e';
                }
                if (modeSwitch) modeSwitch.disabled = false;
            } catch(e) {}
        }
    }
    
    wordsAutoPlayState.mode = newMode;
    resetWordsAutoPlay();
    
    if (modeSwitch) {
        if (newMode === 'sequential') {
            modeSwitch.textContent = 'Sequential ○──● Random';
        } else {
            modeSwitch.textContent = 'Sequential ●──○ Random';
        }
    }
}

function showAllWords() {
    if (allWords.length === 0) return;
    
    const fileNice = removeFileExtension(currentFileName);
    
    // Build table rows
    let tableRows = '';
    for (let i = 0; i < allWords.length; i++) {
        const w = allWords[i];
        tableRows += `
            <tr id="word_row_${i}" style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px; text-align: center; width: 80px;">${w.day}</td>
                <td style="padding: 12px; font-weight: bold; color: #dc2626;">${escapeHtml(w.word.toUpperCase())}</td>
                <td style="padding: 12px; color: #334155;">${escapeHtml(w.meaning)}</td>
            </tr>
        `;
    }
    
    const allWordsHtml = `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>All Words - ${currentLevel}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', -apple-system, Arial, sans-serif; background: #f0f4f8; padding: 20px; }
            .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #ff9a56, #ff6b35); padding: 16px 20px; }
            .header h2 { color: white; font-size: 20px; font-weight: 600; }
            .header p { color: rgba(255,255,255,0.8); font-size: 13px; margin-top: 4px; }
            .control-bar { background: #f8fafc; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
            .play-btn { background: #22c55e; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
            .play-btn:disabled { background: #94a3b8; cursor: not-allowed; opacity: 0.6; }
            .play-btn:hover:not(:disabled) { opacity: 0.85; transform: scale(0.97); }
            .mode-switch { background: #333; color: white; border: none; border-radius: 40px; padding: 6px 16px; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.2s; min-width: 160px; }
            .mode-switch:disabled { background: #94a3b8; cursor: not-allowed; opacity: 0.6; }
            .progress { font-size: 14px; color: #1e293b; font-weight: 500; margin-left: auto; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f8fafc; padding: 14px 12px; text-align: left; font-weight: 600; color: #1e293b; border-bottom: 2px solid #e2e8f0; }
            th:first-child { width: 80px; text-align: center; }
            td { padding: 12px; vertical-align: top; }
            .footer { padding: 16px 20px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0; }
            .close-btn { background: #ff6b35; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; }
            .close-btn:hover { opacity: 0.85; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>📖 ${currentLevel} - ${escapeHtml(fileNice)}</h2>
                <p>Total ${allWords.length} words</p>
            </div>
            <div class="control-bar">
                <button id="wordsPlayBtn" class="play-btn">▶️ Play All</button>
                <button id="wordsModeSwitch" class="mode-switch">Sequential ○──● Random</button>
                <span id="wordsProgress" class="progress">0 / ${allWords.length}</span>
            </div>
            <table>
                <thead>
                    <tr><th>Day</th><th>Word</th><th>Meaning</th></tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            <div class="footer">
                <button class="close-btn" onclick="window.close()">Close</button>
            </div>
        </div>
        <script>
            window.wordData = ${JSON.stringify(allWords)};
        </script>
    </body>
    </html>`;
    
    const newWindow = window.open('', '_blank', 'width=850,height=700,scrollbars=yes');
    if (newWindow) {
        wordsAutoPlayState.playWindow = newWindow;
        wordsAutoPlayState.totalCount = allWords.length;
        wordsAutoPlayState.mode = 'sequential';
        wordsAutoPlayState.isPlaying = false;
        wordsAutoPlayState.isPaused = false;
        wordsAutoPlayState.playedIndices = [];
        wordsAutoPlayState.remainingIndices = [];
        
        newWindow.document.write(allWordsHtml);
        newWindow.document.close();
        
        setTimeout(() => {
            try {
                const playBtn = newWindow.document.getElementById('wordsPlayBtn');
                const modeSwitch = newWindow.document.getElementById('wordsModeSwitch');
                
                if (playBtn) {
                    playBtn.onclick = () => {
                        toggleWordsAutoPlay();
                    };
                }
                if (modeSwitch) {
                    modeSwitch.onclick = () => {
                        switchWordsPlayMode();
                    };
                }
                
                newWindow.onbeforeunload = () => {
                    if (wordsAutoPlayState.timeoutId) clearTimeout(wordsAutoPlayState.timeoutId);
                    wordsAutoPlayState.isPlaying = false;
                    wordsAutoPlayState.isPaused = false;
                };
            } catch(e) {}
        }, 100);
    } else {
        alert("Popup blocked. Please allow popups for this site.");
    }
}

// ====================== Show All Sentences 弹窗（带自动播放功能，全英文界面） ======================

let sentencesAutoPlayState = {
    isPlaying: false,
    isPaused: false,
    currentIndex: 0,
    mode: 'sequential',
    playedIndices: [],
    remainingIndices: [],
    totalCount: 0,
    playWindow: null,
    timeoutId: null
};

function resetSentencesAutoPlay() {
    if (sentencesAutoPlayState.timeoutId) {
        clearTimeout(sentencesAutoPlayState.timeoutId);
        sentencesAutoPlayState.timeoutId = null;
    }
    sentencesAutoPlayState.isPlaying = false;
    sentencesAutoPlayState.isPaused = false;
    sentencesAutoPlayState.currentIndex = 0;
    sentencesAutoPlayState.playedIndices = [];
    sentencesAutoPlayState.remainingIndices = [];
    if (sentencesAutoPlayState.playWindow && !sentencesAutoPlayState.playWindow.closed) {
        try {
            const doc = sentencesAutoPlayState.playWindow.document;
            const playBtn = doc.getElementById('sentencesPlayBtn');
            const modeSwitch = doc.getElementById('sentencesModeSwitch');
            if (playBtn) {
                playBtn.textContent = '▶️ Play All';
                playBtn.disabled = false;
                playBtn.style.background = '#22c55e';
            }
            if (modeSwitch) modeSwitch.disabled = false;
            const progressSpan = doc.getElementById('sentencesProgress');
            if (progressSpan) progressSpan.textContent = `0 / ${sentencesAutoPlayState.totalCount}`;
        } catch(e) {}
    }
}

function updateSentencesProgress() {
    if (!sentencesAutoPlayState.playWindow || sentencesAutoPlayState.playWindow.closed) return;
    try {
        const progressSpan = sentencesAutoPlayState.playWindow.document.getElementById('sentencesProgress');
        if (progressSpan) {
            progressSpan.textContent = `${sentencesAutoPlayState.playedIndices.length} / ${sentencesAutoPlayState.totalCount}`;
        }
    } catch(e) {}
}

function highlightSentenceRow(index) {
    if (!sentencesAutoPlayState.playWindow || sentencesAutoPlayState.playWindow.closed) return;
    try {
        const doc = sentencesAutoPlayState.playWindow.document;
        for (let i = 0; i < sentencesAutoPlayState.totalCount; i++) {
            const row = doc.getElementById(`sentence_row_${i}`);
            if (row) {
                if (i === index) {
                    row.style.backgroundColor = '#fff3cd';
                    const firstCell = row.cells[0];
                    if (firstCell && !firstCell.innerHTML.includes('🎵')) {
                        firstCell.innerHTML = '🎵 ' + firstCell.innerHTML;
                    }
                } else {
                    row.style.backgroundColor = '';
                    const firstCell = row.cells[0];
                    if (firstCell) {
                        firstCell.innerHTML = firstCell.innerHTML.replace(/^🎵 /, '');
                    }
                }
            }
        }
    } catch(e) {}
}

function markSentenceAsPlayed(index) {
    if (!sentencesAutoPlayState.playWindow || sentencesAutoPlayState.playWindow.closed) return;
    try {
        const doc = sentencesAutoPlayState.playWindow.document;
        const row = doc.getElementById(`sentence_row_${index}`);
        if (row) {
            const meaningCell = row.cells[2];
            if (meaningCell && !meaningCell.innerHTML.includes('✓')) {
                meaningCell.innerHTML = meaningCell.innerHTML + ' ✓';
                meaningCell.style.color = '#999';
            }
            const enCell = row.cells[1];
            if (enCell) enCell.style.color = '#999';
        }
    } catch(e) {}
}

function playNextSentence() {
    if (!sentencesAutoPlayState.isPlaying || sentencesAutoPlayState.isPaused) return;
    
    if (sentencesAutoPlayState.playedIndices.length >= sentencesAutoPlayState.totalCount) {
        // Playback complete - silent reset
        sentencesAutoPlayState.isPlaying = false;
        sentencesAutoPlayState.isPaused = false;
        if (sentencesAutoPlayState.timeoutId) clearTimeout(sentencesAutoPlayState.timeoutId);
        
        if (sentencesAutoPlayState.playWindow && !sentencesAutoPlayState.playWindow.closed) {
            try {
                const doc = sentencesAutoPlayState.playWindow.document;
                const playBtn = doc.getElementById('sentencesPlayBtn');
                const modeSwitch = doc.getElementById('sentencesModeSwitch');
                if (playBtn) {
                    playBtn.textContent = '▶️ Play All';
                    playBtn.disabled = false;
                    playBtn.style.background = '#22c55e';
                }
                if (modeSwitch) modeSwitch.disabled = false;
            } catch(e) {}
        }
        resetSentencesAutoPlay();
        return;
    }
    
    let nextIndex;
    if (sentencesAutoPlayState.mode === 'sequential') {
        nextIndex = sentencesAutoPlayState.playedIndices.length;
    } else {
        if (sentencesAutoPlayState.remainingIndices.length === 0) {
            sentencesAutoPlayState.remainingIndices = Array.from({length: sentencesAutoPlayState.totalCount}, (_, i) => i);
        }
        const randomPos = Math.floor(Math.random() * sentencesAutoPlayState.remainingIndices.length);
        nextIndex = sentencesAutoPlayState.remainingIndices[randomPos];
        sentencesAutoPlayState.remainingIndices.splice(randomPos, 1);
    }
    
    sentencesAutoPlayState.currentIndex = nextIndex;
    highlightSentenceRow(nextIndex);
    updateSentencesProgress();
    
    const sentence = allSentences[nextIndex];
    speakSentenceWithEnglishAndCantonese(sentence.sentence_en, sentence.sentence_zh, () => {
        sentencesAutoPlayState.playedIndices.push(nextIndex);
        markSentenceAsPlayed(nextIndex);
        updateSentencesProgress();
        
        sentencesAutoPlayState.timeoutId = setTimeout(() => {
            playNextSentence();
        }, 600);
    });
}

function toggleSentencesAutoPlay() {
    const playBtn = sentencesAutoPlayState.playWindow ? sentencesAutoPlayState.playWindow.document.getElementById('sentencesPlayBtn') : null;
    
    if (!sentencesAutoPlayState.isPlaying && !sentencesAutoPlayState.isPaused) {
        // Start playing
        resetSentencesAutoPlay();
        sentencesAutoPlayState.isPlaying = true;
        sentencesAutoPlayState.isPaused = false;
        sentencesAutoPlayState.playedIndices = [];
        sentencesAutoPlayState.remainingIndices = [];
        sentencesAutoPlayState.totalCount = allSentences.length;
        
        if (sentencesAutoPlayState.mode === 'random') {
            sentencesAutoPlayState.remainingIndices = Array.from({length: allSentences.length}, (_, i) => i);
        }
        
        if (sentencesAutoPlayState.playWindow && !sentencesAutoPlayState.playWindow.closed) {
            try {
                const doc = sentencesAutoPlayState.playWindow.document;
                const modeSwitch = doc.getElementById('sentencesModeSwitch');
                if (playBtn) {
                    playBtn.textContent = '⏸️ Pause';
                    playBtn.style.background = '#f59e0b';
                }
                if (modeSwitch) modeSwitch.disabled = true;
                
                // Reset all rows visual
                for (let i = 0; i < allSentences.length; i++) {
                    const row = doc.getElementById(`sentence_row_${i}`);
                    if (row) {
                        row.style.backgroundColor = '';
                        row.style.color = '';
                        const firstCell = row.cells[0];
                        if (firstCell) firstCell.innerHTML = firstCell.innerHTML.replace(/^🎵 /, '');
                        const meaningCell = row.cells[2];
                        if (meaningCell) {
                            meaningCell.innerHTML = meaningCell.innerHTML.replace(/ ✓$/, '');
                            meaningCell.style.color = '';
                        }
                        const enCell = row.cells[1];
                        if (enCell) enCell.style.color = '';
                    }
                }
                const progressSpan = doc.getElementById('sentencesProgress');
                if (progressSpan) progressSpan.textContent = `0 / ${allSentences.length}`;
            } catch(e) {}
        }
        
        playNextSentence();
    } else if (sentencesAutoPlayState.isPlaying && !sentencesAutoPlayState.isPaused) {
        // Pause
        sentencesAutoPlayState.isPaused = true;
        sentencesAutoPlayState.isPlaying = false;
        if (sentencesAutoPlayState.timeoutId) {
            clearTimeout(sentencesAutoPlayState.timeoutId);
            sentencesAutoPlayState.timeoutId = null;
        }
        if (playBtn) {
            playBtn.textContent = '▶️ Resume';
            playBtn.style.background = '#22c55e';
        }
    } else if (sentencesAutoPlayState.isPaused) {
        // Resume
        sentencesAutoPlayState.isPaused = false;
        sentencesAutoPlayState.isPlaying = true;
        if (playBtn) {
            playBtn.textContent = '⏸️ Pause';
            playBtn.style.background = '#f59e0b';
        }
        playNextSentence();
    }
}

function switchSentencesPlayMode() {
    const modeSwitch = sentencesAutoPlayState.playWindow ? sentencesAutoPlayState.playWindow.document.getElementById('sentencesModeSwitch') : null;
    const newMode = sentencesAutoPlayState.mode === 'sequential' ? 'random' : 'sequential';
    
    // Stop playback if active
    if (sentencesAutoPlayState.isPlaying || sentencesAutoPlayState.isPaused) {
        if (sentencesAutoPlayState.timeoutId) {
            clearTimeout(sentencesAutoPlayState.timeoutId);
            sentencesAutoPlayState.timeoutId = null;
        }
        sentencesAutoPlayState.isPlaying = false;
        sentencesAutoPlayState.isPaused = false;
        
        if (sentencesAutoPlayState.playWindow && !sentencesAutoPlayState.playWindow.closed) {
            try {
                const playBtn = sentencesAutoPlayState.playWindow.document.getElementById('sentencesPlayBtn');
                if (playBtn) {
                    playBtn.textContent = '▶️ Play All';
                    playBtn.style.background = '#22c55e';
                }
                if (modeSwitch) modeSwitch.disabled = false;
            } catch(e) {}
        }
    }
    
    sentencesAutoPlayState.mode = newMode;
    resetSentencesAutoPlay();
    
    if (modeSwitch) {
        if (newMode === 'sequential') {
            modeSwitch.textContent = 'Sequential ○──● Random';
        } else {
            modeSwitch.textContent = 'Sequential ●──○ Random';
        }
    }
}

function showAllSentencesPopup() {
    if (!allSentences.length) return;
    
    const fileNice = removeFileExtension(currentFileNameForSentences);
    
    let tableRows = '';
    for (let i = 0; i < allSentences.length; i++) {
        const s = allSentences[i];
        tableRows += `
            <tr id="sentence_row_${i}" style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px; text-align: center; width: 60px; color: #64748b;">${i + 1}</td>
                <td style="padding: 12px; font-weight: 500; color: #b45309;">${escapeHtml(s.sentence_en)}</td>
                <td style="padding: 12px; color: #334155;">${escapeHtml(s.sentence_zh)}</td>
              </tr>
        `;
    }
    
    const sentencesHtml = `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>All Sentences - ${currentLevel}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', -apple-system, Arial, sans-serif; background: #f0f4f8; padding: 20px; }
            .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #ff9a56, #ff6b35); padding: 16px 20px; }
            .header h2 { color: white; font-size: 20px; font-weight: 600; }
            .header p { color: rgba(255,255,255,0.8); font-size: 13px; margin-top: 4px; }
            .control-bar { background: #fef9e8; padding: 12px 20px; border-bottom: 1px solid #ffd966; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
            .play-btn { background: #22c55e; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
            .play-btn:disabled { background: #94a3b8; cursor: not-allowed; opacity: 0.6; }
            .play-btn:hover:not(:disabled) { opacity: 0.85; transform: scale(0.97); }
            .mode-switch { background: #333; color: white; border: none; border-radius: 40px; padding: 6px 16px; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.2s; min-width: 160px; }
            .mode-switch:disabled { background: #94a3b8; cursor: not-allowed; opacity: 0.6; }
            .progress { font-size: 14px; color: #1e293b; font-weight: 500; margin-left: auto; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #fef9e8; padding: 14px 12px; text-align: left; font-weight: 600; color: #c2410c; border-bottom: 2px solid #ffd966; }
            th:first-child { width: 60px; text-align: center; }
            td { padding: 12px; vertical-align: top; }
            .footer { padding: 16px 20px; background: #fef9e8; text-align: center; border-top: 1px solid #ffd966; }
            .close-btn { background: #ff6b35; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; }
            .close-btn:hover { opacity: 0.85; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>✏️ ${currentLevel} - ${escapeHtml(fileNice)}</h2>
                <p>Total ${allSentences.length} sentences</p>
            </div>
            <div class="control-bar">
                <button id="sentencesPlayBtn" class="play-btn">▶️ Play All</button>
                <button id="sentencesModeSwitch" class="mode-switch">Sequential ○──● Random</button>
                <span id="sentencesProgress" class="progress">0 / ${allSentences.length}</span>
            </div>
            <table>
                <thead>
                    <tr><th>#</th><th>English</th><th>Chinese</th></tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            <div class="footer">
                <button class="close-btn" onclick="window.close()">Close</button>
            </div>
        </div>
        <script>
            window.sentenceData = ${JSON.stringify(allSentences)};
        </script>
    </body>
    </html>`;
    
    const win = window.open('', '_blank', 'width=950,height=700,scrollbars=yes');
    if (win) {
        sentencesAutoPlayState.playWindow = win;
        sentencesAutoPlayState.totalCount = allSentences.length;
        sentencesAutoPlayState.mode = 'sequential';
        sentencesAutoPlayState.isPlaying = false;
        sentencesAutoPlayState.isPaused = false;
        sentencesAutoPlayState.playedIndices = [];
        sentencesAutoPlayState.remainingIndices = [];
        
        win.document.write(sentencesHtml);
        win.document.close();
        
        setTimeout(() => {
            try {
                const playBtn = win.document.getElementById('sentencesPlayBtn');
                const modeSwitch = win.document.getElementById('sentencesModeSwitch');
                
                if (playBtn) {
                    playBtn.onclick = () => {
                        toggleSentencesAutoPlay();
                    };
                }
                if (modeSwitch) {
                    modeSwitch.onclick = () => {
                        switchSentencesPlayMode();
                    };
                }
                
                win.onbeforeunload = () => {
                    if (sentencesAutoPlayState.timeoutId) clearTimeout(sentencesAutoPlayState.timeoutId);
                    sentencesAutoPlayState.isPlaying = false;
                    sentencesAutoPlayState.isPaused = false;
                };
            } catch(e) {}
        }, 100);
    } else {
        alert("Popup blocked. Please allow popups for this site.");
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
    
    levelConfirm.addEventListener('click', function() {
        this.style.opacity = '0.7';
        setTimeout(() => this.style.opacity = '1', 200);
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
        
        const selected = fileSelect.value;
        const invalid = ["", "Loading...", "No files available", "Load failed"];
        
        if (invalid.includes(selected)) {
            alert('Please select a valid file!');
            return;
        }
        
        await loadSelectedFile(selected);
    });
    
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
        
        if (config.level) {
            levelSelect.value = config.level;
            currentLevel = config.level;
            await loadFileListByLevel(config.level);
            
            if (config.file) {
                await new Promise(r => setTimeout(r, 300));
                let optionExists = false;
                for (let i = 0; i < fileSelect.options.length; i++) {
                    if (fileSelect.options[i].value === config.file) {
                        optionExists = true;
                        break;
                    }
                }
                
                if (optionExists) {
                    fileSelect.value = config.file;
                    await loadSelectedFile(config.file);
                    
                    if (config.daySelect) {
                        daySelect.value = config.daySelect;
                        dayNum.value = config.dayNum;
                        daySelect.dispatchEvent(new Event('change'));
                        filterByDay();
                        
                        if (config.wordIdx !== undefined && filteredWords[config.wordIdx]) {
                            currentWordIdx = config.wordIdx;
                            showWord();
                        }
                        
                        if (config.sentenceIdx !== undefined && allSentences[config.sentenceIdx]) {
                            currentSentenceIdx = config.sentenceIdx;
                            updateSentenceUI();
                        }
                    }
                }
            }
        }
    }
    
    setTimeout(autoRestore, 800);
});
