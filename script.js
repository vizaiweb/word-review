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

// 英文朗讀相關變量（僅用於句子朗讀，保留 Stop 功能）
let isSentenceReading = false;
let currentSentenceReadButton = null;
let currentSentenceText = "";
let currentReadCount = 0;

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
    if (voiceEngineReady && !synth.speaking) {
        if (callback) callback();
        return true;
    }
    
    if (synth.speaking) {
        console.log('⏳ Speech engine busy, waiting...');
        setTimeout(() => {
            ensureVoiceEngine(callback);
        }, 200);
        return false;
    }
    
    try {
        const silent = new SpeechSynthesisUtterance('');
        silent.volume = 0;
        const voice = getAvailableVoice();
        if (voice) silent.voice = voice;
        
        let initialized = false;
        
        silent.onend = () => {
            if (!initialized) {
                initialized = true;
                voiceEngineReady = true;
                console.log('✅ Voice engine ready');
                if (callback) callback();
            }
        };
        
        silent.onerror = (err) => {
            console.warn('Voice engine init error:', err);
            if (!initialized) {
                initialized = true;
                voiceEngineReady = true;
                if (callback) callback();
            }
        };
        
        synth.speak(silent);
        
        setTimeout(() => {
            if (!initialized) {
                initialized = true;
                voiceEngineReady = true;
                console.log('✅ Voice engine ready (timeout)');
                if (callback) callback();
            }
        }, 1000);
        
    } catch(e) {
        console.warn('Failed to init voice engine:', e);
        voiceEngineReady = true;
        if (callback) callback();
    }
    return false;
}

