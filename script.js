function showAllWords() {
    if (allWords.length === 0) {
        alert('No words loaded. Please select a file first.');
        return;
    }
    
    const fileNice = removeFileExtension(currentFileName);
    
    // ===== 生成 Words List 表格 (這裡補上了 id) =====
    let tableRows = '';
    for (let i = 0; i < allWords.length; i++) {
        const w = allWords[i];
        tableRows += `
            <tr id="word_row_${i}" style="border-bottom: 1px solid #e2e8f0; transition: background-color 0.3s ease;">
                <td style="padding: 10px 12px; text-align: center; width: 60px;">${w.day}</td>
                <td style="padding: 10px 12px; font-weight: bold; color: #dc2626;">${escapeHtml(w.word.toUpperCase())}</td>
                <td style="padding: 10px 12px; color: #334155;">${escapeHtml(w.meaning)}</td>
                <td style="padding: 10px 12px; text-align: center; width: 60px;">
                    <button class="listen-single-btn" data-word="${escapeHtml(w.word)}" data-meaning="${escapeHtml(w.meaning)}" style="background: none; border: none; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px;">🔊</button>
                </td>
            </tr>
        `;
    }
    
    // ===== 生成彈窗完整 HTML =====
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
            
            /* ===== Spelling Panel ===== */
            .spelling-builder { padding: 0 4px; }
            .spelling-builder .builder-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #f1f5f9; }
            .spelling-builder .builder-header .progress-text { font-weight: 600; color: #1e293b; font-size: 15px; }
            .spelling-builder .builder-header .score-text { font-weight: 600; color: #22c55e; font-size: 15px; }
            .spelling-builder .builder-header .builder-controls { display: flex; gap: 8px; align-items: center; }
            .spelling-builder .builder-header .builder-controls button { background: none; border: none; font-size: 22px; cursor: pointer; padding: 4px 8px; border-radius: 8px; transition: all 0.2s; }
            .spelling-builder .builder-header .builder-controls button:hover { background: #e2e8f0; }
            .spelling-builder .builder-header .builder-controls button:active { transform: scale(0.9); }
            
            .spelling-builder .builder-meaning { background: #f8fafc; padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; font-size: 18px; color: #334155; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
            .spelling-builder .builder-meaning .meaning-text { font-weight: 500; }
            
            /* 模式切換 */
            .spelling-builder .source-mode-bar { display: flex; gap: 8px; margin-bottom: 12px; justify-content: center; }
            .spelling-builder .mode-btn { padding: 6px 20px; border: 2px solid #e2e8f0; border-radius: 40px; background: white; color: #64748b; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
            .spelling-builder .mode-btn:hover { border-color: #ff9a56; color: #ff6b35; }
            .spelling-builder .mode-btn.active { background: linear-gradient(135deg, #ff9a56, #ff6b35); color: white; border-color: transparent; }
            
            .spelling-builder .builder-dropzone {
                min-height: 80px;
                background: #f8fafc;
                border: 2px dashed #cbd5e1;
                border-radius: 16px;
                padding: 16px;
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                align-items: center;
                justify-content: center;
                margin-bottom: 16px;
                transition: all 0.2s;
                position: relative;
            }
            .spelling-builder .builder-dropzone.drag-over { border-color: #ff9a56; background: #fff7ed; }
            
            .spelling-builder .source-area { margin-bottom: 16px; }
            .spelling-builder .target-area { margin-bottom: 16px; border-top: 2px dashed #cbd5e1; padding-top: 16px; }
            
            .spelling-builder .word-token {
                display: inline-block;
                padding: 10px 16px;
                background: white;
                border: 2px solid #e2e8f0;
                border-radius: 10px;
                font-size: 18px;
                font-weight: 600;
                color: #1e293b;
                user-select: none;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                transition: all 0.2s;
                position: relative;
                text-transform: uppercase;
            }
            .spelling-builder .word-token.dragging {
                opacity: 0.7;
                transform: scale(1.08);
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
                z-index: 1000;
                transition: none !important;
                cursor: grabbing;
            }
            
            /* 目標欄佔位符 */
            .spelling-builder .target-token.empty-slot {
                min-width: 32px;
                color: #94a3b8;
                text-align: center;
                padding: 10px 8px;
            }
            
            /* 分隔符 */
            .spelling-builder .separator {
                font-size: 20px;
                font-weight: bold;
                color: #94a3b8;
                user-select: none;
                margin: 0 4px;
            }
            
            /* 拖拽懸停高亮 */
            .word-token.drag-over-me,
            .empty-slot.drag-over-me {
                background: #ffedd5 !important;
                border-color: #ff9a56 !important;
                box-shadow: 0 0 0 3px #ff9a56 !important;
                transform: scale(1.03);
                transition: all 0.15s ease;
            }
            
            .spelling-builder .builder-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 16px; }
            .spelling-builder .builder-actions button { padding: 10px 24px; border: none; border-radius: 40px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; color: white; }
            .spelling-builder .builder-actions button:hover { opacity: 0.85; transform: scale(0.97); }
            .spelling-builder .builder-actions button:active { transform: scale(0.94); }
            .spelling-builder .builder-actions .btn-prev { background: #3b82f6; }
            .spelling-builder .builder-actions .btn-prev:disabled { background: #94a3b8; cursor: not-allowed; opacity: 0.6; }
            .spelling-builder .builder-actions .btn-next { background: #8b5cf6; }
            .spelling-builder .builder-actions .btn-next:disabled { background: #94a3b8; cursor: not-allowed; opacity: 0.6; }
            .spelling-builder .builder-actions .btn-shuffle { background: #f59e0b; }
            .spelling-builder .builder-actions .btn-check { background: #22c55e; }
            
            .spelling-builder .builder-feedback { text-align: center; margin-top: 12px; font-size: 16px; font-weight: 600; min-height: 30px; color: #94a3b8; }

/* 已顯示的答案單字 */
.spelling-builder .revealed-word {
    font-size: 20px;
    font-weight: bold;
    color: #22c55e;
    letter-spacing: 1px;
    padding: 4px 16px;
    background: #dcfce7;
    border-radius: 40px;
    animation: revealPop 0.4s ease;
    text-transform: uppercase;
}

@keyframes revealPop {
    0% { transform: scale(0.5); opacity: 0; }
    60% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
}

/* Show Answer 按鈕 */
.spelling-builder .show-answer-btn {
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 40px;
    padding: 6px 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    animation: revealPop 0.4s ease;
}

.spelling-builder .show-answer-btn:hover {
    opacity: 0.85;
    transform: scale(0.97);
}

.spelling-builder .show-answer-btn:active {
    transform: scale(0.94);
}
            
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
            .spelling-builder .revealed-word {
    font-size: 16px;
    padding: 3px 12px;
}
.spelling-builder .show-answer-btn {
    font-size: 12px;
    padding: 5px 12px;
}
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
                .spelling-builder .word-token { font-size: 15px; padding: 8px 12px; }
                .spelling-builder .target-token.empty-slot { min-width: 26px; padding: 8px 6px; }
                .spelling-builder .builder-actions button { padding: 8px 16px; font-size: 13px; flex: 1; min-width: 60px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- Header -->
            <div class="header">
                <h2>📝 ${currentCategory} - ${currentLevel} - ${escapeHtml(fileNice)}</h2>
                <p>Total ${allWords.length} words</p>
            </div>
            
            <!-- Tab Bar -->
            <div class="tab-bar">
                <button class="tab-btn active" data-tab="words">📖 Words List</button>
                <button class="tab-btn" data-tab="quiz">✏️ Quiz</button>
                <button class="tab-btn" data-tab="spelling">✏️ Spelling</button>
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
                                <tr>
                                    <th>Day</th>
                                    <th>Word</th>
                                    <th>Meaning</th>
                                    <th style="text-align: center; width: 70px;">Listen</th>
                                </tr>
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
                    <!-- 新增的打亂/回復順序按鈕列 -->
<div style="text-align: center; margin-bottom: 16px;">
    <button id="quizShuffleToggleBtn" style="background: #f59e0b; color: white; border: none; border-radius: 40px; padding: 6px 20px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;">🔀 Shuffle Questions</button>
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
                
                <!-- Spelling Panel -->
                <div id="tab-spelling" class="tab-panel">
                    <div id="spellingContainer"></div>
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
                    
                    if (this.dataset.tab === 'quiz') {
                        initQuizInPopup();
                    } else if (this.dataset.tab === 'spelling') {
                        initSpelling();
                    }
                });
            });
            
            // ===== Quiz 功能（彈窗內） =====
            let quizDataPopup = [];
            let userAnswersPopup = {};
            let currentQuestionIdxPopup = 0;

            // ===== 追蹤 Quiz 是否處於打亂狀態 =====
let isQuizShuffled = false;
let originalQuizDataPopup = []; // 用來備份原始順序
            
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
        originalQuizDataPopup = JSON.parse(JSON.stringify(quizDataPopup)); // 備份原始順序
        isQuizShuffled = false;
        updateShuffleButtonText();
        userAnswersPopup = {};
        currentQuestionIdxPopup = 0;
        renderQuizTablePopup();
    }
}

function toggleQuizShuffle() {
    isQuizShuffled = !isQuizShuffled;
    
    if (isQuizShuffled) {
        // 打亂題目順序（使用洗牌函數）
        quizDataPopup = shuffleArrayPopup(quizDataPopup);
    } else {
        // 回復原始順序（透過備份還原）
        quizDataPopup = JSON.parse(JSON.stringify(originalQuizDataPopup));
    }
    
    currentQuestionIdxPopup = 0; // 重置到第一題
    updateShuffleButtonText();
    renderQuizTablePopup();
}

function updateShuffleButtonText() {
    const btn = document.getElementById('quizShuffleToggleBtn');
    if (btn) {
        if (isQuizShuffled) {
            btn.textContent = '🔄 Restore Order';
            btn.style.background = '#3b82f6'; // 換個顏色代表可以還原
        } else {
            btn.textContent = '🔀 Shuffle Questions';
            btn.style.background = '#f59e0b';
        }
    }
}

// 記得在初始化或綁定事件的地方加上這行：
document.getElementById('quizShuffleToggleBtn').addEventListener('click', toggleQuizShuffle);

            
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


                        // 高亮當前行
            function highlightCurrentWordRow(index) {
                // 先清除所有高亮
                clearWordHighlight();
                
                // 找到對應的列
                const row = document.getElementById('word_row_' + index);
                if (row) {
                    row.style.backgroundColor = '#fff3cd'; // 這是淡淡的黃色，跟 Quiz 一樣
                    // 也可以讓字體顏色變深，更明顯
                    row.style.transition = 'background-color 0.3s ease';
                }
            }

            // 清除所有行的高亮
            function clearWordHighlight() {
                document.querySelectorAll('.words-table tbody tr').forEach(tr => {
                    tr.style.backgroundColor = '';
                });
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
                    
                    // 播放結束，清除高亮
                    clearWordHighlight();
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
                
                // 新增：高亮當前行
                highlightCurrentWordRow(nextIndex);
                
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
                
                // 清除高亮
                clearWordHighlight();
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
            
            // ===== 音效（複用） =====
            function playBeep(frequency, duration) {
                try {
                    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    var oscillator = audioCtx.createOscillator();
                    var gainNode = audioCtx.createGain();
                    oscillator.connect(gainNode);
                    gainNode.connect(audioCtx.destination);
                    oscillator.frequency.value = frequency;
                    oscillator.type = 'sine';
                    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
                    oscillator.start(audioCtx.currentTime);
                    oscillator.stop(audioCtx.currentTime + duration);
                } catch(e) {
                    console.warn('Audio not supported');
                }
            }
            
            // ===== Spelling 模組 =====
            var spellingState = {
    words: [],
    currentIndex: 0,
    totalCount: 0,
    syllables: [],
    letters: [],
    hasSyllables: false,
    sourceMode: 'letter',
    sourceItems: [],
    targetSlots: [],
    isAnswered: false,
    stats: { total: 0, correct: 0 },
    revealedWord: false,
    lastCheckCorrect: null,
    scored: false
};
            
            function splitWordToSyllables(word, syllable) {
    var wordStr = (word === null || word === undefined) ? '' : String(word).trim();
    var sylStr = (syllable === null || syllable === undefined) ? '' : String(syllable).trim();
    
    if (wordStr === '') {
        return [];
    }
    
    var isSyllableValid = sylStr !== '' && 
                          sylStr !== '--' && 
                          sylStr !== '-' && 
                          /[a-zA-Z]/.test(sylStr);
    
    if (isSyllableValid) {
        // 【絕對安全修改】直接用 [ -]（連字號或半形空格），絕對不會動到任何字母 s
        var parts = sylStr
            .split(/[- ]+/)
            .map(function(s) { return s.trim().toLowerCase(); })
            .filter(function(s) { return s.length > 0; });
        if (parts.length > 1) {
            return parts;
        }
    }
    
    var wordParts = wordStr
        .split(/[- ]+/)
        .map(function(s) { return s.trim().toLowerCase(); })
        .filter(function(s) { return s.length > 0; });
    return wordParts.length > 0 ? wordParts : [wordStr.toLowerCase()];
}

function syllablesToLetters(syllables) {
    if (!syllables || syllables.length === 0) return [];
    return syllables.join('').split('');
}

function hasRealSyllables(word, syllable) {
    var sylStr = (syllable === null || syllable === undefined) ? '' : String(syllable).trim();
    
    // "--" 視為無 syllable
    if (sylStr === '' || sylStr === '--' || sylStr === '-' || !/[a-zA-Z]/.test(sylStr)) {
        return false;
    }
    
    var parts = splitWordToSyllables(word, syllable);
    return parts.length > 1;
}
            
    // ===== 計算並取得隨機預填的字母索引 =====
function getPrefilledIndices(lettersLength, mode) {
    if (mode !== 'letter') return [];
    var prefillCount = 0;
    if (lettersLength > 15) {
        prefillCount = 4;
    } else if (lettersLength > 11) {
        prefillCount = 3;
    } else if (lettersLength > 7) {
        prefillCount = 2;
    } else if (lettersLength > 3) {
        prefillCount = 1;
    }
    
    if (prefillCount === 0 || lettersLength === 0) return [];
    
    var indices = Array.from({length: lettersLength}, function(_, i) { return i; });
    indices = shuffleArrayPopup(indices);
    return indices.slice(0, prefillCount);
}

function buildSourceItems(letters, syllables, mode, hasSyllables, prefilledIndices) {
    prefilledIndices = prefilledIndices || [];
    if (mode === 'letter' || !hasSyllables) {
        // Letter 模式下，排除已經被預填（prefill）到 target 區的字母
        var items = [];
        for (var i = 0; i < letters.length; i++) {
            if (prefilledIndices.indexOf(i) === -1) {
                items.push({
                    type: 'letter',
                    value: letters[i],
                    id: i
                });
            }
        }
        return shuffleArrayPopup(items);
    } else {
        // Syllable 模式且有 syllable
        return shuffleArrayPopup(syllables.map(function(s, i) {
            return {
                type: 'syllable',
                value: s,
                length: s.length,
                id: i
            };
        }));
    }
}
            
            function getSyllableGroup(slotIdx) {
                let start = 0;
                for (let s = 0; s < spellingState.syllables.length; s++) {
                    const len = spellingState.syllables[s].length;
                    if (slotIdx >= start && slotIdx < start + len) {
                        return { start: start, length: len, index: s };
                    }
                    start += len;
                }
                return null;
            }
            
            function initSpelling() {
                var words = window.allWordsData || [];
                if (words.length === 0) {
                    var container = document.getElementById('spellingContainer');
                    if (container) {
                        container.innerHTML = '<p style="text-align:center;padding:40px;color:#94a3b8;">No words available.</p>';
                    }
                    return;
                }
                spellingState.words = words;
                spellingState.totalCount = words.length;
                spellingState.stats = { total: 0, correct: 0 };
                // 只在第一次初始化時載入第 0 題
                if (!spellingState._initialized) {
                    spellingState._initialized = true;
                    loadSpelling(0);
                } else {
                    renderSpelling();
                }
            }
            
            function loadSpelling(index) {
    var w = spellingState.words[index];
    if (!w) {
        console.warn('loadSpelling: no word at index', index);
        return;
    }
    
    spellingState.currentIndex = index;
    
    var wordStr = (w.word || '').toString();
    var syllableStr = (w.syllable || '').toString();
    
    spellingState.syllables = splitWordToSyllables(wordStr, syllableStr);
    spellingState.letters = syllablesToLetters(spellingState.syllables);
    spellingState.hasSyllables = hasRealSyllables(wordStr, syllableStr);
    
    spellingState.targetSlots = spellingState.letters.map(function() { return null; });
    
    // 取得預填索引（依據 letters 總數與當前模式）
    var prefilledIndices = getPrefilledIndices(spellingState.letters.length, spellingState.sourceMode);
    for (var i = 0; i < prefilledIndices.length; i++) {
        var idx = prefilledIndices[i];
        spellingState.targetSlots[idx] = {
            type: 'letter',
            value: spellingState.letters[idx],
            id: idx,
            groupStart: idx,
            groupLength: 1
        };
    }
    
    spellingState.sourceItems = buildSourceItems(
        spellingState.letters, 
        spellingState.syllables, 
        spellingState.sourceMode,
        spellingState.hasSyllables,
        prefilledIndices
    );
    
    spellingState.isAnswered = false;
    spellingState.revealedWord = false;
    spellingState.lastCheckCorrect = null;
    spellingState.scored = false;
    renderSpelling();
}
            
            function switchSourceMode(mode) {
    if (spellingState.sourceMode === mode) return;
    
    spellingState.sourceMode = mode;
    spellingState.targetSlots = spellingState.letters.map(function() { return null; });
    
    // 切換模式時重新計算預填
    var prefilledIndices = getPrefilledIndices(spellingState.letters.length, mode);
    for (var i = 0; i < prefilledIndices.length; i++) {
        var idx = prefilledIndices[i];
        spellingState.targetSlots[idx] = {
            type: 'letter',
            value: spellingState.letters[idx],
            id: idx,
            groupStart: idx,
            groupLength: 1
        };
    }
    
    spellingState.isAnswered = false;
    spellingState.revealedWord = false;
    spellingState.lastCheckCorrect = null;
    spellingState.scored = false;
    spellingState.sourceItems = buildSourceItems(
        spellingState.letters,
        spellingState.syllables,
        mode,
        spellingState.hasSyllables,
        prefilledIndices
    );
    renderSpelling();
}
            
            function renderSpelling() {
    var container = document.getElementById('spellingContainer');
    if (!container) return;
    
    var w = spellingState.words[spellingState.currentIndex];
    if (!w) {
        container.innerHTML = '<p style="text-align:center;padding:40px;color:#94a3b8;">No words available.</p>';
        return;
    }
    
    var total = spellingState.totalCount;
    var current = spellingState.currentIndex + 1;
    var isFirst = (spellingState.currentIndex === 0);
    var isLast = (spellingState.currentIndex >= total - 1);
    
    // ===== Source 區塊 =====
    var sourceHtml = '';
    if (spellingState.sourceItems.length === 0) {
        sourceHtml = '<span style="color:#94a3b8; font-size:14px;">(All letters placed)</span>';
    } else {
        sourceHtml = spellingState.sourceItems.map(function(item, idx) {
            if (item.type === 'letter') {
                return '<span class="word-token source-token" data-source-id="' + item.id + '" data-type="letter">' + escapeHtml(item.value.toUpperCase()) + '</span>';
            } else {
                return '<span class="word-token source-token" data-source-id="' + item.id + '" data-type="syllable" data-length="' + item.length + '">' + escapeHtml(item.value.toUpperCase()) + '</span>';
            }
        }).join('');
    }
    
    // ===== Target 區塊 =====
    var targetHtml = '';
    var slotIdx = 0;
    for (var s = 0; s < spellingState.syllables.length; s++) {
        var syllable = spellingState.syllables[s];
        for (var c = 0; c < syllable.length; c++) {
            var filled = spellingState.targetSlots[slotIdx];
            if (filled) {
                targetHtml += '<span class="word-token target-token" ' +
                    'data-target-index="' + slotIdx + '" ' +
                    'data-group-start="' + filled.groupStart + '" ' +
                    'data-group-length="' + filled.groupLength + '">' + 
                    escapeHtml(filled.value.toUpperCase()) + '</span>';
            } else {
                targetHtml += '<span class="word-token target-token empty-slot" ' +
                    'data-target-index="' + slotIdx + '">?</span>';
            }
            slotIdx++;
        }
        if (spellingState.hasSyllables && s < spellingState.syllables.length - 1) {
            targetHtml += '<span class="separator">-</span>';
        }
    }
    
    var rateDisplay = spellingState.stats.total > 0 ? Math.round((spellingState.stats.correct / spellingState.stats.total) * 100) + '%' : '--%';
    
    var letterActive = spellingState.sourceMode === 'letter' ? ' active' : '';
    var syllableActive = spellingState.sourceMode === 'syllable' ? ' active' : '';
    
    // ===== builder-meaning 右側（答案 / Show Answer 按鈕） =====
    var rightSideHtml = '';
    if (spellingState.revealedWord) {
        rightSideHtml = '<span class="revealed-word">' + escapeHtml(w.word.toUpperCase()) + '</span>';
    } else if (spellingState.lastCheckCorrect === false) {
        rightSideHtml = '<button class="show-answer-btn" id="spellingShowAnswerBtn">🔍 Show Answer</button>';
    }
    
    container.innerHTML = 
        '<div class="spelling-builder">' +
            '<div class="builder-header">' +
                '<span class="progress-text">📌 Word ' + current + ' / ' + total + '</span>' +
                '<span class="score-text" id="spellingStats">📊 Answered: ' + spellingState.stats.total + ' | Correct: ' + spellingState.stats.correct + ' | Rate: ' + rateDisplay + '</span>' +
                '<div class="builder-controls">' +
                    '<button id="spellingListenBtn" title="Listen to word">🔊</button>' +
                '</div>' +
            '</div>' +
            '<div class="builder-meaning">' +
                '<span class="meaning-text">📖 ' + escapeHtml(w.meaning) + '</span>' +
                rightSideHtml +
            '</div>' +
            '<div class="source-mode-bar">' +
                '<button class="mode-btn' + letterActive + '" data-mode="letter">🔤 Letters</button>' +
                '<button class="mode-btn' + syllableActive + '" data-mode="syllable">🔡 Syllables</button>' +
            '</div>' +
            '<div class="source-area">' +
                '<div class="builder-dropzone source-dropzone" id="spellingSourceDropzone">' +
                    sourceHtml +
                '</div>' +
            '</div>' +
            '<div class="target-area">' +
                '<div class="builder-dropzone target-dropzone" id="spellingTargetDropzone">' +
                    targetHtml +
                '</div>' +
            '</div>' +
            '<div class="builder-actions">' +
                '<button class="btn-prev" id="spellingPrevBtn" ' + (isFirst ? 'disabled' : '') + '>Previous</button>' +
                '<button class="btn-shuffle" id="spellingShuffleBtn">Shuffle</button>' +
                '<button class="btn-check" id="spellingCheckBtn">Check Answer</button>' +
                '<button class="btn-next" id="spellingNextBtn" ' + (isLast ? 'disabled' : '') + '>Next</button>' +
            '</div>' +
            '<div class="builder-feedback" id="spellingFeedback">📝 Drag letters to the slots</div>' +
        '</div>';
    
    bindSpellingEvents();
}
            
            function bindSpellingEvents() {
    // ===== Listen =====
    var listenBtn = document.getElementById('spellingListenBtn');
    if (listenBtn) {
        listenBtn.onclick = function() {
            var w = spellingState.words[spellingState.currentIndex];
            if (w && w.word) {
                if (window.opener && window.opener.speakOnce) {
                    window.opener.speakOnce(w.word, null, 0.85);
                } else {
                    var utterance = new SpeechSynthesisUtterance(w.word);
                    utterance.lang = 'en-US';
                    utterance.rate = 0.85;
                    speechSynthesis.speak(utterance);
                }
            }
        };
    }
    
    // ===== Previous / Next =====
    var prevBtn = document.getElementById('spellingPrevBtn');
    if (prevBtn) {
        prevBtn.onclick = function() {
            if (spellingState.currentIndex > 0) {
                loadSpelling(spellingState.currentIndex - 1);
            }
        };
    }
    
    var nextBtn = document.getElementById('spellingNextBtn');
    if (nextBtn) {
        nextBtn.onclick = function() {
            if (spellingState.currentIndex < spellingState.totalCount - 1) {
                loadSpelling(spellingState.currentIndex + 1);
            }
        };
    }
    
    // ===== Shuffle =====
    var shuffleBtn = document.getElementById('spellingShuffleBtn');
    if (shuffleBtn) {
        shuffleBtn.onclick = function() {
            spellingState.sourceItems = buildSourceItems(
                spellingState.letters,
                spellingState.syllables,
                spellingState.sourceMode,
                spellingState.hasSyllables
            );
            spellingState.targetSlots = spellingState.letters.map(function() { return null; });
            spellingState.isAnswered = false;
            spellingState.revealedWord = false;
            spellingState.lastCheckCorrect = null;
            spellingState.scored = false;
            renderSpelling();
        };
    }
    
    // ===== Check Answer =====
    var checkBtn = document.getElementById('spellingCheckBtn');
    if (checkBtn) {
        checkBtn.onclick = function() {
            checkSpellingAnswer();
        };
    }
    
    // ===== Show Answer 按鈕 =====
    var showAnswerBtn = document.getElementById('spellingShowAnswerBtn');
    if (showAnswerBtn) {
        showAnswerBtn.onclick = function() {
            showSpellingAnswer();
        };
    }
    
    // ===== 模式切換 =====
    document.querySelectorAll('.spelling-builder .mode-btn').forEach(function(btn) {
        btn.onclick = function() {
            switchSourceMode(this.dataset.mode);
        };
    });
    
    // ===== 拖拉邏輯 =====
    bindSpellingDragEvents();
}
            
           function bindSpellingDragEvents() {
    var sourceDropzone = document.getElementById('spellingSourceDropzone');
    var targetDropzone = document.getElementById('spellingTargetDropzone');
    if (!sourceDropzone && !targetDropzone) return;
    
    var dragData = null;
    
    function getDragData(e) {
        // 已答對 → 鎖定
        if (spellingState.revealedWord && spellingState.lastCheckCorrect === true) {
            return null;
        }
        
        var token = e.target.closest('.word-token');
        if (!token) return null;
        
        var isSource = token.classList.contains('source-token');
        var isTarget = token.classList.contains('target-token');
        if (!isSource && !isTarget) return null;
        
        var index, type;
        if (isSource) {
            index = parseInt(token.dataset.sourceId);
            type = 'source';
        } else {
            if (token.classList.contains('empty-slot')) return null;
            index = parseInt(token.dataset.targetIndex);
            type = 'target';
        }
        if (isNaN(index)) return null;
        
        if (type === 'target' && !spellingState.targetSlots[index]) return null;
        
        var clientX = e.clientX || (e.touches && e.touches[0].clientX);
        var clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        return {
            type: type,
            index: index,
            element: token,
            startX: clientX,
            startY: clientY
        };
    }
    
    function onDragStart(e) {
        // 已答對 → 鎖定
        if (spellingState.revealedWord && spellingState.lastCheckCorrect === true) {
            return;
        }
        
        var data = getDragData(e);
        if (!data) return;
        dragData = data;
        var el = data.element;
        el.style.transition = 'none';
        el.style.zIndex = '1000';
        el.style.transform = 'translate(0, 0)';
        el.classList.add('dragging');
        if (e.type === 'mousedown') e.preventDefault();
    }
    
    function onDragMove(e) {
        if (!dragData) return;
        e.preventDefault();
        var clientX = e.clientX || (e.touches && e.touches[0].clientX);
        var clientY = e.clientY || (e.touches && e.touches[0].clientY);
        if (clientX === undefined) return;
        var dx = clientX - dragData.startX;
        var dy = clientY - dragData.startY;
        dragData.element.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
        
        document.querySelectorAll('.spelling-builder .word-token, .spelling-builder .empty-slot').forEach(function(t) { t.classList.remove('drag-over-me'); });
        
        var targetElement = null;
        var allTargets = document.querySelectorAll('.spelling-builder .source-token, .spelling-builder .target-token, .spelling-builder .empty-slot');
        allTargets.forEach(function(el) {
            if (el === dragData.element) return;
            var rect = el.getBoundingClientRect();
            var cx = rect.left + rect.width/2;
            var cy = rect.top + rect.height/2;
            var dist = Math.sqrt(Math.pow(clientX - cx, 2) + Math.pow(clientY - cy, 2));
            if (dist < 60) {
                targetElement = el;
            }
        });
        
        if (targetElement) {
            targetElement.classList.add('drag-over-me');
            dragData.targetElement = targetElement;
        } else {
            dragData.targetElement = null;
        }
    }
    
    function onDragEnd(e) {
        if (!dragData) return;
        var el = dragData.element;
        el.style.transition = 'all 0.2s';
        el.style.transform = 'translate(0, 0)';
        el.style.zIndex = '';
        el.classList.remove('dragging');
        document.querySelectorAll('.spelling-builder .word-token, .spelling-builder .empty-slot').forEach(function(t) { t.classList.remove('drag-over-me'); });
        
        var targetElement = dragData.targetElement;
        
        if (!targetElement) {
            dragData = null;
            renderSpelling();
            return;
        }
        
        var sourceType = dragData.type;
        var sourceIndex = dragData.index;
        
        var isTargetDropzone = targetElement.id === 'spellingTargetDropzone';
        var isSourceDropzone = targetElement.id === 'spellingSourceDropzone';
        var targetType = null;
        var targetIndex = null;
        
        if (isTargetDropzone) {
            targetType = 'target-zone';
        } else if (isSourceDropzone) {
            targetType = 'source-zone';
        } else if (targetElement.classList.contains('source-token')) {
            targetType = 'source';
            targetIndex = parseInt(targetElement.dataset.sourceId);
        } else if (targetElement.classList.contains('target-token')) {
            targetType = 'target';
            targetIndex = parseInt(targetElement.dataset.targetIndex);
        } else if (targetElement.classList.contains('empty-slot')) {
            targetType = 'target';
            targetIndex = parseInt(targetElement.dataset.targetIndex);
        }
        
        handleSpellingDrop(sourceType, sourceIndex, targetType, targetIndex);
        dragData = null;
    }
    
    if (window._spellingDragCleanup) {
        window._spellingDragCleanup();
    }
    
    sourceDropzone.addEventListener('mousedown', onDragStart);
    sourceDropzone.addEventListener('touchstart', onDragStart, { passive: true });
    targetDropzone.addEventListener('mousedown', onDragStart);
    targetDropzone.addEventListener('touchstart', onDragStart, { passive: true });
    
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd, { passive: true });
    
    window._spellingDragCleanup = function() {
        sourceDropzone.removeEventListener('mousedown', onDragStart);
        sourceDropzone.removeEventListener('touchstart', onDragStart);
        targetDropzone.removeEventListener('mousedown', onDragStart);
        targetDropzone.removeEventListener('touchstart', onDragStart);
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('touchend', onDragEnd);
    };
}
            
            function handleSpellingDrop(sourceType, sourceIndex, targetType, targetIndex) {
                // ===== 情境 1：拖到 Target 區塊的某個 slot =====
                if (targetType === 'target' || targetType === 'target-zone') {
                    // 決定目標 slot
                    var slotIdx = null;
                    if (targetType === 'target') {
                        slotIdx = targetIndex;
                    } else {
                        // 拖到 target zone 空白處 → 找第一個空 slot
                        for (var i = 0; i < spellingState.targetSlots.length; i++) {
                            if (spellingState.targetSlots[i] === null) {
                                slotIdx = i;
                                break;
                            }
                        }
                    }
                    
                    if (slotIdx === null) {
                        renderSpelling();
                        return;
                    }
                    
                    // 取得拖曳的塊
                    var draggedItem = null;
                    if (sourceType === 'source') {
                        var srcIdx = spellingState.sourceItems.findIndex(function(it) { return it.id === sourceIndex; });
                        if (srcIdx === -1) { renderSpelling(); return; }
                        draggedItem = spellingState.sourceItems[srcIdx];
                    } else {
                        // 從 target 拖來
                        var filled = spellingState.targetSlots[sourceIndex];
                        if (!filled) { renderSpelling(); return; }
                        draggedItem = {
                            type: filled.type,
                            value: filled.value,
                            id: filled.id,
                            length: filled.groupLength
                        };
                    }
                    
                    // 檢查是否能放入
                    if (draggedItem.type === 'letter') {
                        // Letter → 目標 slot 為空即可
                        if (spellingState.targetSlots[slotIdx] !== null) {
                            // 交換
                            var existing = spellingState.targetSlots[slotIdx];
                            // 先把現有的放回來源或交換
                            if (sourceType === 'source') {
                                // 把 target 的放回 sourceItems，把 source 的放入 target
                                var srcIdx2 = spellingState.sourceItems.findIndex(function(it) { return it.id === sourceIndex; });
                                if (srcIdx2 === -1) { renderSpelling(); return; }
                                spellingState.sourceItems[srcIdx2] = {
                                    type: existing.type,
                                    value: existing.value,
                                    id: existing.id,
                                    length: existing.groupLength
                                };
                                spellingState.targetSlots[slotIdx] = {
                                    type: 'letter',
                                    value: draggedItem.value,
                                    id: draggedItem.id,
                                    groupStart: slotIdx,
                                    groupLength: 1
                                };
                            } else {
                                // target → target 交換（僅 letter）
                                if (existing.type === 'letter') {
                                    var temp = spellingState.targetSlots[sourceIndex];
                                    spellingState.targetSlots[sourceIndex] = spellingState.targetSlots[slotIdx];
                                    spellingState.targetSlots[slotIdx] = temp;
                                }
                            }
                        } else {
                            // 空 slot → 直接放入
                            if (sourceType === 'source') {
                                var srcIdx3 = spellingState.sourceItems.findIndex(function(it) { return it.id === sourceIndex; });
                                if (srcIdx3 === -1) { renderSpelling(); return; }
                                spellingState.sourceItems.splice(srcIdx3, 1);
                            } else {
                                // target → target 移動（清空原本）
                                spellingState.targetSlots[sourceIndex] = null;
                            }
                            spellingState.targetSlots[slotIdx] = {
                                type: 'letter',
                                value: draggedItem.value,
                                id: draggedItem.id,
                                groupStart: slotIdx,
                                groupLength: 1
                            };
                        }
                    } else {
                        // Syllable 塊
                        var group = getSyllableGroup(slotIdx);
                        if (!group || group.length !== draggedItem.length) {
                            // 群組不符，不動作
                            renderSpelling();
                            return;
                        }
                        
                        // 檢查群組內所有 slot 是否為空（除了來源本身）
                        var canPlace = true;
                        for (var g = group.start; g < group.start + group.length; g++) {
                            if (g === sourceIndex && sourceType === 'target') continue;
                            if (spellingState.targetSlots[g] !== null) {
                                canPlace = false;
                                break;
                            }
                        }
                        
                        if (!canPlace) {
                            renderSpelling();
                            return;
                        }
                        
                        // 若來源是 target，先清空來源佔用的所有 slot
                        if (sourceType === 'target') {
                            var srcGroup = getSyllableGroup(sourceIndex);
                            if (srcGroup) {
                                for (var sg = srcGroup.start; sg < srcGroup.start + srcGroup.length; sg++) {
                                    spellingState.targetSlots[sg] = null;
                                }
                            }
                        } else {
                            // 從 source 移除
                            var srcIdx4 = spellingState.sourceItems.findIndex(function(it) { return it.id === sourceIndex; });
                            if (srcIdx4 === -1) { renderSpelling(); return; }
                            spellingState.sourceItems.splice(srcIdx4, 1);
                        }
                        
                        // 填入群組
                        var syllableStr = draggedItem.value;
                        for (var k = 0; k < group.length; k++) {
                            spellingState.targetSlots[group.start + k] = {
                                type: 'syllable',
                                value: syllableStr[k],
                                id: draggedItem.id,
                                groupStart: group.start,
                                groupLength: group.length
                            };
                        }
                    }
                    
                    renderSpelling();
                    return;
                }
                
                // ===== 情境 2：拖到 Source 區塊 =====
                if (targetType === 'source' || targetType === 'source-zone') {
                    // 把 target 的塊放回來源
                    if (sourceType === 'target') {
                        var srcGroup2 = getSyllableGroup(sourceIndex);
                        if (!srcGroup2) { renderSpelling(); return; }
                        
                        var filledBlock = spellingState.targetSlots[sourceIndex];
                        if (!filledBlock) { renderSpelling(); return; }
                        
                        // 取出整個塊
                        var blockValue = '';
                        for (var b = srcGroup2.start; b < srcGroup2.start + srcGroup2.length; b++) {
                            blockValue += spellingState.targetSlots[b].value;
                            spellingState.targetSlots[b] = null;
                        }
                        
                        // 加回來源
                        spellingState.sourceItems.push({
                            type: filledBlock.type,
                            value: blockValue,
                            id: filledBlock.id,
                            length: srcGroup2.length
                        });
                        
                        renderSpelling();
                        return;
                    }
                    
                    // source → source：不動作（或交換）
                    renderSpelling();
                    return;
                }
                
                renderSpelling();
            }
            
            function checkSpellingAnswer() {
    if (spellingState.targetSlots.some(function(s) { return s === null; })) {
        var fb = document.getElementById('spellingFeedback');
        if (fb) {
            fb.innerHTML = '⚠️ Please fill all slots before checking.';
            fb.style.color = '#f59e0b';
        }
        playBeep(400, 0.3);
        return;
    }
    
    var userLetters = spellingState.targetSlots.map(function(s) { return s.value.toLowerCase(); });
    var isCorrect = userLetters.every(function(l, i) { return l === spellingState.letters[i]; });
    
    spellingState.isAnswered = true;
    spellingState.lastCheckCorrect = isCorrect;
    if (isCorrect) {
        spellingState.revealedWord = true;
    }
    
    // 只計分一次
    if (!spellingState.scored) {
        spellingState.stats.total++;
        if (isCorrect) spellingState.stats.correct++;
        spellingState.scored = true;
    }
    
    // 反饋 + 音效
    var fb2 = document.getElementById('spellingFeedback');
    if (fb2) {
        fb2.innerHTML = isCorrect ? '✅ Correct! Well done!' : '❌ Incorrect. Try again!';
        fb2.style.color = isCorrect ? '#22c55e' : '#ef4444';
    }
    
    if (isCorrect) {
        playBeep(880, 0.2);
        setTimeout(function() { playBeep(1100, 0.15); }, 150);
    } else {
        playBeep(440, 0.4);
    }
    
    // 重新渲染（顯示單字或 Show Answer 按鈕）
    renderSpelling();
    
    // 因為 renderSpelling 重建了 DOM，反饋訊息會被重置
    // 所以在 render 之後重新設定反饋
    var fb3 = document.getElementById('spellingFeedback');
    if (fb3) {
        fb3.innerHTML = isCorrect ? '✅ Correct! Well done!' : '❌ Incorrect. Try again!';
        fb3.style.color = isCorrect ? '#22c55e' : '#ef4444';
    }
    
    // 更新統計（renderSpelling 已包含統計更新，但保險起見再更新一次）
    var statsEl = document.getElementById('spellingStats');
    if (statsEl) {
        var total = spellingState.stats.total;
        var correct = spellingState.stats.correct;
        var rate = total > 0 ? Math.round((correct / total) * 100) + '%' : '--%';
        statsEl.textContent = '📊 Answered: ' + total + ' | Correct: ' + correct + ' | Rate: ' + rate;
    }
}

function showSpellingAnswer() {
    spellingState.revealedWord = true;
    // lastCheckCorrect 保持不變（不算答對）
    // scored 保持不變（不影響統計）
    renderSpelling();
    
    // 重新設定反饋訊息（因為 renderSpelling 會重置）
    var fb = document.getElementById('spellingFeedback');
    if (fb) {
        fb.innerHTML = '🔍 Answer revealed';
        fb.style.color = '#3b82f6';
    }
}
            
            // ===== 綁定事件 =====
            document.getElementById('wordsPlayBtn').addEventListener('click', toggleWordsAutoPlayPopup);
            document.getElementById('wordsStopBtn').addEventListener('click', stopWordsAutoPlayPopup);
            document.getElementById('wordsModeSwitch').addEventListener('click', switchWordsPlayModePopup);
            
            // ===== 初始化 Quiz =====
            initQuizInPopup();

            // ===== Listen 單字按鈕事件 =====
            document.querySelectorAll('.listen-single-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const word = this.dataset.word;
                    const meaning = this.dataset.meaning;
                    
                    if (window.opener && typeof window.opener.playSingleWord === 'function') {
                        window.opener.playSingleWord(word, meaning);
                    } else if (window.parent && typeof window.parent.playSingleWord === 'function') {
                        window.parent.playSingleWord(word, meaning);
                    } else {
                        alert('Audio function not available. Please refresh the page.');
                    }
                });
            });
        </script>
    </body>
    </html>`;
    
    // 開啟彈窗
    const newWindow = window.open('', '_blank', 'width=900,height=750,scrollbars=yes');
    if (newWindow) {
        newWindow.playSingleWord = playSingleWord;
        newWindow.escapeHtml = escapeHtml;
        newWindow.getAvailableVoice = getAvailableVoice;
        newWindow.getCantoneseVoice = getCantoneseVoice;
        newWindow.toggleWordsAutoPlay = toggleWordsAutoPlay;
        newWindow.stopWordsAutoPlay = stopWordsAutoPlay;
        newWindow.switchWordsPlayMode = switchWordsPlayMode;
        newWindow.initQuizTab = initQuizTab;
        newWindow.speakOnce = speakOnce;
        newWindow.stopAllReading = stopAllReading;
        newWindow.quizData = quizData;
        newWindow.quizGenerated = quizGenerated;
        newWindow.currentQuestionIdx = currentQuestionIdx;
        newWindow.allWordsData = allWords;
        
        newWindow.document.write(allHtml);
        newWindow.document.close();
    } else {
        alert("Popup blocked. Please allow popups for this site.");
    }
}
