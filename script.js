// ====================== UI 互動與功能模組 ======================
// 此檔案包含所有 UI 互動、彈窗、朗讀、Quiz 等功能。
// 核心資料載入邏輯已移至 core.js，請勿在此重複定義。

// ====================== 語音引擎相關變量 ======================
// 注意：synth 已在 core.js 中定義，此處直接使用

// 英文朗讀相關變量（僅用於句子朗讀，保留 Stop 功能）
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
    
    const cantoneseBtn = document.getElementById("readCantoneseBtn");
    if (cantoneseBtn) {
        cantoneseBtn.onclick = () => {
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
    
    const showBtn = document.getElementById("btnShowWord");
    if (showBtn) {
        showBtn.onclick = () => {
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
// ... 此部分內容與您現有版本完全相同，請保留所有 showAllWords 相關程式碼 ...
// （由於篇幅限制，此處省略，但請確保複製完整）

// ====================== Show All Sentences 彈窗 ======================
// ... 此部分內容與您現有版本完全相同，請保留所有 showAllSentencesPopup 相關程式碼 ...
// （由於篇幅限制，此處省略，但請確保複製完整）

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

// ====================== UI 模組初始化 ======================
bindUIEvents();
console.log('✅ UI module loaded successfully');