function speakOnce(text, onEnd, rate = 0.75, retryCount = 0) {
    if (!text) {
        if (onEnd) onEnd();
        return;
    }
    
    if (synth.speaking && retryCount < 3) {
        console.log('⏳ Speech engine busy, retrying...', retryCount + 1);
        setTimeout(() => {
            speakOnce(text, onEnd, rate, retryCount + 1);
        }, 200);
        return;
    }
    
    if (retryCount >= 3) {
        console.warn('⚠️ Max retries exceeded, forcing continue');
        try { synth.cancel(); } catch(e) {}
        if (onEnd) onEnd();
        return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1;
    
    const voice = getAvailableVoice();
    if (voice) utterance.voice = voice;
    
    let ended = false;
    let timeoutId = null;
    
    timeoutId = setTimeout(() => {
        if (!ended) {
            console.warn('⚠️ Speech timeout for:', text);
            ended = true;
            try { synth.cancel(); } catch(e) {}
            if (onEnd) onEnd();
        }
    }, Math.max(3000, text.length * 120));
    
    utterance.onend = () => {
        if (!ended) {
            ended = true;
            clearTimeout(timeoutId);
            if (onEnd) onEnd();
        }
    };
    
    utterance.onerror = (err) => {
        console.error('Speech error:', err, 'for text:', text);
        if (!ended) {
            ended = true;
            clearTimeout(timeoutId);
            if (onEnd) onEnd();
        }
    };
    
    try { 
        synth.speak(utterance);
    } catch(e) { 
        console.error('Failed to speak:', e);
        if (!ended) {
            ended = true;
            clearTimeout(timeoutId);
            if (onEnd) onEnd();
        }
    }
}

// ===== 不可中斷的單詞朗讀函數 =====
function readWordOnly(word) {
    if (!word) return;
    
    stopAllReading();
    
    let readCount = 0;
    const maxReads = 3;
    
    function speakNext() {
        if (readCount >= maxReads) {
            console.log('✅ Word reading completed:', word);
            return;
        }
        
        readCount++;
        console.log(`🔊 Reading word ${readCount}/${maxReads}:`, word);
        
        speakOnce(word, () => {
            if (readCount < maxReads) {
                setTimeout(speakNext, 550);
            }
        }, 0.85);
    }
    
    ensureVoiceEngine(speakNext);
}

// ===== 句子朗讀（保留 Stop 功能） =====
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

function toggleSentenceReading(sentenceText, buttonElement) {
    startSentenceReading(sentenceText, buttonElement);
}

// ====================== 粵語語音模塊（已移除 Stop 功能） ======================
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
    utterance.rate = 0.75;
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

// ===== 不可中斷的粵語朗讀函數 =====
function playCantoneseOnly(text) {
    if (!text) return;
    
    stopAllReading();
    
    console.log('🔊 Playing Cantonese:', text);
    
    speakCantoneseOnce(text, () => {
        console.log('✅ Cantonese reading completed:', text);
    });
}

// 保留舊函數名稱以維持相容性（但移除 Stop 功能）
function startCantoneseReading(text, buttonElement) {
    playCantoneseOnly(text);
}

function stopCantoneseReading() {
    console.log('ℹ️ Cantonese reading is non-interruptible');
}

function toggleCantoneseReading(text, buttonElement) {
    playCantoneseOnly(text);
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
            <button id="readCantoneseBtn" style="background: #333; color: white; border: none; border-radius: 40px; padding: 6px 12px; font-size: 13px; font-weight: bold; cursor: pointer; transition: transform 0.1s, opacity 0.2s;">🔊粵 1x</button>
        </div>
        <div id="currentWordSpan" style="display: none;">${hiddenContent}</div>
        <div class="btn-group">
            <button class="btn-show" id="btnShowWord" style="transition: transform 0.1s;">👀 Show Word</button>
            <button class="btn-read" id="btnReadWord">🔊 Read 3x</button>
            <button class="btn-prev" id="btnPrevWord" ${isFirst ? "disabled" : ""}>⬅️ Previous</button>
            <button class="btn-next" id="btnNextWord">➡️ Next</button>
        </div>
    `;
    
    updateInfoTip();
    
    // ===== 粵語按鈕（按下動態效果） =====
    const cantoneseBtn = document.getElementById("readCantoneseBtn");
    if (cantoneseBtn) {
        cantoneseBtn.onclick = () => {
            // 按下縮放效果
            cantoneseBtn.style.transform = 'scale(0.92)';
            setTimeout(() => {
                cantoneseBtn.style.transform = 'scale(1)';
            }, 150);
            
            preheatVoice();
            playCantoneseOnly(w.meaning);
        };
    }
    
    let isWordVisible = false;
    const wordSpan = document.getElementById("currentWordSpan");
    
    // ===== Show Word 按鈕（按下動態效果） =====
    const showBtn = document.getElementById("btnShowWord");
    if (showBtn) {
        showBtn.onclick = () => {
            // 按下縮放效果
            showBtn.style.transform = 'scale(0.92)';
            setTimeout(() => {
                showBtn.style.transform = 'scale(1)';
            }, 150);
            
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
            readWordOnly(w.word);
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
    console.log('⏹️ Stopping all reading');
    
    stopSentenceReading();
    
    try { 
        synth.cancel(); 
        console.log('✅ Speech synthesis cancelled');
    } catch(e) {
        console.warn('Failed to cancel speech:', e);
    }
    
    if (window.wordsAutoPlayInterval) {
        clearTimeout(window.wordsAutoPlayInterval);
        window.wordsAutoPlayInterval = null;
    }
    if (window.sentencesAutoPlayInterval) {
        clearTimeout(window.sentencesAutoPlayInterval);
        window.sentencesAutoPlayInterval = null;
    }
}

// ====================== Show All Words 彈窗 ======================
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
            utterance.rate = 0.75;
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

// ====================== Quiz 相關全域變量 ======================
let quizData = [];
let userAnswers = {};
let currentQuestionIdx = 0;
let quizGenerated = false;
let allWordsForQuiz = [];

// ====================== Quiz 核心函數 ======================

function speakFullQuestion(questionData, onComplete) {
    const no = questionData.wordIndex + 1;
    const explanation = questionData.explanation || '';
    const optA = questionData.options[0] || '';
    const optB = questionData.options[1] || '';
    const optC = questionData.options[2] || '';

    let text = `Question ${no}. ${explanation}. `;
    text += `Option A: ${optA}. Option B: ${optB}. Option C: ${optC}.`;

    speakOnce(text, onComplete, 0.85);
}

/**
 * 生成選擇題資料
 * 為每個單字生成三選一選項（1 正確 + 2 隨機錯誤）
 */
function generateQuizData(words) {
    if (!words || words.length === 0) return [];
    
    allWordsForQuiz = words;
    const data = [];
    
    for (let i = 0; i < words.length; i++) {
        const correctWord = words[i].word.toUpperCase();
        const explanation = words[i].englishExplanation || words[i].meaning || '';
        
        // 取得錯誤選項（從所有單字中隨機選取 2 個不同的）
        const wrongOptions = getRandomWrongOptions(words, i, 2);
        
        // 建立選項陣列：1 正確 + 2 錯誤
        let options = [correctWord, ...wrongOptions];
        
        // 隨機打亂選項順序
        options = shuffleArray(options);
        
        // 記錄正確答案的位置（A=0, B=1, C=2）
        const correctIndex = options.indexOf(correctWord);
        const correctLabel = String.fromCharCode(65 + correctIndex); // A, B, C
        
        data.push({
            wordIndex: i,
            word: words[i].word,
            explanation: explanation,
            options: options,           // ['GUDONG', 'RENAO', 'BATUIJIUPO']
            correctLabel: correctLabel, // 'A', 'B', or 'C'
            userAnswer: null,           // null 表示未作答
            isCorrect: null             // null 表示未作答
        });
    }
    
    quizData = data;
    userAnswers = {};
    currentQuestionIdx = 0;
    quizGenerated = true;
    
    return data;
}

/**
 * 從 allWords 中隨機選取 n 個與正確答案不同的單字
 */
function getRandomWrongOptions(words, correctIndex, count) {
    const correctWord = words[correctIndex].word.toUpperCase();
    const candidates = words
        .map((w, idx) => ({ word: w.word.toUpperCase(), idx }))
        .filter(item => item.word !== correctWord);
    
    // 打亂候選清單
    const shuffled = shuffleArray(candidates);
    
    // 取前 count 個，若不夠則補 '---' 佔位（實際不會發生，因為字庫通常夠大）
    const result = shuffled.slice(0, count).map(item => item.word);
    while (result.length < count) {
        result.push('---');
    }
    return result;
}

/**
 * 洗牌函數 (Fisher-Yates)
 */
function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * 渲染 Quiz 表格
 */
function renderQuizTable() {
    const container = document.getElementById('quizBody');
    if (!container) return;
    
    if (!quizData || quizData.length === 0) {
        container.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8;">No quiz data available. Please load a file first.</td></tr>`;
        return;
    }
    
    let html = '';
    for (let i = 0; i < quizData.length; i++) {
        const q = quizData[i];
        const isCurrent = (i === currentQuestionIdx);
        const isAnswered = (q.userAnswer !== null);
        const answerDisplay = q.userAnswer !== null ? q.userAnswer : 'Please Select';
        const resultDisplay = getResultDisplay(q);
        
        html += `
            <tr id="quiz_row_${i}" class="${isCurrent ? 'current-row' : ''}" data-index="${i}">
                <td class="col-no">
                    ${isCurrent ? '<span class="current-marker">▶</span>' : ''}
                    ${i + 1}
                </td>
                <td class="col-explanation">${escapeHtml(q.explanation)}</td>
                ${q.options.map((opt, optIdx) => {
                    const label = String.fromCharCode(65 + optIdx); // A, B, C
                    let className = 'col-option';
                    let extraAttr = '';
                    
                    if (isAnswered) {
                        className += ' option-disabled';
                        if (opt === q.options[q.correctLabel.charCodeAt(0) - 65]) {
                            className += ' option-correct';
                        }
                        if (q.userAnswer === label && q.userAnswer !== q.correctLabel) {
                            className += ' option-wrong';
                        }
                    }
                    
                    return `<td class="${className}" data-quiz-index="${i}" data-option-label="${label}" data-option-value="${escapeHtml(opt)}">
                        ${escapeHtml(opt)}
                    </td>`;
                }).join('')}
                <td class="col-your-answer">
                    ${isAnswered ? escapeHtml(answerDisplay) : `<span class="not-answered">${escapeHtml(answerDisplay)}</span>`}
                </td>
                <td class="col-result">${resultDisplay}</td>
                <td class="col-listen">
                    <button class="listen-btn" data-quiz-index="${i}" title="Listen to explanation">🔊</button>
                </td>
            </tr>
        `;
    }
    
    container.innerHTML = html;
    
    // 更新統計
    updateQuizStats();
    
    // 更新進度
    updateQuizProgress();
    
    // 綁定事件
    bindQuizEvents();
}

