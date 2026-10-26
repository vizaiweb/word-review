// ====================== UI 互動與功能模組 ======================
// 此檔案包含所有 UI 互動、彈窗、朗讀、Quiz 等功能。
// 核心資料載入邏輯已移至 core.js，請勿在此重複定義。

// ===== 安全防護：確保 removeFileExtension 存在 =====
if (typeof removeFileExtension !== 'function') {
    window.removeFileExtension = function(str) {
        if (!str) return '';
        return str.replace(/\.[^/.]+$/, "");
    };
}

// ====================== 語音引擎相關變量 ======================
let isSentenceReading = false;
let currentSentenceReadButton = null;
let currentSentenceText = "";
let currentReadCount = 0;

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
                if (callback) callback();
            }
        };
        
        silent.onerror = () => {
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
                if (callback) callback();
            }
        }, 1000);
        
    } catch(e) {
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
        setTimeout(() => {
            speakOnce(text, onEnd, rate, retryCount + 1);
        }, 200);
        return;
    }
    
    if (retryCount >= 3) {
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
    
    utterance.onerror = () => {
        if (!ended) {
            ended = true;
            clearTimeout(timeoutId);
            if (onEnd) onEnd();
        }
    };
    
    try { 
        synth.speak(utterance);
    } catch(e) { 
        if (!ended) {
            ended = true;
            clearTimeout(timeoutId);
            if (onEnd) onEnd();
        }
    }
}

function readWordOnly(word) {
    if (!word) return;
    stopAllReading();
    let readCount = 0;
    const maxReads = 3;
    
    function speakNext() {
        if (readCount >= maxReads) return;
        readCount++;
        speakOnce(word, () => {
            if (readCount < maxReads) {
                setTimeout(speakNext, 550);
            }
        }, 0.85);
    }
    ensureVoiceEngine(speakNext);
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
    
    ensureVoiceEngine(speakNext);
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
    if (voice) utterance.voice = voice;
    
    let ended = false;
    utterance.onend = () => {
        if (!ended) { ended = true; if (onEnd) onEnd(); }
    };
    utterance.onerror = () => {
        if (!ended) { ended = true; if (onEnd) onEnd(); }
    };
    
    try {
        synth.speak(utterance);
        setTimeout(() => {
            if (!ended) { ended = true; if (onEnd) onEnd(); }
        }, Math.max(1000, text.length * 100));
    } catch(e) {
        if (onEnd) onEnd();
    }
}

function playCantoneseOnly(text) {
    if (!text) return;
    stopAllReading();
    speakCantoneseOnce(text, () => {});
}

function preheatVoice() {
    ensureVoiceEngine(() => {});
}

setTimeout(() => { preheatVoice(); }, 1000);

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
        if (allWords[i].day > max) max = allWords[i].day;
    }
    return max;
}

