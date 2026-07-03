// ====================== 全局狀態變量 ======================
let allWords = [];          
let filteredWords = [];     
let currentWordIdx = 0;     
let currentFileName = "";   
let currentLevel = "";      

let allSentences = [];      
let currentSentenceIdx = 0; 
let currentFileNameForSentences = ""; 

const synth = window.speechSynthesis;

// 英文朗讀相關變量
let isWordReading = false;
let isSentenceReading = false;
let currentWordReadButton = null;
let currentSentenceReadButton = null;
let currentWordText = "";
let currentSentenceText = "";
let currentReadCount = 0;

// 粵語朗讀相關變量
let isCantoneseReading = false;
let currentCantoneseButton = null;
let currentCantoneseText = "";

// ====================== Quiz 狀態 ======================
let quizState = {
    questions: [],
    userAnswers: {},        // { 0: 'A', 1: 'B', 2: 'C' }
    results: {},            // { 0: true, 1: false }
    answeredCount: 0,
    totalCorrect: 0,
    isPlaying: false,
    currentPlayingIndex: null
};

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

function resetDayArea() {
    const daySelect = document.getElementById('daySelect');
    const dayNum = document.getElementById('dayNum');
    if (daySelect) {
        daySelect.value = 'all';
        daySelect.dispatchEvent(new Event('change'));
    }
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function getRandomItems(arr, count) {
    const shuffled = shuffleArray([...arr]);
    return shuffled.slice(0, count);
}

// ====================== 英文語音模塊 ======================
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

function speakSequence(texts, onComplete, delay = 800) {
    let index = 0;
    
    function speakNext() {
        if (index >= texts.length) {
            if (onComplete) onComplete();
            return;
        }
        const text = texts[index];
        if (text && text.trim()) {
            speakOnce(text, () => {
                index++;
                setTimeout(speakNext, delay);
            });
        } else {
            index++;
            setTimeout(speakNext, delay);
        }
    }
    
    speakNext();
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

// ====================== 粵語語音模塊 ======================
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

// 預熱語音引擎
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
        resetQuizState();
        
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
            phonetics: item.phonetics || item.phonetic || item.pronunciation || item.音標 || null,
            syllable: item.syllable || item.syllable_splitting || item.syllables || item.音節 || item.音節劃分 || null,
            english_explanation: item['English explanation'] || item.english_explanation || item.english || item.English_explanation || null
        }));
        
        filteredWords = [...allWords];
        currentWordIdx = 0;
        resetQuizState();
        
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