/**
 * 取得結果顯示 (✔ 或 ✘ 或空白)
 */
function getResultDisplay(q) {
    if (q.userAnswer === null) return '';
    if (q.userAnswer === q.correctLabel) {
        return '<span class="result-correct">✔</span>';
    } else {
        return '<span class="result-wrong">✘</span>';
    }
}

/**
 * 更新統計列
 */
function updateQuizStats() {
    const total = quizData.length;
    let answered = 0;
    let correct = 0;
    
    for (const q of quizData) {
        if (q.userAnswer !== null) {
            answered++;
            if (q.userAnswer === q.correctLabel) {
                correct++;
            }
        }
    }
    
    const rate = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    
    const statsContainer = document.getElementById('quizStats');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <span>Total Questions: <span class="stat-number">${total}</span></span>
            <span>Answered: <span class="stat-number">${answered}</span></span>
            <span>Correct Rate: <span class="stat-number">${answered > 0 ? rate + '%' : '--%'}</span></span>
        `;
    }
}

/**
 * 更新進度顯示
 */
function updateQuizProgress() {
    const progressEl = document.getElementById('quizProgress');
    if (progressEl) {
        progressEl.textContent = `Progress: ${currentQuestionIdx + 1} / ${quizData.length}`;
    }
}

/**
 * 綁定 Quiz 表格事件
 */
function bindQuizEvents() {
    // 點擊列切換當前題目
    document.querySelectorAll('#quizBody tr').forEach(row => {
        row.addEventListener('click', function(e) {
            // 如果點擊的是選項按鈕或朗讀按鈕，不觸發列切換
            if (e.target.closest('.col-option') || e.target.closest('.listen-btn')) {
                return;
            }
            const index = parseInt(this.dataset.index);
            if (!isNaN(index) && index !== currentQuestionIdx) {
                selectQuestion(index);
            }
        });
    });
    
    // 點擊選項作答
    document.querySelectorAll('.col-option:not(.option-disabled)').forEach(cell => {
        cell.addEventListener('click', function(e) {
            e.stopPropagation();
            const index = parseInt(this.dataset.quizIndex);
            const label = this.dataset.optionLabel;
            if (!isNaN(index) && label) {
                answerQuestion(index, label);
            }
        });
    });
    
    // 點擊朗讀按鈕
   document.querySelectorAll('.listen-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const index = parseInt(this.dataset.quizIndex);
        if (!isNaN(index) && quizData[index]) {
            const q = quizData[index];
            preheatVoice();
            speakFullQuestion(q);
        }
    });
});
}

/**
 * 選擇題目（切換當前查看的題目）
 */
function selectQuestion(index) {
    if (index < 0 || index >= quizData.length) return;
    if (index === currentQuestionIdx) return;
    
    currentQuestionIdx = index;
    
    // 更新表格高亮
    document.querySelectorAll('#quizBody tr').forEach(row => {
        row.classList.remove('current-row');
        const rowIndex = parseInt(row.dataset.index);
        if (rowIndex === index) {
            row.classList.add('current-row');
        }
    });
    
    // 更新進度
    updateQuizProgress();
}

/**
 * 作答
 */
function answerQuestion(index, selectedLabel) {
    if (index < 0 || index >= quizData.length) return;
    const q = quizData[index];
    
    // 如果已經作答，不能再次作答
    if (q.userAnswer !== null) return;
    
    // 記錄答案
    q.userAnswer = selectedLabel;
    q.isCorrect = (selectedLabel === q.correctLabel);
    
    // 重新渲染表格
    renderQuizTable();
    
    // 如果答錯了，自動高亮正確答案（在 renderQuizTable 中已處理）
}

/**
 * 切換到 Quiz 分頁時初始化
 */
function initQuizTab() {
    if (!quizGenerated && allWords && allWords.length > 0) {
        generateQuizData(allWords);
        renderQuizTable();
    } else if (quizGenerated) {
        // 如果已經生成過，重新渲染（可能資料已更新）
        renderQuizTable();
    } else {
        // 沒有資料
        const container = document.getElementById('quizBody');
        if (container) {
            container.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8;">No words loaded. Please select a file first.</td></tr>`;
        }
    }
}