// ====================== 單詞顯示功能 ======================
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
        ${w.englishExplanation ? `<div style="font-size: 16px; color: #475569; margin-top: 8px; font-style: italic; border-top: 1px solid #e2e8f0; padding-top: 8px;">${escapeHtml(w.englishExplanation)}</div>` : ''}
    `;
    
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 8px;">
            <div class="meaning" style="margin-bottom: 0; flex: 1;">💡 ${w.meaning}</div>
            <button id="readCantoneseBtn" style="background: #333; color: white; border: none; border-radius: 40px; padding: 6px 12px; font-size: 13px; font-weight: bold; cursor: pointer;">🔊粵 1x</button>
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
            preheatVoice();
            playCantoneseOnly(w.meaning);
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
            readWordOnly(w.word);
        };
    }
    
    const prevBtn = document.getElementById("btnPrevWord");
    if (prevBtn) {
        prevBtn.onclick = () => {
            if (currentWordIdx > 0) { currentWordIdx--; showWord(); }
        };
    }
    
    const nextBtn = document.getElementById("btnNextWord");
    if (nextBtn) {
        nextBtn.onclick = () => {
            if (currentWordIdx + 1 <= filteredWords.length) { currentWordIdx++; showWord(); }
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
        container.innerHTML = `${currentCategory} | ${currentLevel} | ${displayFile} | ${dayDisplay} | ${currentWordIdx + 1}/${filteredWords.length} words | ✏️ Sentences: ${allSentences.length}`;
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
        const showBtn = document.getElementById("showSentenceBtn");
        if (hiddenSpan.style.display === "none" || hiddenSpan.style.display === "") {
            hiddenSpan.style.display = "block";
            if (showBtn) showBtn.textContent = "🙈 Hide Sentence";
        } else {
            hiddenSpan.style.display = "none";
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
    
    if (showBtn) showBtn.onclick = () => showCurrentSentence();
    if (readBtn) readBtn.onclick = () => {
        const currentSent = allSentences[currentSentenceIdx];
        if (currentSent) { preheatVoice(); toggleSentenceReading(currentSent.sentence_en, readBtn); }
    };
    if (prevBtn) prevBtn.onclick = () => prevSentence();
    if (nextBtn) nextBtn.onclick = () => nextSentence();
    if (allBtn) allBtn.onclick = () => showAllSentencesPopup();
}

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
    stopSentenceReading();
    try { synth.cancel(); } catch(e) {}
}

// ====================== 彈窗函數 (Show All Words - 含 Words List, Quiz, Spelling) ======================
function playSingleWord(word, meaning) {
    if (!word) return;
    stopAllReading();
    let step = 0;
    let repeatCount = 0;
    let isCancelled = false;
    
    function speakNext() {
        if (isCancelled) return;
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
            }, 0.85);
        } else if (step === 1) {
            const utterance = new SpeechSynthesisUtterance(meaning);
            utterance.lang = "yue";
            utterance.rate = 0.85;
            utterance.pitch = 1.0;
            utterance.volume = 1;
            const voice = getCantoneseVoice();
            if (voice) utterance.voice = voice;
            synth.speak(utterance);
        }
    }
    ensureVoiceEngine(speakNext);
}

function showAllWords() {
    if (allWords.length === 0) {
        alert('No words loaded. Please select a file first.');
        return;
    }
    
    const fileNice = removeFileExtension(currentFileName);
    
    let tableRows = '';
    for (let i = 0; i < allWords.length; i++) {
        const w = allWords[i];
        tableRows += '<tr id="word_row_' + i + '" style="border-bottom: 1px solid #e2e8f0; transition: background-color 0.2s;">' +
            '<td style="padding: 10px 12px; text-align: center; width: 60px;">' + w.day + '</td>' +
            '<td style="padding: 10px 12px; font-weight: bold; color: #dc2626;">' + escapeHtml(w.word.toUpperCase()) + '</td>' +
            '<td style="padding: 10px 12px; color: #334155;">' + escapeHtml(w.meaning) + '</td>' +
            '<td style="padding: 10px 12px; text-align: center; width: 60px;">' +
                '<button class="listen-single-btn" data-word="' + escapeHtml(w.word) + '" data-meaning="' + escapeHtml(w.meaning) + '" style="background: none; border: none; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px;">🔊</button>' +
            '</td>' +
        '</tr>';
    }
    
    const allHtml = '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>All Words - ' + currentLevel + '</title>' +
        '<style>' +
            '* { margin: 0; padding: 0; box-sizing: border-box; }' +
            'body { font-family: "Segoe UI", -apple-system, Arial, sans-serif; background: #f0f4f8; padding: 20px; }' +
            '.container { max-width: 900px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }' +
            '.header { background: linear-gradient(135deg, #ff9a56, #ff6b35); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }' +
            '.header h2 { color: white; font-size: 20px; font-weight: 600; }' +
            '.header p { color: rgba(255,255,255,0.8); font-size: 14px; }' +
            '.tab-bar { display: flex; background: #f1f5f9; padding: 4px; border-radius: 12px; margin: 16px 20px 0 20px; gap: 4px; }' +
            '.tab-btn { flex: 1; padding: 10px 16px; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; background: transparent; color: #64748b; transition: all 0.25s ease; }' +
            '.tab-btn:hover { color: #1e293b; background: rgba(255,255,255,0.5); }' +
            '.tab-btn.active { background: linear-gradient(135deg, #ff9a56, #ff6b35); color: white; box-shadow: 0 2px 8px rgba(255,107,53,0.3); }' +
            '.tab-panel { display: none; padding: 16px 20px 0 20px; animation: fadeIn 0.3s ease; }' +
            '.tab-panel.active { display: block; }' +
            '@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }' +
            '.words-control-bar { background: #f8fafc; padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }' +
            '.play-btn { background: #22c55e; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; }' +
            '.stop-btn { background: #ef4444; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; }' +
            '.stop-btn:disabled { background: #f0a3a3; cursor: not-allowed; }' +
            '.mode-switch { background: #333; color: white; border: none; border-radius: 40px; padding: 6px 16px; font-size: 13px; font-weight: bold; cursor: pointer; }' +
            '.words-table-wrapper, .quiz-table-wrapper { overflow-x: auto; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 16px; }' +
            '.words-table, .quiz-table { width: 100%; border-collapse: collapse; font-size: 14px; }' +
            '.words-table thead th, .quiz-table thead th { background: #f8fafc; padding: 12px; text-align: left; font-weight: 600; color: #1e293b; border-bottom: 2px solid #e2e8f0; }' +
            '.words-table tbody td, .quiz-table tbody td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }' +
            '.quiz-stats { display: flex; justify-content: center; gap: 30px; background: #f8fafc; padding: 12px 20px; border-radius: 12px; margin-bottom: 16px; font-size: 15px; font-weight: 500; color: #1e293b; flex-wrap: wrap; }' +
            '.quiz-stats .stat-number { color: #ff6b35; font-weight: 700; }' +
            '.spelling-builder { padding: 0 4px; }' +
            '.builder-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #f1f5f9; }' +
            '.builder-meaning { background: #f8fafc; padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; font-size: 18px; color: #334155; }' +
            '.builder-dropzone { min-height: 80px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 16px; padding: 16px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center; margin-bottom: 16px; }' +
            '.word-token { display: inline-block; padding: 10px 16px; background: white; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 18px; font-weight: 600; color: #1e293b; cursor: grab; user-select: none; box-shadow: 0 2px 4px rgba(0,0,0,0.05); text-transform: uppercase; }' +
            '.empty-slot { min-width: 36px; padding: 10px 8px; background: #f1f5f9; border: 2px dashed #94a3b8; border-radius: 10px; color: #94a3b8; text-align: center; }' +
            '.builder-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 16px; }' +
            '.builder-actions button { padding: 10px 24px; border: none; border-radius: 40px; font-size: 15px; font-weight: 600; cursor: pointer; color: white; }' +
            '.btn-prev { background: #3b82f6; } .btn-shuffle { background: #f59e0b; } .btn-check { background: #22c55e; } .btn-next { background: #8b5cf6; }' +
            '.builder-feedback { text-align: center; margin-top: 12px; font-size: 16px; font-weight: 600; min-height: 30px; color: #94a3b8; }' +
            '.footer { padding: 16px 20px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0; margin-top: 16px; }' +
            '.close-btn { background: #ff6b35; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; }' +
        '</style>' +
    '</head>' +
    '<body>' +
        '<div class="container">' +
            '<div class="header">' +
                '<h2>📝 ' + currentCategory + ' - ' + currentLevel + ' - ' + escapeHtml(fileNice) + '</h2>' +
                '<p>Total ' + allWords.length + ' words</p>' +
            '</div>' +
            '<div class="tab-bar">' +
                '<button class="tab-btn active" data-tab="words">📖 Words List</button>' +
                '<button class="tab-btn" data-tab="quiz">✏️ Quiz</button>' +
                '<button class="tab-btn" data-tab="spelling">✏️ Spelling</button>' +
            '</div>' +
            '<div class="tab-content">' +
                '<div id="tab-words" class="tab-panel active">' +
                    '<div class="words-control-bar">' +
                        '<button id="wordsPlayBtn" class="play-btn">▶️ Play All</button>' +
                        '<button id="wordsStopBtn" class="stop-btn" disabled>⏹️ Stop</button>' +
                        '<button id="wordsModeSwitch" class="mode-switch">Sequential ○──● Random</button>' +
                        '<span id="wordsProgress" class="words-progress">0 / ' + allWords.length + '</span>' +
                    '</div>' +
                    '<div class="words-table-wrapper">' +
                        '<table class="words-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th>Day</th>' +
                                    '<th>Word</th>' +
                                    '<th>Meaning</th>' +
                                    '<th style="text-align: center; width: 70px;">Listen</th>' +
                                '</tr>' +
                            '</thead>' +
                            '<tbody>' + tableRows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
                '<div id="tab-quiz" class="tab-panel">' +
                    '<div class="quiz-stats" id="quizStats">' +
                        '<span>Total Questions: <span class="stat-number">' + allWords.length + '</span></span>' +
                        '<span>Answered: <span class="stat-number">0</span></span>' +
                        '<span>Correct Rate: <span class="stat-number">--%</span></span>' +
                    '</div>' +
                    '<div style="text-align: center; margin-bottom: 16px;">' +
                        '<button id="quizShuffleToggleBtn" style="background: #f59e0b; color: white; border: none; border-radius: 40px; padding: 6px 20px; font-size: 14px; font-weight: 600; cursor: pointer;">🔀 Shuffle Questions</button>' +
                    '</div>' +
                    '<div class="quiz-table-wrapper">' +
                        '<table class="quiz-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th>No.</th>' +
                                    '<th>Explanation</th>' +
                                    '<th>Option A</th>' +
                                    '<th>Option B</th>' +
                                    '<th>Option C</th>' +
                                    '<th>Your Answer</th>' +
                                    '<th>Result</th>' +
                                    '<th>Listen</th>' +
                                '</tr>' +
                            '</thead>' +
                            '<tbody id="quizBody">' +
                                '<tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8;">Loading quiz data...</td></tr>' +
                            '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
                '<div id="tab-spelling" class="tab-panel">' +
                    '<div id="spellingContainer"></div>' +
                '</div>' +
            '</div>' +
            '<div class="footer">' +
                '<button class="close-btn" onclick="window.close()">Close</button>' +
            '</div>' +
        '</div>' +
        '<script>' +
            'window.allWordsData = ' + JSON.stringify(allWords) + ';' +
            'function getAvailableVoice() {' +
                'const voices = window.speechSynthesis.getVoices();' +
                'return voices.find(v => v.lang && v.lang.includes("en")) || voices[0];' +
            '}' +
            'function getCantoneseVoice() {' +
                'const voices = window.speechSynthesis.getVoices();' +
                'return voices.find(v => v.lang === "yue" || v.lang === "zh-HK") || voices[0];' +
            '}' +
            'function escapeHtml(str) {' +
                'if (!str) return "";' +
                'return str.replace(/[&<>]/g, function(m) {' +
                    'if (m === "&") return "&amp;";' +
                    'if (m === "<") return "&lt;";' +
                    'if (m === ">") return "&gt;";' +
                    'return m;' +
                '});' +
            '}' +
            'function highlightWordRowPopup(index) {' +
                'const total = window.allWordsData.length;' +
                'for (let i = 0; i < total; i++) {' +
                    'const row = document.getElementById("word_row_" + i);' +
                    'if (row) {' +
                        'if (i === index) {' +
                            'row.style.backgroundColor = "#fff3cd";' +
                            'row.style.fontWeight = "bold";' +
                        '} else {' +
                            'row.style.backgroundColor = "";' +
                            'row.style.fontWeight = "normal";' +
                        '}' +
                    '}' +
                '}' +
            '}' +
            'function speakWordWithEnglishAndCantonesePopup(word, meaning, onComplete) {' +
                'let step = 0;' +
                'let repeatCount = 0;' +
                'function speakNext() {' +
                    'if (!wordsAutoPlayStatePopup.isPlaying || wordsAutoPlayStatePopup.isPaused) {' +
                        'if (onComplete) onComplete();' +
                        'return;' +
                    '}' +
                    'if (step === 0) {' +
                        'const utterance = new SpeechSynthesisUtterance(word);' +
                        'utterance.lang = "en-US";' +
                        'utterance.rate = 0.75;' +
                        'const voice = getAvailableVoice();' +
                        'if (voice) utterance.voice = voice;' +
                        'utterance.onend = () => {' +
                            'repeatCount++;' +
                            'if (repeatCount < 3) {' +
                                'setTimeout(speakNext, 450);' +
                            '} else {' +
                                'step = 1;' +
                                'repeatCount = 0;' +
                                'setTimeout(speakNext, 450);' +
                            '}' +
                        '};' +
                        'window.speechSynthesis.speak(utterance);' +
                    '} else if (step === 1) {' +
                        'const utterance = new SpeechSynthesisUtterance(meaning);' +
                        'utterance.lang = "yue";' +
                        'utterance.rate = 0.75;' +
                        'const voice = getCantoneseVoice();' +
                        'if (voice) utterance.voice = voice;' +
                        'utterance.onend = () => {' +
                            'setTimeout(() => { if (onComplete) onComplete(); }, 350);' +
                        '};' +
                        'window.speechSynthesis.speak(utterance);' +
                    '}' +
                '}' +
                'speakNext();' +
            '}' +
            'let wordsAutoPlayStatePopup = { isPlaying: false, isPaused: false, currentIndex: 0, mode: "sequential", playedIndices: [], remainingIndices: [], totalCount: 0, timeoutId: null };' +
            'function playNextWordPopup() {' +
                'if (!wordsAutoPlayStatePopup.isPlaying || wordsAutoPlayStatePopup.isPaused) return;' +
                'const total = wordsAutoPlayStatePopup.totalCount;' +
                'if (wordsAutoPlayStatePopup.playedIndices.length >= total) {' +
                    'highlightWordRowPopup(-1);' +
                    'stopWordsAutoPlayPopup();' +
                    'return;' +
                '}' +
                'let nextIndex;' +
                'if (wordsAutoPlayStatePopup.mode === "sequential") {' +
                    'nextIndex = wordsAutoPlayStatePopup.playedIndices.length;' +
                '} else {' +
                    'if (wordsAutoPlayStatePopup.remainingIndices.length === 0) {' +
                        'wordsAutoPlayStatePopup.remainingIndices = Array.from({length: total}, (_, i) => i);' +
                    '}' +
                    'const randomPos = Math.floor(Math.random() * wordsAutoPlayStatePopup.remainingIndices.length);' +
                    'nextIndex = wordsAutoPlayStatePopup.remainingIndices[randomPos];' +
                    'wordsAutoPlayStatePopup.remainingIndices.splice(randomPos, 1);' +
                '}' +
                'wordsAutoPlayStatePopup.currentIndex = nextIndex;' +
                'highlightWordRowPopup(nextIndex);' +
                'const wordData = window.allWordsData[nextIndex];' +
                'const progressSpan = document.getElementById("wordsProgress");' +
                'if (progressSpan) progressSpan.textContent = (wordsAutoPlayStatePopup.playedIndices.length + 1) + " / " + total;' +
                'speakWordWithEnglishAndCantonesePopup(wordData.word, wordData.meaning, () => {' +
                    'wordsAutoPlayStatePopup.playedIndices.push(nextIndex);' +
                    'if (progressSpan) progressSpan.textContent = wordsAutoPlayStatePopup.playedIndices.length + " / " + total;' +
                    'wordsAutoPlayStatePopup.timeoutId = setTimeout(() => { playNextWordPopup(); }, 500);' +
                '});' +
            '}' +
            'function toggleWordsAutoPlayPopup() {' +
                'const playBtn = document.getElementById("wordsPlayBtn");' +
                'const stopBtn = document.getElementById("wordsStopBtn");' +
                'const modeSwitch = document.getElementById("wordsModeSwitch");' +
                'if (!wordsAutoPlayStatePopup.isPlaying && !wordsAutoPlayStatePopup.isPaused) {' +
                    'wordsAutoPlayStatePopup.isPlaying = true;' +
                    'wordsAutoPlayStatePopup.isPaused = false;' +
                    'wordsAutoPlayStatePopup.playedIndices = [];' +
                    'wordsAutoPlayStatePopup.remainingIndices = [];' +
                    'wordsAutoPlayStatePopup.totalCount = window.allWordsData.length;' +
                    'if (wordsAutoPlayStatePopup.mode === "random") {' +
                        'wordsAutoPlayStatePopup.remainingIndices = Array.from({length: window.allWordsData.length}, (_, i) => i);' +
                    '}' +
                    'if (playBtn) { playBtn.textContent = "⏸️ Pause"; playBtn.style.background = "#f59e0b"; }' +
                    'if (stopBtn) stopBtn.disabled = false;' +
                    'if (modeSwitch) modeSwitch.disabled = true;' +
                    'playNextWordPopup();' +
                '} else if (wordsAutoPlayStatePopup.isPlaying && !wordsAutoPlayStatePopup.isPaused) {' +
                    'wordsAutoPlayStatePopup.isPaused = true;' +
                    'wordsAutoPlayStatePopup.isPlaying = false;' +
                    'if (wordsAutoPlayStatePopup.timeoutId) { clearTimeout(wordsAutoPlayStatePopup.timeoutId); wordsAutoPlayStatePopup.timeoutId = null; }' +
                    'if (playBtn) { playBtn.textContent = "▶️ Resume"; playBtn.style.background = "#22c55e"; }' +
                '} else if (wordsAutoPlayStatePopup.isPaused) {' +
                    'wordsAutoPlayStatePopup.isPaused = false;' +
                    'wordsAutoPlayStatePopup.isPlaying = true;' +
                    'if (playBtn) { playBtn.textContent = "⏸️ Pause"; playBtn.style.background = "#f59e0b"; }' +
                    'playNextWordPopup();' +
                '}' +
            '}' +
            'function stopWordsAutoPlayPopup() {' +
                'try { window.speechSynthesis.cancel(); } catch(e) {}' +
                'if (wordsAutoPlayStatePopup.timeoutId) {' +
                    'clearTimeout(wordsAutoPlayStatePopup.timeoutId);' +
                    'wordsAutoPlayStatePopup.timeoutId = null;' +
                '}' +
                'wordsAutoPlayStatePopup.isPlaying = false;' +
                'wordsAutoPlayStatePopup.isPaused = false;' +
                'wordsAutoPlayStatePopup.playedIndices = [];' +
                'wordsAutoPlayStatePopup.remainingIndices = [];' +
                'highlightWordRowPopup(-1);' +
                'const playBtn = document.getElementById("wordsPlayBtn");' +
                'const stopBtn = document.getElementById("wordsStopBtn");' +
                'const modeSwitch = document.getElementById("wordsModeSwitch");' +
                'if (playBtn) { playBtn.textContent = "▶️ Play All"; playBtn.disabled = false; playBtn.style.background = "#22c55e"; }' +
                'if (stopBtn) stopBtn.disabled = true;' +
                'if (modeSwitch) modeSwitch.disabled = false;' +
                'const progressSpan = document.getElementById("wordsProgress");' +
                'if (progressSpan) progressSpan.textContent = "0 / " + window.allWordsData.length;' +
            '}' +
            'function switchWordsPlayModePopup() {' +
                'const modeSwitch = document.getElementById("wordsModeSwitch");' +
                'wordsAutoPlayStatePopup.mode = wordsAutoPlayStatePopup.mode === "sequential" ? "random" : "sequential";' +
                'stopWordsAutoPlayPopup();' +
                'if (modeSwitch) {' +
                    'modeSwitch.textContent = wordsAutoPlayStatePopup.mode === "sequential" ? "Sequential ○──● Random" : "Sequential ●──○ Random";' +
                '}' +
            '}' +
            'let quizDataPopup = [];' +
            'let currentQuestionIdxPopup = 0;' +
            'let isQuizShuffled = false;' +
            'let originalQuizDataPopup = [];' +
            'function shuffleArrayPopup(arr) {' +
                'const shuffled = [...arr];' +
                'for (let i = shuffled.length - 1; i > 0; i--) {' +
                    'const j = Math.floor(Math.random() * (i + 1));' +
                    '[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];' +
                '}' +
                'return shuffled;' +
            '}' +
            'function generateQuizDataPopup(words) {' +
                'if (!words || words.length === 0) return [];' +
                'const data = [];' +
                'for (let i = 0; i < words.length; i++) {' +
                    'const correctWord = words[i].word.toUpperCase();' +
                    'const explanation = words[i].englishExplanation || words[i].meaning || "";' +
                    'const candidates = words.map((w, idx) => ({ word: w.word.toUpperCase(), idx })).filter(item => item.word !== correctWord);' +
                    'const shuffled = shuffleArrayPopup(candidates);' +
                    'let wrongOptions = shuffled.slice(0, 2).map(item => item.word);' +
                    'while (wrongOptions.length < 2) wrongOptions.push("---");' +
                    'let options = shuffleArrayPopup([correctWord, ...wrongOptions]);' +
                    'const correctIndex = options.indexOf(correctWord);' +
                    'const correctLabel = String.fromCharCode(65 + correctIndex);' +
                    'data.push({ wordIndex: i, word: words[i].word, explanation: explanation, options: options, correctLabel: correctLabel, userAnswer: null });' +
                '}' +
                'return data;' +
            '}' +
            'function renderQuizTablePopup() {' +
                'const container = document.getElementById("quizBody");' +
                'if (!container) return;' +
                'if (!quizDataPopup.length) {' +
                    'container.innerHTML = "<tr><td colspan=\\"8\\" style=\\"text-align:center;padding:40px;color:#94a3b8;\\">No quiz data available.</td></tr>";' +
                    'return;' +
                '}' +
                'let html = "";' +
                'for (let i = 0; i < quizDataPopup.length; i++) {' +
                    'const q = quizDataPopup[i];' +
                    'const isCurrent = (i === currentQuestionIdxPopup);' +
                    'const isAnswered = (q.userAnswer !== null);' +
                    'let resultDisplay = "";' +
                    'if (isAnswered) {' +
                        'resultDisplay = q.userAnswer === q.correctLabel ? "<span style=\\"color:#22c55e;\\">✔</span>" : "<span style=\\"color:#ef4444;\\">✘</span>";' +
                    '}' +
                    'html += "<tr style=\\"" + (isCurrent ? "background:#fff3cd;" : "") + "\\" data-index=\\"" + i + "\\">" +' +
                        "<td style=\\"text-align:center;font-weight:600;color:#64748b;\\">" + (i + 1) + "</td>" +' +
                        "<td style=\\"text-align:left;\\">" + escapeHtml(q.explanation) + "</td>";' +
                    'for (let optIdx = 0; optIdx < q.options.length; optIdx++) {' +
                        'const opt = q.options[optIdx];' +
                        'const label = String.fromCharCode(65 + optIdx);' +
                        'let bgStyle = "";' +
                        'if (isAnswered) {' +
                            'if (opt === q.options[q.correctLabel.charCodeAt(0) - 65]) bgStyle = "background:#dcfce7;color:#15803d;";' +
                            'if (q.userAnswer === label && q.userAnswer !== q.correctLabel) bgStyle = "background:#fee2e2;color:#dc2626;";' +
                        '}' +
                        'html += "<td class=\\"col-option\\" data-quiz-index=\\"" + i + "\\" data-option-label=\\"" + label + "\\" style=\\"text-align:center;font-weight:600;cursor:pointer;" + bgStyle + "\\">" + escapeHtml(opt) + "</td>";' +
                    '}' +
                    'html += "<td style=\\"text-align:center;font-weight:500;\\">" + (isAnswered ? q.userAnswer : "<span style=\\"color:#94a3b8;\\">--</span>") + "</td>" +' +
                             "<td style=\\"text-align:center;font-size:18px;\\">" + resultDisplay + "</td>" +' +
                             "<td style=\\"text-align:center;\\"><button class=\\"listen-btn\\" data-quiz-index=\\"" + i + "\\" style=\\"background:none;border:none;cursor:pointer;font-size:16px;\\">🔊</button></td>" +' +
                    "</tr>";' +
                '}' +
                'container.innerHTML = html;' +
                'document.querySelectorAll("#quizBody tr").forEach(row => {' +
                    'row.onclick = function(e) {' +
                        'if (e.target.closest(".col-option") || e.target.closest(".listen-btn")) return;' +
                        'currentQuestionIdxPopup = parseInt(this.dataset.index);' +
                        'renderQuizTablePopup();' +
                    '};' +
                '});' +
                'document.querySelectorAll(".col-option").forEach(cell => {' +
                    'cell.onclick = function(e) {' +
                        'e.stopPropagation();' +
                        'const idx = parseInt(this.dataset.quizIndex);' +
                        'const label = this.dataset.optionLabel;' +
                        'if (quizDataPopup[idx] && quizDataPopup[idx].userAnswer === null) {' +
                            'quizDataPopup[idx].userAnswer = label;' +
                            'renderQuizTablePopup();' +
                        '}' +
                    '};' +
                '});' +
                'document.querySelectorAll(".listen-btn").forEach(btn => {' +
                    'btn.onclick = function(e) {' +
                        'e.stopPropagation();' +
                        'const idx = parseInt(this.dataset.quizIndex);' +
                        'const q = quizDataPopup[idx];' +
                        'if (q) {' +
                            'const text = "Question " + (q.wordIndex + 1) + ". " + q.explanation + ". Option A: " + q.options[0] + ". Option B: " + q.options[1] + ". Option C: " + q.options[2] + ".";' +
                            'const u = new SpeechSynthesisUtterance(text);' +
                            'u.lang = "en-US";' +
                            'window.speechSynthesis.speak(u);' +
                        '}' +
                    '};' +
                '});' +
            '}' +
            'function initQuizInPopup() {' +
                'if (window.allWordsData.length > 0) {' +
                    'quizDataPopup = generateQuizDataPopup(window.allWordsData);' +
                    'originalQuizDataPopup = JSON.parse(JSON.stringify(quizDataPopup));' +
                    'renderQuizTablePopup();' +
                '}' +
            '}' +
            'document.getElementById("quizShuffleToggleBtn").onclick = function() {' +
                'isQuizShuffled = !isQuizShuffled;' +
                'quizDataPopup = isQuizShuffled ? shuffleArrayPopup(quizDataPopup) : JSON.parse(JSON.stringify(originalQuizDataPopup));' +
                'this.textContent = isQuizShuffled ? "🔄 Restore Order" : "🔀 Shuffle Questions";' +
                'this.style.background = isQuizShuffled ? "#3b82f6" : "#f59e0b";' +
                'renderQuizTablePopup();' +
            '};' +
            'function initSpelling() {' +
                'const container = document.getElementById("spellingContainer");' +
                'if (!container) return;' +
                'const words = window.allWordsData || [];' +
                'if (!words.length) {' +
                    'container.innerHTML = "<p style=\\"text-align:center;padding:40px;color:#94a3b8;\\">No words available.</p>";' +
                    'return;' +
                '}' +
                'function loadSpellingCard(idx) {' +
                    'const w = words[idx];' +
                    'const letters = w.word.toLowerCase().split("");' +
                    'const shuffledLetters = shuffleArrayPopup(letters);' +
                    'let targetSlots = new Array(letters.length).fill(null);' +
                    'container.innerHTML = ' +
                        '"<div class=\\"spelling-builder\\">" +' +
                            '"<div class=\\"builder-header\\">" +' +
                                '"<span>📌 Word " + (idx + 1) + " / " + words.length + "</span>" +' +
                                '"<button id=\\"spellListen\\" style=\\"background:none;border:none;cursor:pointer;font-size:20px;\\">🔊</button>" +' +
                            '"</div>" +' +
                            '"<div class=\\"builder-meaning\\">📖 " + escapeHtml(w.meaning) + "</div>" +' +
                            '"<div class=\\"builder-dropzone\\" id=\\"sourceZone\\">" +' +
                                'shuffledLetters.map((l, i) => "<span class=\\"word-token\\" data-letter=\\"" + l + "\\" data-id=\\"" + i + "\\">" + l.toUpperCase() + "</span>").join("") +' +
                            '"</div>" +' +
                            '"<div class=\\"builder-dropzone\\" id=\\"targetZone\\" style=\\"border-style:dashed;\\">" +' +
                                'targetSlots.map(() => "<span class=\\"empty-slot\\">?</span>").join("") +' +
                            '"</div>" +' +
                            '"<div class=\\"builder-actions\\">" +' +
                                '"<button class=\\"btn-prev\\" " + (idx === 0 ? "disabled" : "") + ">Previous</button>" +' +
                                '"<button class=\\"btn-check\\">Check Answer</button>" +' +
                                '"<button class=\\"btn-next\\" " + (idx === words.length - 1 ? "disabled" : "") + ">Next</button>" +' +
                            '"</div>" +' +
                            '"<div class=\\"builder-feedback\\" id=\\"spellFeedback\\">Click letters to place them</div>" +' +
                        '"</div>";' +
                    'document.getElementById("spellListen").onclick = () => {' +
                        'const u = new SpeechSynthesisUtterance(w.word);' +
                        'u.lang = "en-US";' +
                        'window.speechSynthesis.speak(u);' +
                    '};' +
                    'container.querySelector(".btn-prev").onclick = () => { if (idx > 0) loadSpellingCard(idx - 1); };' +
                    'container.querySelector(".btn-next").onclick = () => { if (idx < words.length - 1) loadSpellingCard(idx + 1); };' +
                    'const sourceTokens = container.querySelectorAll("#sourceZone .word-token");' +
                    'sourceTokens.forEach(token => {' +
                        'token.onclick = function() {' +
                            'const emptyIdx = targetSlots.indexOf(null);' +
                            'if (emptyIdx !== -1) {' +
                                'targetSlots[emptyIdx] = this.dataset.letter;' +
                                'this.style.display = "none";' +
                                'updateTargetView();' +
                            '}' +
                        '};' +
                    '});' +
                    'function updateTargetView() {' +
                        'const targetZone = container.querySelector("#targetZone");' +
                        'if(!targetZone) return;' +
                        'targetZone.innerHTML = targetSlots.map((l, i) => l ? "<span class=\\"word-token\\" data-target-idx=\\"" + i + "\\" style=\\"background:#dcfce7;color:#15803d;\\">" + l.toUpperCase() + "</span>" : "<span class=\\"empty-slot\\">?</span>").join("");' +
                        'targetZone.querySelectorAll(".word-token").forEach(t => {' +
                            't.onclick = function() {' +
                                'const tIdx = parseInt(this.dataset.targetIdx);' +
                                'targetSlots[tIdx] = null;' +
                                'updateTargetView();' +
                                'sourceTokens.forEach(st => { st.style.display = "inline-block"; });' +
                            '};' +
                        '});' +
                    '}' +
                    'container.querySelector(".btn-check").onclick = () => {' +
                        'const userStr = targetSlots.join("");' +
                        'const correctStr = w.word.toLowerCase();' +
                        'const fb = document.getElementById("spellFeedback");' +
                        'if (userStr === correctStr) {' +
                            'fb.innerHTML = "✅ Correct! Well done!";' +
                            'fb.style.color = "#22c55e";' +
                        '} else {' +
                            'fb.innerHTML = "❌ Incorrect. Try again!";' +
                            'fb.style.color = "#ef4444";' +
                        '}' +
                    '};' +
                '}' +
                'loadSpellingCard(0);' +
            '}' +
            'document.querySelectorAll(".tab-btn").forEach(btn => {' +
                'btn.addEventListener("click", function() {' +
                    'document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));' +
                    'this.classList.add("active");' +
                    'document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));' +
                    'const tabName = this.dataset.tab;' +
                    'document.getElementById("tab-" + tabName).classList.add("active");' +
                    'if (tabName === "quiz" && quizDataPopup.length === 0) {' +
                        'initQuizInPopup();' +
                    '} else if (tabName === "spelling") {' +
                        'initSpelling();' +
                    '}' +
                '});' +
            '});' +
            'document.getElementById("wordsPlayBtn").addEventListener("click", toggleWordsAutoPlayPopup);' +
            'document.getElementById("wordsStopBtn").addEventListener("click", stopWordsAutoPlayPopup);' +
            'document.getElementById("wordsModeSwitch").addEventListener("click", switchWordsPlayModePopup);' +
            'document.querySelectorAll(".listen-single-btn").forEach(btn => {' +
                'btn.addEventListener("click", function(e) {' +
                    'e.stopPropagation();' +
                    'const word = this.dataset.word;' +
                    'const meaning = this.dataset.meaning;' +
                    'if (window.opener && typeof window.opener.playSingleWord === "function") {' +
                        'window.opener.playSingleWord(word, meaning);' +
                    '}' +
                '});' +
            '});' +
        '</script>' +
    '</body>' +
    '</html>';
    
    const newWindow = window.open('', '_blank', 'width=900,height=750,scrollbars=yes');
    if (newWindow) {
        newWindow.playSingleWord = playSingleWord;
        newWindow.escapeHtml = escapeHtml;
        newWindow.allWordsData = allWords;
        newWindow.document.write(allHtml);
        newWindow.document.close();
    } else {
        alert("Popup blocked. Please allow popups for this site.");
    }
}

// ====================== 彈窗函數 (Show All Sentences) ======================
function showAllSentencesPopup() {
    if (!allSentences.length) {
        alert('No sentences loaded. Please select a file first.');
        return;
    }

    const newWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
    if (!newWindow) {
        alert("Popup blocked. Please allow popups for this site.");
        return;
    }

    const fileNice = removeFileExtension(currentFileNameForSentences || currentFileName);
    
    let tableRows = '';
    for (let i = 0; i < allSentences.length; i++) {
        const s = allSentences[i];
        tableRows += '<tr id="sentence_row_' + i + '" style="border-bottom: 1px solid #e2e8f0;">' +
            '<td style="padding: 12px; text-align: center; width: 60px;">' + (i + 1) + '</td>' +
            '<td style="padding: 12px; font-weight: bold; color: #b45309;">' + escapeHtml(s.sentence_en) + '</td>' +
            '<td style="padding: 12px; color: #334155;">' + escapeHtml(s.sentence_zh) + '</td>' +
        '</tr>';
    }

    const sentencesHtml = '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>All Sentences - ' + currentLevel + '</title>' +
        '<style>' +
            '* { margin: 0; padding: 0; box-sizing: border-box; }' +
            'body { font-family: "Segoe UI", -apple-system, Arial, sans-serif; background: #f0f4f8; padding: 20px; }' +
            '.container { max-width: 920px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }' +
            '.header { background: linear-gradient(135deg, #ffb347, #ff8c42); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }' +
            '.header h2 { color: white; font-size: 20px; font-weight: 600; }' +
            '.header p { color: rgba(255,255,255,0.8); font-size: 14px; }' +
            '.tab-bar { display: flex; background: #f1f5f9; padding: 4px; border-radius: 12px; margin: 16px 20px 0 20px; gap: 4px; }' +
            '.tab-btn { flex: 1; padding: 10px 16px; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; background: transparent; color: #64748b; }' +
            '.tab-btn.active { background: linear-gradient(135deg, #ff9a56, #ff6b35); color: white; box-shadow: 0 2px 8px rgba(255,107,53,0.3); }' +
            '.tab-panel { display: none; padding: 16px 20px 0 20px; }' +
            '.tab-panel.active { display: block; }' +
            '.sentences-table-wrapper { overflow-x: auto; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 16px; }' +
            '.sentences-table { width: 100%; border-collapse: collapse; font-size: 14px; }' +
            '.sentences-table thead th { background: #f8fafc; padding: 12px; text-align: left; font-weight: 600; color: #1e293b; border-bottom: 2px solid #e2e8f0; }' +
            '.sentences-table tbody td { padding: 12px; vertical-align: top; }' +
            '.footer { padding: 16px 20px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0; margin-top: 16px; }' +
            '.close-btn { background: #ff6b35; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; }' +
        '</style>' +
    '</head>' +
    '<body>' +
        '<div class="container">' +
            '<div class="header">' +
                '<h2>📝 ' + currentLevel + ' - ' + escapeHtml(fileNice) + '</h2>' +
                '<p>Total ' + allSentences.length + ' sentences</p>' +
            '</div>' +
            '<div class="tab-bar">' +
                '<button class="tab-btn active" data-tab="sentences">📜 Sentence List</button>' +
            '</div>' +
            '<div class="tab-content">' +
                '<div id="tab-sentences" class="tab-panel active">' +
                    '<div class="sentences-table-wrapper">' +
                        '<table class="sentences-table">' +
                            '<thead>' +
                                '<tr><th>#</th><th>English</th><th>Chinese</th></tr>' +
                            '</thead>' +
                            '<tbody>' + tableRows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="footer">' +
                '<button class="close-btn" onclick="window.close()">Close</button>' +
            '</div>' +
        '</div>' +
    '</body>' +
    '</html>';

    newWindow.document.write(sentencesHtml);
    newWindow.document.close();
}

// ====================== UI 事件綁定 ======================
function bindUIEvents() {
    const showAllBtn = document.getElementById('showAllBtn');
    const showAllSentencesBtn = document.getElementById('showAllSentencesBtn');
    
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
}

// ====================== 初始化 ======================
bindUIEvents();
console.log('✅ UI module loaded successfully');
