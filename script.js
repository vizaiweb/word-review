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

// 普通话朗读相关变量
let isMandarinReading = false;
let currentMandarinButton = null;
let currentMandarinText = "";

// 粤语朗读相关变量
let isCantoneseReading = false;
let currentCantoneseButton = null;
let currentCantoneseText = "";

// ====================== 调试函数：打印手机上的所有语音 ======================
function debugVoices() {
    if (!window.speechSynthesis) {
        alert("不支持语音合成");
        return;
    }
    const voices = synth.getVoices();
    
    // 筛选所有中文相关的语音
    const zhVoices = voices.filter(v => v.lang.toLowerCase().includes('zh'));
    
    let info = "手机支持的中文语音有 " + zhVoices.length + " 个：\n";
    zhVoices.forEach((v, i) => {
        info += `${i+1}. 名称: ${v.name} | 语言: ${v.lang}\n`;
    });
    
    if (zhVoices.length === 0) {
        info += "\n⚠️ 没有找到中文语音！\n";
        info += "如果这是 iPhone，请前往：\n设置 → 辅助功能 → 旁白 → 语音 → 添加语言 → 下载普通话";
    }
    
    alert(info);
    console.log('中文语音列表:', zhVoices);
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

// ====================== 普通话语音模块（Gemini 终极兼容版） ======================

// 获取普通话语音 - 优先级：大陆普通话 > 台湾国语 > 降级
function getMandarinVoice() {
    const voices = synth.getVoices();
    if (!voices || voices.length === 0) return null;
    
    console.log('所有中文语音包:', voices.filter(v => v.lang.includes('zh')).map(v => ({ name: v.name, lang: v.lang })));
    
    // 第一志愿：寻找纯正的中国大陆普通话（排除港台）
    let targetVoice = voices.find(voice => {
        const name = (voice.name || '').toLowerCase();
        const lang = voice.lang.toLowerCase();
        return (lang === 'zh-cn' || lang === 'zh_cn' || name.includes('mandarin')) &&
               !name.includes('hong kong') && 
               !name.includes('cantonese') &&
               !name.includes('taiwan') &&
               !name.includes('hk') &&
               !name.includes('tw');
    });
    
    // 第二志愿：如果找不到大陆普通话，退而求其次找台湾国语（总比粤语好）
    if (!targetVoice) {
        targetVoice = voices.find(voice => {
            const name = (voice.name || '').toLowerCase();
            const lang = voice.lang.toLowerCase();
            return lang === 'zh-tw' || lang === 'zh_tw' || name.includes('taiwan');
        });
    }
    
    // 第三志愿：如果还是找不到，找任何包含 zh-CN 的
    if (!targetVoice) {
        targetVoice = voices.find(voice => voice.lang.toLowerCase().includes('zh-cn'));
    }
    
    // 第四志愿：找任何中文语音
    if (!targetVoice) {
        targetVoice = voices.find(voice => voice.lang.toLowerCase().includes('zh'));
    }
    
    if (targetVoice) {
        console.log('选中的普通话语音:', targetVoice.name, targetVoice.lang);
    } else {
        console.warn('未找到普通话语音，将使用浏览器默认');
    }
    
    return targetVoice || null;
}

let mandarinVoiceEngineReady = false;
let mandarinVoice = null;

function ensureMandarinEngine(callback) {
    if (mandarinVoiceEngineReady && mandarinVoice) {
        if (callback) callback();
        return;
    }
    
    try {
        mandarinVoice = getMandarinVoice();
        mandarinVoiceEngineReady = true;
        if (callback) callback();
    } catch(e) {
        mandarinVoiceEngineReady = true;
        if (callback) callback();
    }
}

// 朗读普通话（终极兼容版）
function speakMandarinOnce(text, onEnd) {
    if (!text) {
        if (onEnd) onEnd();
        return;
    }
    
    try { synth.cancel(); } catch(e) {}
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1;
    
    // 获取最新语音
    const targetVoice = getMandarinVoice();
    
    if (targetVoice) {
        // ✨ 关键：如果找到了有效的普通话语音包，强制指定
        utterance.voice = targetVoice;
        utterance.lang = targetVoice.lang;
        console.log('使用语音:', targetVoice.name);
    } else {
        // 如果手机里连一个普通话语音都没有，强制指定 lang 为 zh-CN
        utterance.lang = 'zh-CN';
        console.log('使用降级语音: zh-CN');
    }
    
    let ended = false;
    
    utterance.onend = () => {
        if (!ended) {
            ended = true;
            if (onEnd) onEnd();
        }
    };
    
    utterance.onerror = (err) => {
        console.error('Mandarin speech error:', err);
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

// 普通话朗读控制
function startMandarinReading(text, buttonElement) {
    if (isMandarinReading && currentMandarinText === text && currentMandarinButton === buttonElement) {
        stopMandarinReading();
        return;
    }
    
    stopMandarinReading();
    
    currentMandarinText = text;
    currentMandarinButton = buttonElement;
    isMandarinReading = true;
    
    buttonElement.textContent = "⏹️停";
    buttonElement.style.opacity = "0.6";
    
    function beginReading() {
        if (!isMandarinReading) return;
        speakMandarinOnce(text, () => {
            stopMandarinReading();
        });
    }
    
    ensureMandarinEngine(beginReading);
}

function stopMandarinReading() {
    if (!isMandarinReading) return;
    isMandarinReading = false;
    
    if (currentMandarinButton) {
        currentMandarinButton.textContent = "🔊普 1x";
        currentMandarinButton.style.opacity = "1";
        currentMandarinButton = null;
    }
    currentMandarinText = "";
}

function toggleMandarinReading(text, buttonElement) {
    startMandarinReading(text, buttonElement);
}

// ====================== 粤语语音模块 ======================
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
    ensureMandarinEngine(function() {
        console.log('Mandarin voice engine ready');
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
            <div style="display: flex; gap: 8px;">
                <button id="readMandarinBtn" style="background: #333; color: white; border: none; border-radius: 40px; padding: 6px 12px; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.2s;">🔊普 1x</button>
                <button id="readCantoneseBtn" style="background: #333; color: white; border: none; border-radius: 40px; padding: 6px 12px; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.2s;">🔊粵 1x</button>
            </div>
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
    
    // 绑定普通话按钮事件
    const mandarinBtn = document.getElementById("readMandarinBtn");
    if (mandarinBtn) {
        mandarinBtn.onclick = () => {
            toggleMandarinReading(w.meaning, mandarinBtn);
        };
    }
    
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

function showAllSentencesPopup() {
    if (!allSentences.length) return;
    
    const fileNice = removeFileExtension(currentFileNameForSentences);
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
    </style></head><body><div class="container"><h2>${currentLevel} - ${fileNice}</h2>${tableRows ? `<table><thead><tr><th>#</th><th>English</th><th>Chinese</th><tr></thead><tbody>${tableRows}</tbody></table>` : ''}<button class="close-btn" onclick="window.close()">Close</button></div></body></html>`;
    
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(winHtml);
    win.document.close();
}

function showAllWords() {
    if (allWords.length === 0) return;
    
    const fileNice = removeFileExtension(currentFileName);
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

// 停止所有朗读
function stopAllReading() {
    stopWordReading();
    stopSentenceReading();
    stopMandarinReading();
    stopCantoneseReading();
}

// ====================== 调试入口 ======================
// 确保手机加载时能触发调试
window.speechSynthesis.onvoiceschanged = debugVoices;

// 也可以延迟执行一次
setTimeout(debugVoices, 2000);

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
