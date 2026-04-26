/* --- 原有的全局變量保持不變 --- */
let allWords = [];          
let filteredWords = [];     
let currentWordIdx = 0;     
let currentFileName = "";   
let currentLevel = "";      
let allSentences = [];      
let currentSentenceIdx = 0; 
let currentMode = "local";   
const synth = window.speechSynthesis;
let isStopping = false;

/* --- 原有的工具函數 (getRawBaseUrl, speakText 等) 保持不變 --- */
function getRawBaseUrl() {
    return 'https://raw.githubusercontent.com/vizaiweb/word-review/main';
}

async function speakText(text, onEnd) {
    if (!text || isStopping) { onEnd?.(); return; }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    utterance.onend = () => { if (!isStopping) onEnd?.(); };
    setTimeout(() => synth.speak(utterance), 50);
}

/* --- 原有的數據載入邏輯 --- */
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
        allWords = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]).map(i => ({
            word: String(i.word||"").trim(),
            meaning: String(i.meaning||"").trim(),
            day: Number(i.day||0)
        })).filter(i => i.word);
        allSentences = wb.SheetNames[1] ? XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]]).map(i => ({
            sentence_en: String(i.sentence || i.en || "").trim(),
            sentence_zh: String(i.meaning || i.zh || "").trim()
        })).filter(i => i.sentence_en) : [];
        filteredWords = [...allWords];
        currentWordIdx = 0;
        showWord();
        document.getElementById('dayRow').style.display = 'flex';
        document.getElementById('sentenceArea').style.display = allSentences.length ? 'block' : 'none';
        if(allSentences.length) { currentSentenceIdx = 0; updateSentenceUI(); }
    } catch (e) { console.error(e); }
}

/* --- ====================== 新增：儲存與載入功能 ====================== --- */

function saveSettings() {
    const config = {
        level: document.getElementById('levelSelect').value,
        file: document.getElementById('fileSelect').value,
        daySelect: document.getElementById('daySelect').value,
        dayNum: document.getElementById('dayNum').value
    };
    localStorage.setItem('kidsWordReview_Config', JSON.stringify(config));
    // 彈出英文提示對話框
    alert("All current options have been saved.");
}

async function loadSettings() {
    const data = localStorage.getItem('kidsWordReview_Config');
    if (!data) return;
    const config = JSON.parse(data);

    if (config.level) {
        document.getElementById('levelSelect').value = config.level;
        currentLevel = config.level;
        const success = await loadFileList(config.level);
        if (success && config.file) {
            document.getElementById('fileSelect').value = config.file;
            await loadData(config.file);
            if (config.daySelect) {
                document.getElementById('daySelect').value = config.daySelect;
                document.getElementById('dayNum').value = config.dayNum;
                if (config.daySelect === 'custom') {
                    document.getElementById('dayNum').readOnly = false;
                }
                filterByDay();
            }
        }
    }
}

/* --- 原有的 UI 渲染邏輯 (showWord, updateSentenceUI 等) --- */
function showWord() {
    const cont = document.getElementById("wordContent");
    if (!filteredWords[currentWordIdx]) return;
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
    document.getElementById('wRead').onclick = () => {
        let c = 0; 
        const r = () => { if(c<3){ speakText(w.word, ()=>{c++; setTimeout(r, 500);}); } };
        r();
    };
    updateInfoTip();
}

function changeWord(dir) {
    currentWordIdx = Math.max(0, Math.min(filteredWords.length - 1, currentWordIdx + dir));
    showWord();
}

function updateSentenceUI() {
    const s = allSentences[currentSentenceIdx];
    document.querySelector(".sentence-meaning").textContent = `💡 ${s.sentence_zh}`;
    const en = document.getElementById("sentenceEnHidden");
    en.textContent = s.sentence_en; en.style.display = "none";
    document.getElementById('sentenceStats').textContent = `${allSentences.length} sentences`;
}

function filterByDay() {
    const mode = document.getElementById('daySelect').value;
    const num = Number(document.getElementById('dayNum').value);
    filteredWords = (mode === 'all') ? [...allWords] : allWords.filter(w => w.day === num);
    currentWordIdx = 0;
    showWord();
}

function updateInfoTip() {
    document.getElementById('infoTipContainer').textContent = `Word: ${currentWordIdx + 1}/${filteredWords.length}`;
}

/* --- 初始化與事件綁定 --- */
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('levelConfirm').onclick = async () => {
        currentLevel = document.getElementById('levelSelect').value;
        await loadFileList(currentLevel);
    };
    document.getElementById('fileConfirm').onclick = () => {
        loadData(document.getElementById('fileSelect').value);
    };
    document.getElementById('filterBtn').onclick = filterByDay;
    document.getElementById('daySelect').onchange = function() {
        document.getElementById('dayNum').readOnly = (this.value === 'all');
        document.getElementById('dayNum').value = (this.value === 'all' ? '--' : '1');
    };
    document.getElementById('nextSentenceBtn').onclick = () => {
        currentSentenceIdx = (currentSentenceIdx + 1) % allSentences.length;
        updateSentenceUI();
    };
    document.getElementById('showSentenceBtn').onclick = () => {
        document.getElementById('sentenceEnHidden').style.display = 'block';
    };
    document.getElementById('showAllSentencesBtn').onclick = () => {
        alert(allSentences.map(s => s.sentence_en).join('\n'));
    };

    // 綁定儲存按鈕
    document.getElementById('saveSettingsBtn').onclick = saveSettings;

    // 核心：進入網頁時延遲 0.5 秒自動載入上次設定
    setTimeout(loadSettings, 500);
});
