// 全局狀態
let allWords = [];          
let filteredWords = [];     
let currentWordIdx = 0;     
let currentFileName = "";   
let currentLevel = "";      
let allSentences = [];      
let currentSentenceIdx = 0; 
let currentMode = "local";   

const synth = window.speechSynthesis;
let isWordReading = false;
let isSentenceReading = false;
let currentWordReadButton = null;
let currentSentenceReadButton = null;
let isStopping = false;

// 基礎 URL
function getRawBaseUrl() {
    return 'https://raw.githubusercontent.com/vizaiweb/word-review/main';
}

// 語音功能
function getHighQualityVoice() {
    return new Promise(resolve => {
        let v = synth.getVoices();
        const find = (list) => list.find(v => v.name.includes('Google') && v.lang.includes('en')) || list.find(v => v.name.includes('Samantha')) || list[0];
        if (v.length > 0) resolve(find(v));
        else synth.onvoiceschanged = () => resolve(find(synth.getVoices()));
    });
}

async function speakText(text, onEnd) {
    if (!text || isStopping) { onEnd?.(); return; }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = await getHighQualityVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    utterance.onend = () => { if (!isStopping) onEnd?.(); };
    setTimeout(() => synth.speak(utterance), 50);
}

function stopAll() {
    isStopping = true;
    synth.cancel();
    if (currentWordReadButton) currentWordReadButton.textContent = "🔊 Read 3x";
    if (currentSentenceReadButton) currentSentenceReadButton.textContent = "🔊 Read";
    setTimeout(() => isStopping = false, 300);
}

// 數據載入
async function loadFileList(level) {
    const fileSelect = document.getElementById('fileSelect');
    try {
        const res = await fetch(`${getRawBaseUrl()}/data/${level}/fileList.json`);
        const data = await res.json();
        fileSelect.innerHTML = '';
        data.files.forEach(f => {
            let opt = document.createElement('option');
            opt.value = f; opt.textContent = f.replace('.xlsx','');
            fileSelect.appendChild(opt);
        });
        return true;
    } catch (e) { return false; }
}

async function loadData(filename) {
    if (!filename || !currentLevel) return;
    try {
        const res = await fetch(`${getRawBaseUrl()}/data/${currentLevel}/${filename}`);
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        
        // Words
        allWords = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]).map(i => ({
            word: String(i.word||"").trim(),
            meaning: String(i.meaning||"").trim(),
            day: Number(i.day||0)
        })).filter(i => i.word);
        
        // Sentences
        allSentences = wb.SheetNames[1] ? XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]]).map(i => ({
            sentence_en: String(i.sentence || i.en || "").trim(),
            sentence_zh: String(i.meaning || i.zh || "").trim()
        })).filter(i => i.sentence_en) : [];

        filteredWords = [...allWords];
        currentWordIdx = 0;
        showWord();
        
        document.getElementById('dayRow').style.display = 'flex';
        document.getElementById('sentenceArea').style.display = allSentences.length ? 'block' : 'none';
        if(allSentences.length) { currentSentenceIdx = 0; updateSentence(); }
    } catch (e) { console.error(e); }
}

// UI 顯示
function showWord() {
    const cont = document.getElementById("wordContent");
    if (!filteredWords[currentWordIdx]) {
        cont.innerHTML = "<p>Practice Done!</p>";
        return;
    }
    const w = filteredWords[currentWordIdx];
    cont.innerHTML = `
        <div class="meaning">💡 ${w.meaning}</div>
        <div class="word" id="wEn" style="display:none;">${w.word.toUpperCase()}</div>
        <div class="btn-group">
            <button onclick="document.getElementById('wEn').style.display='block'">👀 Show</button>
            <button id="wRead">🔊 Read 3x</button>
            <button onclick="changeWord(-1)">⬅️ Prev</button>
            <button onclick="changeWord(1)">➡️ Next</button>
        </div>
    `;
    document.getElementById('wRead').onclick = function() {
        let count = 0;
        const read = () => {
            if (count < 3 && !isStopping) {
                speakText(w.word, () => { count++; setTimeout(read, 500); });
            }
        };
        read();
    };
    updateTip();
}

function changeWord(dir) {
    currentWordIdx = Math.max(0, Math.min(filteredWords.length - 1, currentWordIdx + dir));
    showWord();
}

function updateSentence() {
    const s = allSentences[currentSentenceIdx];
    document.querySelector(".sentence-meaning").textContent = `💡 ${s.sentence_zh}`;
    const en = document.getElementById("sentenceEnHidden");
    en.textContent = s.sentence_en; en.style.display = "none";
}

function updateTip() {
    document.getElementById('infoTipContainer').textContent = `Word: ${currentWordIdx + 1}/${filteredWords.length}`;
}

// ====================== 核心：儲存與載入 ======================

function saveSettings() {
    const config = {
        level: document.getElementById('levelSelect').value,
        file: document.getElementById('fileSelect').value,
        daySelect: document.getElementById('daySelect').value,
        dayNum: document.getElementById('dayNum').value
    };
    localStorage.setItem('kidsConfig', JSON.stringify(config));
    // 彈出你要的英文對話框
    alert("All current options have been saved.");
}

async function loadSettings() {
    const data = localStorage.getItem('kidsConfig');
    if (!data) return;
    const config = JSON.parse(data);

    if (config.level) {
        document.getElementById('levelSelect').value = config.level;
        currentLevel = config.level;
        
        // 1. 等待文件列表載入
        const success = await loadFileList(config.level);
        if (success && config.file) {
            // 2. 恢復文件選取並載入數據
            document.getElementById('fileSelect').value = config.file;
            await loadData(config.file);
            
            // 3. 恢復 Day 設定
            if (config.daySelect) {
                document.getElementById('daySelect').value = config.daySelect;
                if (config.daySelect === 'custom') {
                    document.getElementById('dayNum').value = config.dayNum;
                    document.getElementById('dayNum').readOnly = false;
                }
                // 4. 執行篩選
                filterWords();
            }
        }
    }
}

function filterWords() {
    const mode = document.getElementById('daySelect').value;
    const num = Number(document.getElementById('dayNum').value);
    if (mode === 'all') {
        filteredWords = [...allWords];
    } else {
        filteredWords = allWords.filter(w => w.day === num);
    }
    currentWordIdx = 0;
    showWord();
}

// 事件綁定
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('levelConfirm').onclick = async () => {
        currentLevel = document.getElementById('levelSelect').value;
        await loadFileList(currentLevel);
    };
    
    document.getElementById('fileConfirm').onclick = () => {
        loadData(document.getElementById('fileSelect').value);
    };

    document.getElementById('saveSettingsBtn').onclick = saveSettings;

    document.getElementById('daySelect').onchange = function() {
        const isCustom = this.value === 'custom';
        const num = document.getElementById('dayNum');
        num.readOnly = !isCustom;
        num.value = isCustom ? "1" : "--";
    };

    document.getElementById('filterBtn').onclick = filterWords;

    document.getElementById('nextSentenceBtn').onclick = () => {
        currentSentenceIdx = (currentSentenceIdx + 1) % allSentences.length;
        updateSentence();
    };
    
    document.getElementById('showSentenceBtn').onclick = () => {
        document.getElementById('sentenceEnHidden').style.display = 'block';
    };

    // 自動執行載入
    setTimeout(loadSettings, 500);
});