function showAllWords() {
    if (allWords.length === 0) {
        alert('No words loaded. Please select a file first.');
        return;
    }
    
    const fileNice = removeFileExtension(currentFileName);
    
    // ===== 生成 Words List 表格 =====
    let tableRows = '';
    for (let i = 0; i < allWords.length; i++) {
        const w = allWords[i];
        tableRows += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; text-align: center; width: 60px;">${w.day}</td>
                <td style="padding: 10px 12px; font-weight: bold; color: #dc2626;">${escapeHtml(w.word.toUpperCase())}</td>
                <td style="padding: 10px 12px; color: #334155;">${escapeHtml(w.meaning)}</td>
            </tr>
        `;
    }
    
    // ===== 生成彈窗完整 HTML（雙分頁） =====
    const allHtml = `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>All Words - ${currentLevel}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', -apple-system, Arial, sans-serif; background: #f0f4f8; padding: 20px; }
            .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            
            /* Header */
            .header { background: linear-gradient(135deg, #ff9a56, #ff6b35); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
            .header h2 { color: white; font-size: 20px; font-weight: 600; }
            .header p { color: rgba(255,255,255,0.8); font-size: 14px; }
            
            /* Tabs */
            .tab-bar { display: flex; background: #f1f5f9; padding: 4px; border-radius: 12px; margin: 16px 20px 0 20px; gap: 4px; }
            .tab-btn { flex: 1; padding: 10px 16px; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.25s ease; background: transparent; color: #64748b; }
            .tab-btn:hover { color: #1e293b; background: rgba(255,255,255,0.5); }
            .tab-btn.active { background: linear-gradient(135deg, #ff9a56, #ff6b35); color: white; box-shadow: 0 2px 8px rgba(255,107,53,0.3); }
            
            /* Tab Panels */
            .tab-panel { display: none; animation: fadeIn 0.3s ease; padding: 16px 20px 0 20px; }
            .tab-panel.active { display: block; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
            
            /* Words List Panel */
            .words-control-bar { background: #f8fafc; padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
            .words-control-bar .play-btn { background: #22c55e; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
            .words-control-bar .play-btn:disabled { background: #94a3b8; cursor: not-allowed; opacity: 0.6; }
            .words-control-bar .play-btn:hover:not(:disabled) { opacity: 0.85; transform: scale(0.97); }
            .words-control-bar .stop-btn { background: #ef4444; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
            .words-control-bar .stop-btn:disabled { background: #f0a3a3; cursor: not-allowed; opacity: 0.6; }
            .words-control-bar .stop-btn:hover:not(:disabled) { opacity: 0.85; transform: scale(0.97); }
            .words-control-bar .mode-switch { background: #333; color: white; border: none; border-radius: 40px; padding: 6px 16px; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.2s; min-width: 160px; }
            .words-control-bar .mode-switch:disabled { background: #94a3b8; cursor: not-allowed; opacity: 0.6; }
            .words-control-bar .words-progress { font-size: 14px; color: #1e293b; font-weight: 500; margin-left: auto; }
            
            /* Quiz Panel */
            .quiz-stats { display: flex; justify-content: center; gap: 30px; background: #f8fafc; padding: 12px 20px; border-radius: 12px; margin: 0 0 16px 0; font-size: 15px; font-weight: 500; color: #1e293b; flex-wrap: wrap; }
            .quiz-stats .stat-number { color: #ff6b35; font-weight: 700; }
            .quiz-table-wrapper { overflow-x: auto; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 12px; }
            .quiz-table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 700px; }
            .quiz-table thead th { background: #f8fafc; padding: 10px 8px; text-align: center; font-weight: 600; color: #1e293b; border-bottom: 2px solid #e2e8f0; white-space: nowrap; font-size: 13px; }
            .quiz-table tbody td { padding: 10px 8px; text-align: center; border-bottom: 1px solid #f1f5f9; vertical-align: middle; font-size: 14px; transition: background 0.2s; }
            .quiz-table tbody tr { cursor: pointer; transition: background 0.2s; }
            .quiz-table tbody tr:hover { background: #f8fafc; }
            .quiz-table tbody tr.current-row { background: #fff3cd !important; }
            .quiz-table tbody tr.current-row:hover { background: #ffedb3 !important; }
            .quiz-table .col-no { width: 50px; font-weight: 600; color: #64748b; font-size: 14px; }
            .quiz-table .col-no .current-marker { color: #ff6b35; margin-right: 4px; }
            .quiz-table .col-explanation { text-align: left; min-width: 150px; max-width: 250px; font-size: 13px; color: #334155; line-height: 1.4; word-break: break-word; }
            .quiz-table .col-option { min-width: 70px; font-weight: 600; color: #0f172a; cursor: pointer; border-radius: 6px; padding: 6px 4px; transition: all 0.2s; }
            .quiz-table .col-option:hover:not(.option-disabled) { background: #e2e8f0; }
            .quiz-table .col-option.option-correct { background: #dcfce7 !important; color: #15803d; border-radius: 6px; }
            .quiz-table .col-option.option-wrong { background: #fee2e2 !important; color: #dc2626; border-radius: 6px; }
            .quiz-table .col-option.option-disabled { cursor: default; opacity: 0.7; }
            .quiz-table .col-option.option-disabled:hover { background: transparent; }
            .quiz-table .col-your-answer { font-weight: 500; color: #1e293b; min-width: 70px; }
            .quiz-table .col-your-answer .not-answered { color: #94a3b8; font-weight: 400; font-size: 12px; }
            .quiz-table .col-result { min-width: 50px; font-size: 18px; }
            .quiz-table .col-result .result-correct { color: #22c55e; }
            .quiz-table .col-result .result-wrong { color: #ef4444; }
            .quiz-table .col-listen { min-width: 50px; }
            .quiz-table .listen-btn { background: none; border: none; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: all 0.2s; }
            .quiz-table .listen-btn:hover { background: #e2e8f0; transform: scale(1.1); }
            .quiz-table .listen-btn:active { transform: scale(0.9); }
            .quiz-footer { display: flex; justify-content: flex-end; padding: 4px 4px 0 4px; font-size: 14px; color: #64748b; }
            .quiz-footer .quiz-progress { font-weight: 500; color: #1e293b; }
            
            /* Common */
            .words-table-wrapper { overflow-x: auto; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 16px; }
            .words-table { width: 100%; border-collapse: collapse; font-size: 14px; }
            .words-table thead th { background: #f8fafc; padding: 12px; text-align: left; font-weight: 600; color: #1e293b; border-bottom: 2px solid #e2e8f0; }
            .words-table thead th:first-child { width: 60px; text-align: center; }
            
            /* Footer */
            .footer { padding: 16px 20px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0; margin-top: 16px; }
            .close-btn { background: #ff6b35; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
            .close-btn:hover { opacity: 0.85; }
            
            @media (max-width: 600px) {
                .quiz-stats { gap: 12px; font-size: 13px; padding: 10px 14px; }
                .quiz-table { font-size: 12px; min-width: 600px; }
                .quiz-table thead th, .quiz-table tbody td { padding: 6px 4px; font-size: 12px; }
                .quiz-table .col-explanation { min-width: 100px; max-width: 150px; font-size: 12px; }
                .quiz-table .col-option { min-width: 55px; font-size: 12px; }
                .tab-btn { font-size: 13px; padding: 8px 12px; }
                .header h2 { font-size: 17px; }
                .header p { font-size: 12px; }
                .words-control-bar { gap: 8px; padding: 10px 12px; }
                .words-control-bar .play-btn, .words-control-bar .stop-btn { padding: 6px 16px; font-size: 12px; }
                .words-control-bar .mode-switch { font-size: 11px; min-width: 120px; padding: 4px 12px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- Header -->
            <div class="header">
                <h2>📖 ${currentLevel} - ${escapeHtml(fileNice)}</h2>
                <p>Total ${allWords.length} words</p>
            </div>
            
            <!-- Tab Bar -->
            <div class="tab-bar">
                <button class="tab-btn active" data-tab="words">📖 Words List</button>
                <button class="tab-btn" data-tab="quiz">✏️ Quiz</button>
            </div>
            
            <!-- Tab Panels -->
            <div class="tab-content">
                <!-- Words List Panel -->
                <div id="tab-words" class="tab-panel active">
                    <div class="words-control-bar">
                        <button id="wordsPlayBtn" class="play-btn">▶️ Play All</button>
                        <button id="wordsStopBtn" class="stop-btn" disabled>⏹️ Stop</button>
                        <button id="wordsModeSwitch" class="mode-switch">Sequential ○──● Random</button>
                        <span id="wordsProgress" class="words-progress">0 / ${allWords.length}</span>
                    </div>
                    <div class="words-table-wrapper">
                        <table class="words-table">
                            <thead>
                                <tr><th>Day</th><th>Word</th><th>Meaning</th></tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Quiz Panel -->
                <div id="tab-quiz" class="tab-panel">
                    <div class="quiz-stats" id="quizStats">
                        <span>Total Questions: <span class="stat-number">${allWords.length}</span></span>
                        <span>Answered: <span class="stat-number">0</span></span>
                        <span>Correct Rate: <span class="stat-number">--%</span></span>
                    </div>
                    <div class="quiz-table-wrapper">
                        <table class="quiz-table">
                            <thead>
                                <tr>
                                    <th>No.</th>
                                    <th>Explanation</th>
                                    <th>Option A</th>
                                    <th>Option B</th>
                                    <th>Option C</th>
                                    <th>Your Answer</th>
                                    <th>Result</th>
                                    <th>Listen</th>
                                </tr>
                            </thead>
                            <tbody id="quizBody">
                                <tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8;">Loading quiz data...</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="quiz-footer">
                        <span class="quiz-progress" id="quizProgress">Progress: 0 / ${allWords.length}</span>
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <button class="close-btn" onclick="window.close()">Close</button>
            </div>
        </div>
        
        <script>
            // ===== 傳遞資料到彈窗 =====
            window.allWordsData = ${JSON.stringify(allWords)};
            window.quizMode = 'sequential';
            window.quizPlayState = { isPlaying: false, isPaused: false, playedIndices: [], remainingIndices: [], totalCount: 0, timeoutId: null };
            
            // ===== 分頁切換 =====
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                    document.getElementById('tab-' + this.dataset.tab).classList.add('active');
                    
                    // 如果切換到 Quiz 分頁，初始化 Quiz
                    if (this.dataset.tab === 'quiz') {
                        initQuizInPopup();
                    }
                });
            });
            
            // ===== Quiz 功能（彈窗內） =====
            let quizDataPopup = [];
            let userAnswersPopup = {};
            let currentQuestionIdxPopup = 0;
            
            function shuffleArrayPopup(arr) {
                const shuffled = [...arr];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                return shuffled;
            }
            
            function getRandomWrongOptionsPopup(words, correctIndex, count) {
                const correctWord = words[correctIndex].word.toUpperCase();
                const candidates = words
                    .map((w, idx) => ({ word: w.word.toUpperCase(), idx }))
                    .filter(item => item.word !== correctWord);
                const shuffled = shuffleArrayPopup(candidates);
                const result = shuffled.slice(0, count).map(item => item.word);
                while (result.length < count) {
                    result.push('---');
                }
                return result;
            }


            function speakFullQuestionPopup(questionData) {
    const no = questionData.wordIndex + 1;
    const explanation = questionData.explanation || '';
    const optA = questionData.options[0] || '';
    const optB = questionData.options[1] || '';
    const optC = questionData.options[2] || '';
    
    let text = 'Question ' + no + '. ' + explanation + '. ';
    text += 'Option A: ' + optA + '. Option B: ' + optB + '. Option C: ' + optC + '.';
    
    if (window.opener && window.opener.speakOnce) {
        window.opener.speakOnce(text, null, 0.85);
    } else {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.75;
        utterance.pitch = 1.0;
        utterance.volume = 1;
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.name && v.name.includes('Google US English')) || voices.find(v => v.lang && v.lang === 'en-US') || voices[0];
        if (voice) utterance.voice = voice;
        window.speechSynthesis.speak(utterance);
    }
}

            function generateQuizDataPopup(words) {
                if (!words || words.length === 0) return [];
                const data = [];
                for (let i = 0; i < words.length; i++) {
                    const correctWord = words[i].word.toUpperCase();
                    const explanation = words[i].englishExplanation || words[i].meaning || '';
                    const wrongOptions = getRandomWrongOptionsPopup(words, i, 2);
                    let options = [correctWord, ...wrongOptions];
                    options = shuffleArrayPopup(options);
                    const correctIndex = options.indexOf(correctWord);
                    const correctLabel = String.fromCharCode(65 + correctIndex);
                    data.push({
                        wordIndex: i,
                        word: words[i].word,
                        explanation: explanation,
                        options: options,
                        correctLabel: correctLabel,
                        userAnswer: null,
                        isCorrect: null
                    });
                }
                return data;
            }
            
            function renderQuizTablePopup() {
                const container = document.getElementById('quizBody');
                if (!container) return;
                if (!quizDataPopup || quizDataPopup.length === 0) {
                    container.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8;">No quiz data available.</td></tr>';
                    return;
                }
                
                let html = '';
                for (let i = 0; i < quizDataPopup.length; i++) {
                    const q = quizDataPopup[i];
                    const isCurrent = (i === currentQuestionIdxPopup);
                    const isAnswered = (q.userAnswer !== null);
                    const answerDisplay = q.userAnswer !== null ? q.userAnswer : 'Please Select';
                    
                    let resultDisplay = '';
                    if (q.userAnswer !== null) {
                        resultDisplay = q.userAnswer === q.correctLabel 
                            ? '<span class="result-correct">✔</span>' 
                            : '<span class="result-wrong">✘</span>';
                    }
                    
                    html += '<tr id="quiz_row_' + i + '" class="' + (isCurrent ? 'current-row' : '') + '" data-index="' + i + '">';
                    html += '<td class="col-no">' + (isCurrent ? '<span class="current-marker">▶</span>' : '') + (i + 1) + '</td>';
                    html += '<td class="col-explanation">' + escapeHtml(q.explanation) + '</td>';
                    
                    for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
                        const opt = q.options[optIdx];
                        const label = String.fromCharCode(65 + optIdx);
                        let className = 'col-option';
                        if (isAnswered) {
                            className += ' option-disabled';
                            if (opt === q.options[q.correctLabel.charCodeAt(0) - 65]) {
                                className += ' option-correct';
                            }
                            if (q.userAnswer === label && q.userAnswer !== q.correctLabel) {
                                className += ' option-wrong';
                            }
                        }
                        html += '<td class="' + className + '" data-quiz-index="' + i + '" data-option-label="' + label + '">' + escapeHtml(opt) + '</td>';
                    }
                    
                    html += '<td class="col-your-answer">' + (isAnswered ? escapeHtml(answerDisplay) : '<span class="not-answered">' + escapeHtml(answerDisplay) + '</span>') + '</td>';
                    html += '<td class="col-result">' + resultDisplay + '</td>';
                    html += '<td class="col-listen"><button class="listen-btn" data-quiz-index="' + i + '">🔊</button></td>';
                    html += '</tr>';
                }
                
                container.innerHTML = html;
                updateQuizStatsPopup();
                updateQuizProgressPopup();
                bindQuizEventsPopup();
            }
            
            function updateQuizStatsPopup() {
                const total = quizDataPopup.length;
                let answered = 0, correct = 0;
                for (const q of quizDataPopup) {
                    if (q.userAnswer !== null) {
                        answered++;
                        if (q.userAnswer === q.correctLabel) correct++;
                    }
                }
                const rate = answered > 0 ? Math.round((correct / answered) * 100) : 0;
                const statsContainer = document.getElementById('quizStats');
                if (statsContainer) {
                    statsContainer.innerHTML = 
                        '<span>Total Questions: <span class="stat-number">' + total + '</span></span>' +
                        '<span>Answered: <span class="stat-number">' + answered + '</span></span>' +
                        '<span>Correct Rate: <span class="stat-number">' + (answered > 0 ? rate + '%' : '--%') + '</span></span>';
                }
            }
            
            function updateQuizProgressPopup() {
                const progressEl = document.getElementById('quizProgress');
                if (progressEl && quizDataPopup.length > 0) {
                    progressEl.textContent = 'Progress: ' + (currentQuestionIdxPopup + 1) + ' / ' + quizDataPopup.length;
                }
            }
            
            function bindQuizEventsPopup() {
                document.querySelectorAll('#quizBody tr').forEach(row => {
                    row.addEventListener('click', function(e) {
                        if (e.target.closest('.col-option') || e.target.closest('.listen-btn')) return;
                        const index = parseInt(this.dataset.index);
                        if (!isNaN(index) && index !== currentQuestionIdxPopup) {
                            currentQuestionIdxPopup = index;
                            renderQuizTablePopup();
                        }
                    });
                });
                
                document.querySelectorAll('.col-option:not(.option-disabled)').forEach(cell => {
                    cell.addEventListener('click', function(e) {
                        e.stopPropagation();
                        const index = parseInt(this.dataset.quizIndex);
                        const label = this.dataset.optionLabel;
                        if (!isNaN(index) && label) {
                            const q = quizDataPopup[index];
                            if (q && q.userAnswer === null) {
                                q.userAnswer = label;
                                q.isCorrect = (label === q.correctLabel);
                                renderQuizTablePopup();
                            }
                        }
                    });
                });
                
                document.querySelectorAll('.listen-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const index = parseInt(this.dataset.quizIndex);
        if (!isNaN(index) && quizDataPopup[index]) {
            const q = quizDataPopup[index];
            speakFullQuestionPopup(q);
        }
    });
});
            }
            
            function initQuizInPopup() {
                const words = window.allWordsData || [];
                if (words.length > 0) {
                    quizDataPopup = generateQuizDataPopup(words);
                    userAnswersPopup = {};
                    currentQuestionIdxPopup = 0;
                    renderQuizTablePopup();
                }
            }
            
            // ===== Words List 播放功能（彈窗內） =====
            let wordsAutoPlayStatePopup = {
                isPlaying: false,
                isPaused: false,
                currentIndex: 0,
                mode: 'sequential',
                playedIndices: [],
                remainingIndices: [],
                totalCount: 0,
                timeoutId: null
            };
            
            function speakWordWithEnglishAndCantonesePopup(word, meaning, onComplete) {
                let step = 0;
                let repeatCount = 0;
                let isCancelled = false;
                
                function cancelPlayback() {
                    isCancelled = true;
                    try { speechSynthesis.cancel(); } catch(e) {}
                }
                
                function speakNext() {
                    if (isCancelled || (wordsAutoPlayStatePopup && (wordsAutoPlayStatePopup.isPaused || !wordsAutoPlayStatePopup.isPlaying))) {
                        if (onComplete) onComplete();
                        return;
                    }
                    
                    if (step === 0) {
                        const utterance = new SpeechSynthesisUtterance(word);
                        utterance.lang = 'en-US';
                        utterance.rate = 0.75;
                        utterance.pitch = 1.0;
                        utterance.volume = 1;
                        const voice = getAvailableVoice();
                        if (voice) utterance.voice = voice;
                        let completed = false;
                        utterance.onend = () => { if (completed) return; completed = true; repeatCount++; if (repeatCount < 3) { setTimeout(speakNext, 450); } else { step = 1; repeatCount = 0; setTimeout(speakNext, 450); } };
                        utterance.onerror = () => { if (completed) return; completed = true; step = 1; repeatCount = 0; setTimeout(speakNext, 450); };
                        try { speechSynthesis.speak(utterance); } catch(e) { step = 1; repeatCount = 0; setTimeout(speakNext, 450); }
                    } else if (step === 1) {
                        const utterance = new SpeechSynthesisUtterance(meaning);
                        utterance.lang = 'yue';
                        utterance.rate = 0.75;
                        utterance.pitch = 1.0;
                        utterance.volume = 1;
                        const voice = getCantoneseVoice();
                        if (voice) utterance.voice = voice;
                        let completed = false;
                        utterance.onend = () => { if (completed) return; completed = true; setTimeout(() => { if (onComplete) onComplete(); }, 350); };
                        utterance.onerror = () => { if (completed) return; completed = true; setTimeout(() => { if (onComplete) onComplete(); }, 250); };
                        try { speechSynthesis.speak(utterance); } catch(e) { if (onComplete) onComplete(); }
                    }
                }
                speakNext();
            }
            
            function playNextWordPopup() {
                if (!wordsAutoPlayStatePopup.isPlaying || wordsAutoPlayStatePopup.isPaused) return;
                
                const total = wordsAutoPlayStatePopup.totalCount;
                if (wordsAutoPlayStatePopup.playedIndices.length >= total) {
                    wordsAutoPlayStatePopup.isPlaying = false;
                    wordsAutoPlayStatePopup.isPaused = false;
                    if (wordsAutoPlayStatePopup.timeoutId) clearTimeout(wordsAutoPlayStatePopup.timeoutId);
                    const playBtn = document.getElementById('wordsPlayBtn');
                    const stopBtn = document.getElementById('wordsStopBtn');
                    const modeSwitch = document.getElementById('wordsModeSwitch');
                    if (playBtn) { playBtn.textContent = '▶️ Play All'; playBtn.disabled = false; playBtn.style.background = '#22c55e'; }
                    if (stopBtn) stopBtn.disabled = true;
                    if (modeSwitch) modeSwitch.disabled = false;
                    return;
                }
                
                let nextIndex;
                if (wordsAutoPlayStatePopup.mode === 'sequential') {
                    nextIndex = wordsAutoPlayStatePopup.playedIndices.length;
                } else {
                    if (wordsAutoPlayStatePopup.remainingIndices.length === 0) {
                        wordsAutoPlayStatePopup.remainingIndices = Array.from({length: total}, (_, i) => i);
                    }
                    const randomPos = Math.floor(Math.random() * wordsAutoPlayStatePopup.remainingIndices.length);
                    nextIndex = wordsAutoPlayStatePopup.remainingIndices[randomPos];
                    wordsAutoPlayStatePopup.remainingIndices.splice(randomPos, 1);
                }
                
                const wordData = window.allWordsData[nextIndex];
                const progressSpan = document.getElementById('wordsProgress');
                if (progressSpan) progressSpan.textContent = (wordsAutoPlayStatePopup.playedIndices.length + 1) + ' / ' + total;
                
                speakWordWithEnglishAndCantonesePopup(wordData.word, wordData.meaning, () => {
                    wordsAutoPlayStatePopup.playedIndices.push(nextIndex);
                    if (progressSpan) progressSpan.textContent = wordsAutoPlayStatePopup.playedIndices.length + ' / ' + total;
                    wordsAutoPlayStatePopup.timeoutId = setTimeout(() => { playNextWordPopup(); }, 500);
                });
            }
            
            function toggleWordsAutoPlayPopup() {
                const playBtn = document.getElementById('wordsPlayBtn');
                const stopBtn = document.getElementById('wordsStopBtn');
                const modeSwitch = document.getElementById('wordsModeSwitch');
                
                if (!wordsAutoPlayStatePopup.isPlaying && !wordsAutoPlayStatePopup.isPaused) {
                    wordsAutoPlayStatePopup.isPlaying = true;
                    wordsAutoPlayStatePopup.isPaused = false;
                    wordsAutoPlayStatePopup.playedIndices = [];
                    wordsAutoPlayStatePopup.remainingIndices = [];
                    wordsAutoPlayStatePopup.totalCount = window.allWordsData.length;
                    if (wordsAutoPlayStatePopup.mode === 'random') {
                        wordsAutoPlayStatePopup.remainingIndices = Array.from({length: window.allWordsData.length}, (_, i) => i);
                    }
                    if (playBtn) { playBtn.textContent = '⏸️ Pause'; playBtn.style.background = '#f59e0b'; }
                    if (stopBtn) stopBtn.disabled = false;
                    if (modeSwitch) modeSwitch.disabled = true;
                    const progressSpan = document.getElementById('wordsProgress');
                    if (progressSpan) progressSpan.textContent = '0 / ' + window.allWordsData.length;
                    playNextWordPopup();
                } else if (wordsAutoPlayStatePopup.isPlaying && !wordsAutoPlayStatePopup.isPaused) {
                    wordsAutoPlayStatePopup.isPaused = true;
                    wordsAutoPlayStatePopup.isPlaying = false;
                    if (wordsAutoPlayStatePopup.timeoutId) { clearTimeout(wordsAutoPlayStatePopup.timeoutId); wordsAutoPlayStatePopup.timeoutId = null; }
                    if (playBtn) { playBtn.textContent = '▶️ Resume'; playBtn.style.background = '#22c55e'; }
                } else if (wordsAutoPlayStatePopup.isPaused) {
                    wordsAutoPlayStatePopup.isPaused = false;
                    wordsAutoPlayStatePopup.isPlaying = true;
                    if (playBtn) { playBtn.textContent = '⏸️ Pause'; playBtn.style.background = '#f59e0b'; }
                    playNextWordPopup();
                }
            }
            
            function stopWordsAutoPlayPopup() {
                try { speechSynthesis.cancel(); } catch(e) {}
                if (wordsAutoPlayStatePopup.timeoutId) { clearTimeout(wordsAutoPlayStatePopup.timeoutId); wordsAutoPlayStatePopup.timeoutId = null; }
                wordsAutoPlayStatePopup.isPlaying = false;
                wordsAutoPlayStatePopup.isPaused = false;
                wordsAutoPlayStatePopup.playedIndices = [];
                wordsAutoPlayStatePopup.remainingIndices = [];
                const playBtn = document.getElementById('wordsPlayBtn');
                const stopBtn = document.getElementById('wordsStopBtn');
                const modeSwitch = document.getElementById('wordsModeSwitch');
                if (playBtn) { playBtn.textContent = '▶️ Play All'; playBtn.disabled = false; playBtn.style.background = '#22c55e'; }
                if (stopBtn) stopBtn.disabled = true;
                if (modeSwitch) modeSwitch.disabled = false;
                const progressSpan = document.getElementById('wordsProgress');
                if (progressSpan) progressSpan.textContent = '0 / ' + window.allWordsData.length;
            }
            
            function switchWordsPlayModePopup() {
                const modeSwitch = document.getElementById('wordsModeSwitch');
                const newMode = wordsAutoPlayStatePopup.mode === 'sequential' ? 'random' : 'sequential';
                
                if (wordsAutoPlayStatePopup.isPlaying || wordsAutoPlayStatePopup.isPaused) {
                    if (wordsAutoPlayStatePopup.timeoutId) { clearTimeout(wordsAutoPlayStatePopup.timeoutId); wordsAutoPlayStatePopup.timeoutId = null; }
                    wordsAutoPlayStatePopup.isPlaying = false;
                    wordsAutoPlayStatePopup.isPaused = false;
                    const playBtn = document.getElementById('wordsPlayBtn');
                    const stopBtn = document.getElementById('wordsStopBtn');
                    if (playBtn) { playBtn.textContent = '▶️ Play All'; playBtn.style.background = '#22c55e'; }
                    if (stopBtn) stopBtn.disabled = true;
                    if (modeSwitch) modeSwitch.disabled = false;
                }
                
                wordsAutoPlayStatePopup.mode = newMode;
                wordsAutoPlayStatePopup.playedIndices = [];
                wordsAutoPlayStatePopup.remainingIndices = [];
                if (modeSwitch) {
                    modeSwitch.textContent = newMode === 'sequential' ? 'Sequential ○──● Random' : 'Sequential ●──○ Random';
                }
                const progressSpan = document.getElementById('wordsProgress');
                if (progressSpan) progressSpan.textContent = '0 / ' + window.allWordsData.length;
            }
            
            // ===== 綁定事件 =====
            document.getElementById('wordsPlayBtn').addEventListener('click', toggleWordsAutoPlayPopup);
            document.getElementById('wordsStopBtn').addEventListener('click', stopWordsAutoPlayPopup);
            document.getElementById('wordsModeSwitch').addEventListener('click', switchWordsPlayModePopup);
            
            // ===== 初始化 Quiz =====
            initQuizInPopup();
        </script>
    </body>
    </html>`;
    
    // 開啟彈窗
    const newWindow = window.open('', '_blank', 'width=900,height=750,scrollbars=yes');
    if (newWindow) {
        newWindow.document.write(allHtml);
        newWindow.document.close();
        
        // 將外部的函數引用傳遞給彈窗
        newWindow.getAvailableVoice = getAvailableVoice;
        newWindow.getCantoneseVoice = getCantoneseVoice;
        newWindow.escapeHtml = escapeHtml;
        
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
            utterance.rate = 0.75;
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
    if (sentencesAutoPlayState.playWindow && !sentencesAutoPlayState.playWindow.closed) {
        try {
            sentencesAutoPlayState.playWindow.focus();
            return;
        } catch(e) {
            sentencesAutoPlayState.playWindow = null;
        }
    }
    
    if (!allSentences.length) {
        alert('No sentences loaded. Please select a file first.');
        return;
    }

    const newWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
    if (!newWindow) {
        alert("Popup blocked. Please allow popups for this site.");
        return;
    }

    sentencesAutoPlayState.playWindow = newWindow;

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

    try {
        newWindow.document.write(sentencesHtml);
        newWindow.document.close();
    } catch(e) {
        console.error('Failed to write to popup window:', e);
        alert('Failed to display sentences. Please try again.');
        newWindow.close();
        if (sentencesAutoPlayState.playWindow === newWindow) {
            sentencesAutoPlayState.playWindow = null;
        }
        return;
    }
}

// ====================== 事件綁定與初始化 ======================
function bindEvents() {
    const levelSelect = document.getElementById('levelSelect');
    const fileSelect = document.getElementById('fileSelect');
    const filterBtn = document.getElementById('filterBtn');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const showAllBtn = document.getElementById('showAllBtn');
    const showAllSentencesBtn = document.getElementById('showAllSentencesBtn');
    
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
        filterBtn.addEventListener('click', filterByDay);
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            localStorage.setItem('savedLevel', currentLevel);
            localStorage.setItem('savedFile', currentFileName);
            alert('Progress saved!');
        });
    }
    
    if (showAllBtn) {
        showAllBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showAllWords();
        });
    }
    
    if (showAllSentencesBtn) {
        showAllSentencesBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showAllSentencesPopup();
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

function init() {
    initDaySelectToggle();
    bindEvents();
    console.log('✅ App initialized successfully');
}

init();