// ====================== 篩選與導航邏輯 ======================
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
    resetQuizState();
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
    
    let detailsHtml = '';
    if (w.syllable || w.phonetics) {
        if (w.syllable && w.syllable.trim() !== '') {
            detailsHtml += `<div class="syllable" style="font-size: 20px; color: #ff9a56; letter-spacing: 1px; margin-top: 8px;">${w.syllable}</div>`;
        }
        if (w.phonetics && w.phonetics.trim() !== '') {
            detailsHtml += `<div class="phonetics" style="font-size: 16px; color: #64748b; font-family: monospace; margin-top: 4px;">${w.phonetics}</div>`;
        }
    }
    
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
    
    const cantoneseBtn = document.getElementById("readCantoneseBtn");
    if (cantoneseBtn) {
        cantoneseBtn.onclick = () => {
            toggleCantoneseReading(w.meaning, cantoneseBtn);
        };
    }
    
    let isWordVisible = false;
    const wordSpan = document.getElementById("currentWordSpan");
    
    const showBtn = document.getElementById("btnShowWord");
    if (showBtn) {
        showBtn.onclick = () => {
            if (isWordVisible) {
                wordSpan.style.display = "none";
                showBtn.textContent = "👀 Show Word";
                isWordVisible = false;
            } else {
                wordSpan.style.display = "block";
                showBtn.textContent = "🙈 Hide Word";
                isWordVisible = true;
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

// ====================== 句子相關功能 ======================
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
    if (hiddenSpan) {
        if (hiddenSpan.style.display === "none" || hiddenSpan.style.display === "") {
            hiddenSpan.style.display = "block";
            const showBtn = document.getElementById("showSentenceBtn");
            if (showBtn) showBtn.textContent = "🙈 Hide Sentence";
        } else {
            hiddenSpan.style.display = "none";
            const showBtn = document.getElementById("showSentenceBtn");
            if (showBtn) showBtn.textContent = "📖 Show Sentence";
        }
    }
}

function prevSentence() {
    if (allSentences.length && currentSentenceIdx > 0) {
        currentSentenceIdx--;
        updateSentenceUI();
        stopAllReading();
        const hiddenSpan = document.getElementById("sentenceEnHidden");
        const showBtn = document.getElementById("showSentenceBtn");
        if (hiddenSpan) hiddenSpan.style.display = "none";
        if (showBtn) showBtn.textContent = "📖 Show Sentence";
    }
}

function nextSentence() {
    if (allSentences.length && currentSentenceIdx < allSentences.length - 1) {
        currentSentenceIdx++;
        updateSentenceUI();
        stopAllReading();
        const hiddenSpan = document.getElementById("sentenceEnHidden");
        const showBtn = document.getElementById("showSentenceBtn");
        if (hiddenSpan) hiddenSpan.style.display = "none";
        if (showBtn) showBtn.textContent = "📖 Show Sentence";
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
    
    if (showBtn) {
        showBtn.onclick = () => {
            showCurrentSentence();
        };
    }
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

// ====================== 輔助函數 ======================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function stopAllReading() {
    stopWordReading();
    stopSentenceReading();
    stopCantoneseReading();
    
    if (window.wordsAutoPlayInterval) {
        clearTimeout(window.wordsAutoPlayInterval);
        window.wordsAutoPlayInterval = null;
    }
    if (window.sentencesAutoPlayInterval) {
        clearTimeout(window.sentencesAutoPlayInterval);
        window.sentencesAutoPlayInterval = null;
    }
    if (quizState.isPlaying) {
        stopQuizReading();
    }
}

// ====================== Quiz 功能 ======================

function resetQuizState() {
    quizState.questions = [];
    quizState.userAnswers = {};
    quizState.results = {};
    quizState.answeredCount = 0;
    quizState.totalCorrect = 0;
    quizState.isPlaying = false;
    quizState.currentPlayingIndex = null;
    try { synth.cancel(); } catch(e) {}
}

function generateQuizQuestions() {
    const words = filteredWords.length > 0 ? filteredWords : allWords;
    if (words.length === 0) return [];
    
    const questions = [];
    const wordPool = words.map(w => w.word);
    
    for (let i = 0; i < words.length; i++) {
        const currentWord = words[i];
        // 獲取干擾答案（從所有單詞中排除當前單詞）
        const distractors = wordPool.filter(w => w !== currentWord.word);
        // 隨機選取 2 個干擾答案
        const selectedDistractors = getRandomItems(distractors, 2);
        
        // 為 A、B、C 三個選單各自獨立生成選項
        const options = {
            A: shuffleArray([currentWord.word, ...selectedDistractors]),
            B: shuffleArray([currentWord.word, ...getRandomItems(distractors, 2)]),
            C: shuffleArray([currentWord.word, ...getRandomItems(distractors, 2)])
        };
        
        questions.push({
            index: i,
            word: currentWord.word,
            meaning: currentWord.meaning,
            englishExplanation: currentWord.english_explanation || currentWord.meaning,
            options: options,
            correctAnswer: currentWord.word
        });
    }
    
    return questions;
}

function renderQuizTab() {
    const words = filteredWords.length > 0 ? filteredWords : allWords;
    if (words.length === 0) {
        return `<div style="padding: 40px; text-align: center; color: #64748b;">No words available for quiz.</div>`;
    }
    
    quizState.questions = generateQuizQuestions();
    quizState.userAnswers = {};
    quizState.results = {};
    quizState.answeredCount = 0;
    quizState.totalCorrect = 0;
    
    let tableRows = '';
    for (let i = 0; i < quizState.questions.length; i++) {
        const q = quizState.questions[i];
        const explanation = q.englishExplanation || q.meaning;
        const answerDisplay = quizState.userAnswers[i] ? quizState.userAnswers[i] : 'Please select';
        const resultDisplay = quizState.results[i] !== undefined ? (quizState.results[i] ? '✅' : '❌') : '';
        const isAnswered = quizState.results[i] !== undefined;
        
        // 生成三個下拉選單
        const optionAOptions = q.options.A.map(opt => 
            `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`
        ).join('');
        const optionBOptions = q.options.B.map(opt => 
            `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`
        ).join('');
        const optionCOptions = q.options.C.map(opt => 
            `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`
        ).join('');
        
        const selectedA = quizState.userAnswers[i] === 'A' ? `value="${escapeHtml(q.options.A[0])}"` : '';
        const selectedB = quizState.userAnswers[i] === 'B' ? `value="${escapeHtml(q.options.B[0])}"` : '';
        const selectedC = quizState.userAnswers[i] === 'C' ? `value="${escapeHtml(q.options.C[0])}"` : '';
        
        // 判斷邊框顏色
        let borderStyleA = '';
        let borderStyleB = '';
        let borderStyleC = '';
        if (isAnswered) {
            const isCorrect = quizState.results[i];
            const color = isCorrect ? '#22c55e' : '#ef4444';
            if (quizState.userAnswers[i] === 'A') borderStyleA = `style="border: 2px solid ${color};"`;
            if (quizState.userAnswers[i] === 'B') borderStyleB = `style="border: 2px solid ${color};"`;
            if (quizState.userAnswers[i] === 'C') borderStyleC = `style="border: 2px solid ${color};"`;
        }
        
        const answerClass = isAnswered ? 'answered' : 'unanswered';
        const answerStyle = isAnswered ? 'font-weight: bold; color: #1e293b;' : 'font-style: italic; color: #94a3b8;';
        
        tableRows += `
            <tr id="quiz_row_${i}" style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px; text-align: center; width: 50px;">${i + 1}</td>
                <td style="padding: 12px; color: #334155;">${escapeHtml(explanation)}</td>
                <td style="padding: 8px; width: 140px;">
                    <select id="quiz_select_A_${i}" ${borderStyleA} style="width: 100%; padding: 6px 8px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 14px; background: white; cursor: pointer;" onchange="handleQuizAnswer(${i}, 'A')">
                        <option value="">— Select —</option>
                        ${optionAOptions}
                    </select>
                </td>
                <td style="padding: 8px; width: 140px;">
                    <select id="quiz_select_B_${i}" ${borderStyleB} style="width: 100%; padding: 6px 8px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 14px; background: white; cursor: pointer;" onchange="handleQuizAnswer(${i}, 'B')">
                        <option value="">— Select —</option>
                        ${optionBOptions}
                    </select>
                </td>
                <td style="padding: 8px; width: 140px;">
                    <select id="quiz_select_C_${i}" ${borderStyleC} style="width: 100%; padding: 6px 8px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 14px; background: white; cursor: pointer;" onchange="handleQuizAnswer(${i}, 'C')">
                        <option value="">— Select —</option>
                        ${optionCOptions}
                    </select>
                </td>
                <td style="padding: 12px; text-align: center; ${answerStyle}">${answerDisplay}</td>
                <td style="padding: 12px; text-align: center; font-size: 18px;">${resultDisplay}</td>
                <td style="padding: 12px; text-align: center;">
                    <button id="quiz_listen_${i}" style="background: none; border: none; font-size: 20px; cursor: pointer; padding: 4px 8px; border-radius: 8px; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'" onclick="playQuizQuestion(${i})">🔊</button>
                </td>
            </tr>
        `;
    }
    
    const total = quizState.questions.length;
    const answered = quizState.answeredCount;
    const accuracy = answered > 0 ? Math.round((quizState.totalCorrect / answered) * 100) : 0;
    
    return `
        <div style="padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; gap: 20px; flex-wrap: wrap; align-items: center;">
            <div style="background: white; padding: 8px 16px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <span style="font-weight: 600; color: #1e293b;">📊 Total Questions:</span>
                <span style="color: #ff6b35; font-weight: bold;">${total}</span>
            </div>
            <div style="background: white; padding: 8px 16px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <span style="font-weight: 600; color: #1e293b;">✅ Answered:</span>
                <span style="color: #22c55e; font-weight: bold;" id="quizAnsweredCount">${answered}</span>
            </div>
            <div style="background: white; padding: 8px 16px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <span style="font-weight: 600; color: #1e293b;">🎯 Accuracy:</span>
                <span style="color: #3b82f6; font-weight: bold;" id="quizAccuracy">${accuracy}%</span>
            </div>
        </div>
        <div style="overflow-x: auto; padding: 0 4px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background: #ff9a56; color: white;">
                        <th style="padding: 12px; text-align: center; width: 50px;">#</th>
                        <th style="padding: 12px; text-align: left;">English Explanation</th>
                        <th style="padding: 12px; text-align: center; width: 140px;">Option A</th>
                        <th style="padding: 12px; text-align: center; width: 140px;">Option B</th>
                        <th style="padding: 12px; text-align: center; width: 140px;">Option C</th>
                        <th style="padding: 12px; text-align: center; width: 100px;">Your Answer</th>
                        <th style="padding: 12px; text-align: center; width: 70px;">Result</th>
                        <th style="padding: 12px; text-align: center; width: 60px;">Listen</th>
                    </tr>
                </thead>
                <tbody id="quizTableBody">
                    ${tableRows}
                </tbody>
            </table>
        </div>
        <div style="padding: 16px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button id="resetQuizBtn" style="background: #ef4444; color: white; border: none; border-radius: 40px; padding: 10px 28px; font-size: 15px; font-weight: bold; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                🔄 Reset Quiz
            </button>
        </div>
    `;
}

function handleQuizAnswer(questionIndex, selectedOption) {
    const q = quizState.questions[questionIndex];
    if (!q) return;
    
    const selectElement = document.getElementById(`quiz_select_${selectedOption}_${questionIndex}`);
    if (!selectElement) return;
    
    const selectedValue = selectElement.value;
    if (!selectedValue) {
        // 如果用戶選擇了空值（— Select —），重置該題答案
        delete quizState.userAnswers[questionIndex];
        delete quizState.results[questionIndex];
        // 重新計算統計
        recalcQuizStats();
        updateQuizUI(questionIndex);
        return;
    }
    
    // 檢查是否正確
    const isCorrect = selectedValue === q.correctAnswer;
    
    // 如果之前已經答過，需要先扣除之前的統計
    if (quizState.results[questionIndex] !== undefined) {
        if (quizState.results[questionIndex]) {
            quizState.totalCorrect--;
        }
        quizState.answeredCount--;
    }
    
    // 更新答案
    quizState.userAnswers[questionIndex] = selectedOption;
    quizState.results[questionIndex] = isCorrect;
    quizState.answeredCount++;
    if (isCorrect) {
        quizState.totalCorrect++;
    }
    
    // 更新統計顯示
    updateQuizStats();
    
    // 更新 UI（邊框顏色、Your Answer、Result）
    updateQuizUI(questionIndex);
}

function recalcQuizStats() {
    quizState.answeredCount = 0;
    quizState.totalCorrect = 0;
    for (let i = 0; i < quizState.questions.length; i++) {
        if (quizState.results[i] !== undefined) {
            quizState.answeredCount++;
            if (quizState.results[i]) {
                quizState.totalCorrect++;
            }
        }
    }
}

function updateQuizStats() {
    const answeredSpan = document.getElementById('quizAnsweredCount');
    const accuracySpan = document.getElementById('quizAccuracy');
    if (answeredSpan) {
        answeredSpan.textContent = quizState.answeredCount;
    }
    if (accuracySpan) {
        const accuracy = quizState.answeredCount > 0 ? Math.round((quizState.totalCorrect / quizState.answeredCount) * 100) : 0;
        accuracySpan.textContent = `${accuracy}%`;
    }
}

function updateQuizUI(questionIndex) {
    const q = quizState.questions[questionIndex];
    if (!q) return;
    
    const isAnswered = quizState.results[questionIndex] !== undefined;
    const isCorrect = isAnswered ? quizState.results[questionIndex] : false;
    const answerDisplay = quizState.userAnswers[questionIndex] || 'Please select';
    const resultDisplay = isAnswered ? (isCorrect ? '✅' : '❌') : '';
    
    // 更新 Your Answer 和 Result 欄位
    const row = document.getElementById(`quiz_row_${questionIndex}`);
    if (row) {
        const cells = row.getElementsByTagName('td');
        if (cells.length >= 7) {
            // Your Answer 欄位 (index 5)
            cells[5].textContent = answerDisplay;
            cells[5].style.fontWeight = isAnswered ? 'bold' : 'normal';
            cells[5].style.color = isAnswered ? '#1e293b' : '#94a3b8';
            cells[5].style.fontStyle = isAnswered ? 'normal' : 'italic';
            // Result 欄位 (index 6)
            cells[6].textContent = resultDisplay;
        }
    }
    
    // 更新下拉選單邊框顏色
    const options = ['A', 'B', 'C'];
    options.forEach(opt => {
        const selectEl = document.getElementById(`quiz_select_${opt}_${questionIndex}`);
        if (selectEl) {
            if (isAnswered && quizState.userAnswers[questionIndex] === opt) {
                selectEl.style.border = `2px solid ${isCorrect ? '#22c55e' : '#ef4444'}`;
            } else {
                selectEl.style.border = '1px solid #cbd5e1';
            }
        }
    });
}

function playQuizQuestion(questionIndex) {
    const q = quizState.questions[questionIndex];
    if (!q) return;
    
    // 如果正在播放，停止
    if (quizState.isPlaying) {
        try { synth.cancel(); } catch(e) {}
        quizState.isPlaying = false;
        quizState.currentPlayingIndex = null;
        // 重置所有按鈕文字
        document.querySelectorAll('[id^="quiz_listen_"]').forEach(btn => {
            btn.textContent = '🔊';
        });
        return;
    }
    
    // 構建朗讀序列
    const texts = [];
    texts.push(`Number ${questionIndex + 1}`);
    texts.push(q.englishExplanation || q.meaning);
    texts.push(`Option A: ${q.options.A.join(', ')}`);
    texts.push(`Option B: ${q.options.B.join(', ')}`);
    texts.push(`Option C: ${q.options.C.join(', ')}`);
    
    const listenBtn = document.getElementById(`quiz_listen_${questionIndex}`);
    if (listenBtn) {
        listenBtn.textContent = '⏹️';
    }
    
    quizState.isPlaying = true;
    quizState.currentPlayingIndex = questionIndex;
    
    // 高亮當前行
    highlightQuizRow(questionIndex);
    
    speakSequence(texts, () => {
        quizState.isPlaying = false;
        quizState.currentPlayingIndex = null;
        if (listenBtn) {
            listenBtn.textContent = '🔊';
        }
        unhighlightQuizRow(questionIndex);
    }, 800);
}

function highlightQuizRow(index) {
    const row = document.getElementById(`quiz_row_${index}`);
    if (row) {
        row.style.backgroundColor = '#fff3cd';
    }
}

function unhighlightQuizRow(index) {
    const row = document.getElementById(`quiz_row_${index}`);
    if (row) {
        row.style.backgroundColor = '';
    }
}

function stopQuizReading() {
    try { synth.cancel(); } catch(e) {}
    quizState.isPlaying = false;
    if (quizState.currentPlayingIndex !== null) {
        unhighlightQuizRow(quizState.currentPlayingIndex);
        const btn = document.getElementById(`quiz_listen_${quizState.currentPlayingIndex}`);
        if (btn) btn.textContent = '🔊';
        quizState.currentPlayingIndex = null;
    }
}

function resetQuiz() {
    stopQuizReading();
    quizState.userAnswers = {};
    quizState.results = {};
    quizState.answeredCount = 0;
    quizState.totalCorrect = 0;
    
    // 重新生成題目（保持與當前單詞一致）
    quizState.questions = generateQuizQuestions();
    
    // 重新渲染整個 Quiz 標籤頁
    const quizContainer = document.getElementById('quizContainer');
    if (quizContainer) {
        quizContainer.innerHTML = renderQuizTab();
        // 重新綁定事件（因為 innerHTML 替換了 DOM）
        attachQuizEvents();
    }
}

function attachQuizEvents() {
    // Reset 按鈕事件
    const resetBtn = document.getElementById('resetQuizBtn');
    if (resetBtn) {
        resetBtn.onclick = resetQuiz;
    }
}

// ====================== Show All Words 彈窗（整合 Quiz） ======================

let wordsAutoPlayState = {
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
            const stopBtn = doc.getElementById('wordsStopBtn');
            const modeSwitch = doc.getElementById('wordsModeSwitch');
            if (playBtn) {
                playBtn.textContent = '▶️ Play All';
                playBtn.disabled = false;
                playBtn.style.background = '#22c55e';
            }
            if (stopBtn) {
                stopBtn.disabled = true;
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
        wordsAutoPlayState.isPlaying = false;
        wordsAutoPlayState.isPaused = false;
        if (wordsAutoPlayState.timeoutId) clearTimeout(wordsAutoPlayState.timeoutId);
        
        if (wordsAutoPlayState.playWindow && !wordsAutoPlayState.playWindow.closed) {
            try {
                const doc = wordsAutoPlayState.playWindow.document;
                const playBtn = doc.getElementById('wordsPlayBtn');
                const stopBtn = doc.getElementById('wordsStopBtn');
                const modeSwitch = doc.getElementById('wordsModeSwitch');
                if (playBtn) {
                    playBtn.textContent = '▶️ Play All';
                    playBtn.disabled = false;
                    playBtn.style.background = '#22c55e';
                }
                if (stopBtn) {
                    stopBtn.disabled = true;
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
    const stopBtn = wordsAutoPlayState.playWindow ? wordsAutoPlayState.playWindow.document.getElementById('wordsStopBtn') : null;
    
    if (!wordsAutoPlayState.isPlaying && !wordsAutoPlayState.isPaused) {
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
                if (stopBtn) {
                    stopBtn.disabled = false;
                }
                if (modeSwitch) modeSwitch.disabled = true;
                
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
        wordsAutoPlayState.isPaused = false;
        wordsAutoPlayState.isPlaying = true;
        if (playBtn) {
            playBtn.textContent = '⏸️ Pause';
            playBtn.style.background = '#f59e0b';
        }
        playNextWord();
    }
}

function stopWordsAutoPlay() {
    try { synth.cancel(); } catch(e) {}
    
    if (wordsAutoPlayState.timeoutId) {
        clearTimeout(wordsAutoPlayState.timeoutId);
        wordsAutoPlayState.timeoutId = null;
    }
    
    wordsAutoPlayState.isPlaying = false;
    wordsAutoPlayState.isPaused = false;
    wordsAutoPlayState.playedIndices = [];
    wordsAutoPlayState.remainingIndices = [];
    wordsAutoPlayState.currentIndex = 0;
    
    if (wordsAutoPlayState.playWindow && !wordsAutoPlayState.playWindow.closed) {
        try {
            const doc = wordsAutoPlayState.playWindow.document;
            const playBtn = doc.getElementById('wordsPlayBtn');
            const stopBtn = doc.getElementById('wordsStopBtn');
            const modeSwitch = doc.getElementById('wordsModeSwitch');
            const progressSpan = doc.getElementById('wordsProgress');
            
            if (playBtn) {
                playBtn.textContent = '▶️ Play All';
                playBtn.disabled = false;
                playBtn.style.background = '#22c55e';
            }
            if (stopBtn) {
                stopBtn.disabled = true;
            }
            if (modeSwitch) {
                modeSwitch.disabled = false;
            }
            if (progressSpan) {
                progressSpan.textContent = `0 / ${wordsAutoPlayState.totalCount}`;
            }
            
            for (let i = 0; i < wordsAutoPlayState.totalCount; i++) {
                const row = doc.getElementById(`word_row_${i}`);
                if (row) {
                    row.style.backgroundColor = '';
                    const firstCell = row.cells[0];
                    if (firstCell) {
                        firstCell.innerHTML = firstCell.innerHTML.replace(/^🎵 /, '');
                    }
                    const meaningCell = row.cells[2];
                    if (meaningCell) {
                        meaningCell.innerHTML = meaningCell.innerHTML.replace(/ ✓$/, '');
                        meaningCell.style.color = '';
                    }
                    const wordCell = row.cells[1];
                    if (wordCell) wordCell.style.color = '';
                }
            }
        } catch(e) {}
    }
}

function switchWordsPlayMode() {
    const modeSwitch = wordsAutoPlayState.playWindow ? wordsAutoPlayState.playWindow.document.getElementById('wordsModeSwitch') : null;
    const newMode = wordsAutoPlayState.mode === 'sequential' ? 'random' : 'sequential';
    
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
                const stopBtn = wordsAutoPlayState.playWindow.document.getElementById('wordsStopBtn');
                if (playBtn) {
                    playBtn.textContent = '▶️ Play All';
                    playBtn.style.background = '#22c55e';
                }
                if (stopBtn) {
                    stopBtn.disabled = true;
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
            
            utterance.onend = () => {
                if (completed) return;
                completed = true;
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, 350);
            };
            
            utterance.onerror = (err) => {
                console.error('Cantonese speech error:', err);
                if (completed) return;
                completed = true;
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, 250);
            };
            
            try {
                synth.speak(utterance);
            } catch(e) {
                console.error('Failed to speak Cantonese:', e);
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
            const utterance = new SpeechSynthesisUtterance(sentenceZh);
            utterance.lang = "yue";
            utterance.rate = 0.85;
            utterance.pitch = 1.0;
            utterance.volume = 1;
            
            const voice = getCantoneseVoice();
            if (voice) {
                utterance.voice = voice;
            }
            
            let completed = false;
            
            utterance.onend = () => {
                if (completed) return;
                completed = true;
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, 400);
            };
            
            utterance.onerror = (err) => {
                console.error('Cantonese speech error:', err);
                if (completed) return;
                completed = true;
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, 300);
            };
            
            try {
                synth.speak(utterance);
            } catch(e) {
                console.error('Failed to speak Cantonese:', e);
                if (onComplete) onComplete();
            }
        }
    }
    
    speakNext();
}

// ====================== Show All Words 彈窗（主函數） ======================

function showAllWords() {
    if (allWords.length === 0) return;
    
    const fileNice = removeFileExtension(currentFileName);
    const words = filteredWords.length > 0 ? filteredWords : allWords;
    
    // 構建單詞列表表格
    let tableRows = '';
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        tableRows += `
            <tr id="word_row_${i}" style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px; text-align: center; width: 80px;">${w.day}</td>
                <td style="padding: 12px; font-weight: bold; color: #dc2626;">${escapeHtml(w.word.toUpperCase())}</td>
                <td style="padding: 12px; color: #334155;">${escapeHtml(w.meaning)}</td>
            </tr>
        `;
    }
    
    // 構建完整彈窗 HTML（包含標籤頁）
    const allWordsHtml = `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>All Words - ${currentLevel}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', -apple-system, Arial, sans-serif; background: #f0f4f8; padding: 20px; }
            .container { max-width: 1100px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #ff9a56, #ff6b35); padding: 16px 24px; }
            .header h2 { color: white; font-size: 20px; font-weight: 600; }
            .header p { color: rgba(255,255,255,0.8); font-size: 13px; margin-top: 4px; }
            
            /* 標籤頁樣式 */
            .tab-bar { background: #f8fafc; padding: 8px 20px 0 20px; border-bottom: 2px solid #e2e8f0; display: flex; gap: 4px; }
            .tab-btn { padding: 10px 20px; border: none; background: transparent; font-size: 15px; font-weight: 600; color: #64748b; cursor: pointer; border-radius: 8px 8px 0 0; transition: all 0.2s; }
            .tab-btn:hover { background: #f1f5f9; color: #1e293b; }
            .tab-btn.active { background: white; color: #ff6b35; border-bottom: 3px solid #ff6b35; }
            .tab-content { display: none; padding: 0; }
            .tab-content.active { display: block; }
            
            .control-bar { background: #f8fafc; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
            .play-btn { background: #22c55e; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
            .play-btn:disabled { background: #94a3b8; cursor: not-allowed; opacity: 0.6; }
            .play-btn:hover:not(:disabled) { opacity: 0.85; transform: scale(0.97); }
            .stop-btn { background: #ef4444; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
            .stop-btn:disabled { background: #f0a3a3; cursor: not-allowed; opacity: 0.6; }
            .stop-btn:hover:not(:disabled) { opacity: 0.85; transform: scale(0.97); }
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
            
            /* Quiz 表格樣式覆蓋 */
            .quiz-table th { background: #ff9a56; color: white; }
            .quiz-table td { padding: 10px 8px; }
            .quiz-table select { width: 100%; padding: 6px 8px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px; background: white; cursor: pointer; }
            .quiz-table select:focus { outline: none; border-color: #ff9a56; }
            
            /* 響應式 */
            @media (max-width: 768px) {
                .container { max-width: 100%; border-radius: 12px; }
                .tab-btn { padding: 8px 12px; font-size: 13px; }
                .control-bar { flex-direction: column; align-items: stretch; }
                .progress { margin-left: 0; text-align: center; }
                .quiz-table th, .quiz-table td { padding: 6px 4px; font-size: 12px; }
                .quiz-table select { font-size: 12px; padding: 4px 6px; }
            }
            @media (max-width: 480px) {
                body { padding: 10px; }
                .header h2 { font-size: 17px; }
                .tab-btn { font-size: 12px; padding: 6px 10px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>📖 ${currentLevel} - ${escapeHtml(fileNice)}</h2>
                <p>Total ${words.length} words</p>
            </div>
            
            <!-- 標籤頁 -->
            <div class="tab-bar">
                <button class="tab-btn active" data-tab="wordlist" onclick="switchTab('wordlist')">📚 Word List</button>
                <button class="tab-btn" data-tab="quiz" onclick="switchTab('quiz')">📝 Multiple Choice Quiz</button>
            </div>
            
            <!-- Word List 標籤頁 -->
            <div id="tab-wordlist" class="tab-content active">
                <div class="control-bar">
                    <button id="wordsPlayBtn" class="play-btn">▶️ Play All</button>
                    <button id="wordsStopBtn" class="stop-btn" disabled>⏹️ Stop</button>
                    <button id="wordsModeSwitch" class="mode-switch">Sequential ○──● Random</button>
                    <span id="wordsProgress" class="progress">0 / ${words.length}</span>
                </div>
                <table>
                    <thead>
                        <tr><th>Day</th><th>Word</th><th>Meaning</th></tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
            
            <!-- Quiz 標籤頁 -->
            <div id="tab-quiz" class="tab-content">
                <div id="quizContainer">
                    ${renderQuizTab()}
                </div>
            </div>
            
            <div class="footer">
                <button class="close-btn" onclick="window.close()">Close</button>
            </div>
        </div>
        <script>
            // 傳遞數據到彈窗
            window.wordData = ${JSON.stringify(words)};
            window.allWordsData = ${JSON.stringify(allWords)};
            window.filteredWordsData = ${JSON.stringify(filteredWords)};
            
            // 標籤頁切換函數
            function switchTab(tabName) {
                // 隱藏所有標籤頁內容
                document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
                // 移除所有按鈕的 active 狀態
                document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
                // 顯示選中的標籤頁
                document.getElementById('tab-' + tabName).classList.add('active');
                // 高亮選中的按鈕
                document.querySelector('.tab-btn[data-tab="' + tabName + '"]').classList.add('active');
            }
            
            // 初始化 Word List 控制（在彈窗中定義）
            document.addEventListener('DOMContentLoaded', function() {
                const playBtn = document.getElementById('wordsPlayBtn');
                const stopBtn = document.getElementById('wordsStopBtn');
                const modeSwitch = document.getElementById('wordsModeSwitch');
                
                if (playBtn) {
                    playBtn.onclick = function() {
                        if (window.parent && window.parent.toggleWordsAutoPlay) {
                            window.parent.toggleWordsAutoPlay();
                        }
                    };
                }
                if (stopBtn) {
                    stopBtn.onclick = function() {
                        if (window.parent && window.parent.stopWordsAutoPlay) {
                            window.parent.stopWordsAutoPlay();
                        }
                    };
                }
                if (modeSwitch) {
                    modeSwitch.onclick = function() {
                        if (window.parent && window.parent.switchWordsPlayMode) {
                            window.parent.switchWordsPlayMode();
                        }
                    };
                }
            });
        </script>
    </body>
    </html>`;
    
    const newWindow = window.open('', '_blank', 'width=1100,height=800,scrollbars=yes');
    if (newWindow) {
        wordsAutoPlayState.playWindow = newWindow;
        wordsAutoPlayState.totalCount = words.length;
        wordsAutoPlayState.mode = 'sequential';
        wordsAutoPlayState.isPlaying = false;
        wordsAutoPlayState.isPaused = false;
        wordsAutoPlayState.playedIndices = [];
        wordsAutoPlayState.remainingIndices = [];
        
        // 將函數暴露給彈窗
        newWindow.toggleWordsAutoPlay = toggleWordsAutoPlay;
        newWindow.stopWordsAutoPlay = stopWordsAutoPlay;
        newWindow.switchWordsPlayMode = switchWordsPlayMode;
        newWindow.handleQuizAnswer = handleQuizAnswer;
        newWindow.playQuizQuestion = playQuizQuestion;
        newWindow.resetQuiz = resetQuiz;
        newWindow.renderQuizTab = renderQuizTab;
        newWindow.quizState = quizState;
        newWindow.allWords = allWords;
        newWindow.filteredWords = filteredWords;
        
        newWindow.document.write(allWordsHtml);
        newWindow.document.close();
        
        // 延遲綁定事件
        setTimeout(() => {
            try {
                const playBtn = newWindow.document.getElementById('wordsPlayBtn');
                const stopBtn = newWindow.document.getElementById('wordsStopBtn');
                const modeSwitch = newWindow.document.getElementById('wordsModeSwitch');
                
                if (playBtn) {
                    playBtn.onclick = () => {
                        toggleWordsAutoPlay();
                    };
                }
                if (stopBtn) {
                    stopBtn.onclick = () => {
                        stopWordsAutoPlay();
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
                    stopQuizReading();
                };
            } catch(e) {}
        }, 100);
    } else {
        alert("Popup blocked. Please allow popups for this site.");
    }
}

// ====================== Show All Sentences 彈窗 ======================

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
            const stopBtn = doc.getElementById('sentencesStopBtn');
            const modeSwitch = doc.getElementById('sentencesModeSwitch');
            if (playBtn) {
                playBtn.textContent = '▶️ Play All';
                playBtn.disabled = false;
                playBtn.style.background = '#22c55e';
            }
            if (stopBtn) {
                stopBtn.disabled = true;
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
        sentencesAutoPlayState.isPlaying = false;
        sentencesAutoPlayState.isPaused = false;
        if (sentencesAutoPlayState.timeoutId) clearTimeout(sentencesAutoPlayState.timeoutId);
        
        if (sentencesAutoPlayState.playWindow && !sentencesAutoPlayState.playWindow.closed) {
            try {
                const doc = sentencesAutoPlayState.playWindow.document;
                const playBtn = doc.getElementById('sentencesPlayBtn');
                const stopBtn = doc.getElementById('sentencesStopBtn');
                const modeSwitch = doc.getElementById('sentencesModeSwitch');
                if (playBtn) {
                    playBtn.textContent = '▶️ Play All';
                    playBtn.disabled = false;
                    playBtn.style.background = '#22c55e';
                }
                if (stopBtn) {
                    stopBtn.disabled = true;
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
    const stopBtn = sentencesAutoPlayState.playWindow ? sentencesAutoPlayState.playWindow.document.getElementById('sentencesStopBtn') : null;
    
    if (!sentencesAutoPlayState.isPlaying && !sentencesAutoPlayState.isPaused) {
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
                if (stopBtn) {
                    stopBtn.disabled = false;
                }
                if (modeSwitch) modeSwitch.disabled = true;
                
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
        sentencesAutoPlayState.isPaused = false;
        sentencesAutoPlayState.isPlaying = true;
        if (playBtn) {
            playBtn.textContent = '⏸️ Pause';
            playBtn.style.background = '#f59e0b';
        }
        playNextSentence();
    }
}

function stopSentencesAutoPlay() {
    try { synth.cancel(); } catch(e) {}
    
    if (sentencesAutoPlayState.timeoutId) {
        clearTimeout(sentencesAutoPlayState.timeoutId);
        sentencesAutoPlayState.timeoutId = null;
    }
    
    sentencesAutoPlayState.isPlaying = false;
    sentencesAutoPlayState.isPaused = false;
    sentencesAutoPlayState.playedIndices = [];
    sentencesAutoPlayState.remainingIndices = [];
    sentencesAutoPlayState.currentIndex = 0;
    
    if (sentencesAutoPlayState.playWindow && !sentencesAutoPlayState.playWindow.closed) {
        try {
            const doc = sentencesAutoPlayState.playWindow.document;
            const playBtn = doc.getElementById('sentencesPlayBtn');
            const stopBtn = doc.getElementById('sentencesStopBtn');
            const modeSwitch = doc.getElementById('sentencesModeSwitch');
            const progressSpan = doc.getElementById('sentencesProgress');
            
            if (playBtn) {
                playBtn.textContent = '▶️ Play All';
                playBtn.disabled = false;
                playBtn.style.background = '#22c55e';
            }
            if (stopBtn) {
                stopBtn.disabled = true;
            }
            if (modeSwitch) {
                modeSwitch.disabled = false;
            }
            if (progressSpan) {
                progressSpan.textContent = `0 / ${sentencesAutoPlayState.totalCount}`;
            }
            
            for (let i = 0; i < sentencesAutoPlayState.totalCount; i++) {
                const row = doc.getElementById(`sentence_row_${i}`);
                if (row) {
                    row.style.backgroundColor = '';
                    const firstCell = row.cells[0];
                    if (firstCell) {
                        firstCell.innerHTML = firstCell.innerHTML.replace(/^🎵 /, '');
                    }
                    const meaningCell = row.cells[2];
                    if (meaningCell) {
                        meaningCell.innerHTML = meaningCell.innerHTML.replace(/ ✓$/, '');
                        meaningCell.style.color = '';
                    }
                    const enCell = row.cells[1];
                    if (enCell) enCell.style.color = '';
                }
            }
        } catch(e) {}
    }
}

function switchSentencesPlayMode() {
    const modeSwitch = sentencesAutoPlayState.playWindow ? sentencesAutoPlayState.playWindow.document.getElementById('sentencesModeSwitch') : null;
    const newMode = sentencesAutoPlayState.mode === 'sequential' ? 'random' : 'sequential';
    
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
                const stopBtn = sentencesAutoPlayState.playWindow.document.getElementById('sentencesStopBtn');
                if (playBtn) {
                    playBtn.textContent = '▶️ Play All';
                    playBtn.style.background = '#22c55e';
                }
                if (stopBtn) {
                    stopBtn.disabled = true;
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
                <td style="padding: 12px; text-align: center; width: 60px;">${i + 1}</td>
                <td style="padding: 12px; font-weight: bold; color: #b45309;">${escapeHtml(s.sentence_en)}</td>
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
            .header { background: linear-gradient(135deg, #ffb347, #ff8c42); padding: 16px 20px; }
            .header h2 { color: white; font-size: 20px; font-weight: 600; }
            .header p { color: rgba(255,255,255,0.8); font-size: 13px; margin-top: 4px; }
            .control-bar { background: #f8fafc; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
            .play-btn { background: #22c55e; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
            .play-btn:disabled { background: #94a3b8; cursor: not-allowed; opacity: 0.6; }
            .play-btn:hover:not(:disabled) { opacity: 0.85; transform: scale(0.97); }
            .stop-btn { background: #ef4444; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
            .stop-btn:disabled { background: #f0a3a3; cursor: not-allowed; opacity: 0.6; }
            .stop-btn:hover:not(:disabled) { opacity: 0.85; transform: scale(0.97); }
            .mode-switch { background: #333; color: white; border: none; border-radius: 40px; padding: 6px 16px; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.2s; min-width: 160px; }
            .mode-switch:disabled { background: #94a3b8; cursor: not-allowed; opacity: 0.6; }
            .progress { font-size: 14px; color: #1e293b; font-weight: 500; margin-left: auto; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f8fafc; padding: 14px 12px; text-align: left; font-weight: 600; color: #1e293b; border-bottom: 2px solid #e2e8f0; }
            th:first-child { width: 60px; text-align: center; }
            td { padding: 12px; vertical-align: top; }
            .footer { padding: 16px 20px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0; }
            .close-btn { background: #ff8c42; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; }
            .close-btn:hover { opacity: 0.85; }
            @media (max-width: 768px) {
                .control-bar { flex-direction: column; align-items: stretch; }
                .progress { margin-left: 0; text-align: center; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>📝 ${currentLevel} - ${escapeHtml(fileNice)}</h2>
                <p>Total ${allSentences.length} sentences</p>
            </div>
            <div class="control-bar">
                <button id="sentencesPlayBtn" class="play-btn">▶️ Play All</button>
                <button id="sentencesStopBtn" class="stop-btn" disabled>⏹️ Stop</button>
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
    
    const newWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
    if (newWindow) {
        sentencesAutoPlayState.playWindow = newWindow;
        sentencesAutoPlayState.totalCount = allSentences.length;
        sentencesAutoPlayState.mode = 'sequential';
        sentencesAutoPlayState.isPlaying = false;
        sentencesAutoPlayState.isPaused = false;
        sentencesAutoPlayState.playedIndices = [];
        sentencesAutoPlayState.remainingIndices = [];
        
        newWindow.document.write(sentencesHtml);
        newWindow.document.close();
        
        setTimeout(() => {
            try {
                const playBtn = newWindow.document.getElementById('sentencesPlayBtn');
                const stopBtn = newWindow.document.getElementById('sentencesStopBtn');
                const modeSwitch = newWindow.document.getElementById('sentencesModeSwitch');
                
                if (playBtn) {
                    playBtn.onclick = () => {
                        toggleSentencesAutoPlay();
                    };
                }
                if (stopBtn) {
                    stopBtn.onclick = () => {
                        stopSentencesAutoPlay();
                    };
                }
                if (modeSwitch) {
                    modeSwitch.onclick = () => {
                        switchSentencesPlayMode();
                    };
                }
                
                newWindow.onbeforeunload = () => {
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

// ====================== 初始化 ======================
document.addEventListener('DOMContentLoaded', () => {
    initDaySelectToggle();
    if (synth.getVoices().length === 0) {
        synth.onvoiceschanged = () => {};
    }
    
    const levelConfirm = document.getElementById('levelConfirm');
    const fileConfirm = document.getElementById('fileConfirm');
    const filterBtn = document.getElementById('filterBtn');
    const showAllWordsBtn = document.getElementById('showAllBtn');

    levelConfirm.addEventListener('click', () => {
        stopAllReading();
        const level = document.getElementById('levelSelect').value;
        if(!level) { alert("Please select P1 or P2"); return; }
        currentLevel = level;
        loadFileListByLevel(level);
        document.getElementById("sentenceArea").style.display = 'none';
        document.getElementById("wordContent").innerHTML = '<p>✅ Level selected, choose a file.</p>';
        document.getElementById("showAllBtn").style.display = 'none';
        document.getElementById("infoTipContainer").innerHTML = '';
        allWords = []; filteredWords = []; allSentences = [];
        resetQuizState();
    });

    fileConfirm.addEventListener('click', async () => {
        stopAllReading();
        const fileSelect = document.getElementById('fileSelect');
        const selected = fileSelect.value;
        if(!selected || selected === "Loading..." || selected.includes("fail")) { alert("Please select a valid file"); return; }
        await loadSelectedFile(selected);
    });

    filterBtn.addEventListener('click', () => filterByDay());
    showAllWordsBtn.addEventListener('click', () => showAllWords());
});
