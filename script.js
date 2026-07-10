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
            
            .header { background: linear-gradient(135deg, #ff9a56, #ff6b35); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
            .header h2 { color: white; font-size: 20px; font-weight: 600; }
            .header p { color: rgba(255,255,255,0.8); font-size: 14px; }
            
            .tab-bar { display: flex; background: #f1f5f9; padding: 4px; border-radius: 12px; margin: 16px 20px 0 20px; gap: 4px; }
            .tab-btn { flex: 1; padding: 10px 16px; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.25s ease; background: transparent; color: #64748b; }
            .tab-btn:hover { color: #1e293b; background: rgba(255,255,255,0.5); }
            .tab-btn.active { background: linear-gradient(135deg, #ff9a56, #ff6b35); color: white; box-shadow: 0 2px 8px rgba(255,107,53,0.3); }
            
            .tab-panel { display: none; animation: fadeIn 0.3s ease; padding: 16px 20px 0 20px; }
            .tab-panel.active { display: block; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
            
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
            
            .quiz-stats { display: flex; justify-content: center; gap: 30px; background: #f8fafc; padding: 12px 20px; border-radius: 12px; margin: 0 0 12px 0; font-size: 15px; font-weight: 500; color: #1e293b; flex-wrap: wrap; }
            .quiz-stats .stat-number { color: #ff6b35; font-weight: 700; }
            
            .quiz-speed-control { display: flex; align-items: center; justify-content: center; gap: 12px; background: #f8fafc; padding: 8px 16px; border-radius: 12px; margin: 0 0 12px 0; flex-wrap: wrap; }
            .quiz-speed-control label { font-size: 14px; font-weight: 500; color: #1e293b; }
            .quiz-speed-control input[type="range"] { width: 160px; accent-color: #ff6b35; }
            .quiz-speed-control .speed-display { font-size: 14px; font-weight: 600; color: #ff6b35; min-width: 40px; }
            .quiz-speed-control .reset-btn { background: #e2e8f0; border: none; border-radius: 20px; padding: 4px 14px; font-size: 12px; font-weight: 600; color: #1e293b; cursor: pointer; }
            .quiz-speed-control .reset-btn:hover { background: #cbd5e1; }
            
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
            
            .words-table-wrapper { overflow-x: auto; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 16px; }
            .words-table { width: 100%; border-collapse: collapse; font-size: 14px; }
            .words-table thead th { background: #f8fafc; padding: 12px; text-align: left; font-weight: 600; color: #1e293b; border-bottom: 2px solid #e2e8f0; }
            .words-table thead th:first-child { width: 60px; text-align: center; }
            
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
                .quiz-speed-control input[type="range"] { width: 120px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>📖 ${currentLevel} - ${escapeHtml(fileNice)}</h2>
                <p>Total ${allWords.length} words</p>
            </div>
            
            <div class="tab-bar">
                <button class="tab-btn active" data-tab="words">📖 Words List</button>
                <button class="tab-btn" data-tab="quiz">✏️ Quiz</button>
            </div>
            
            <div class="tab-content">
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
                
                <div id="tab-quiz" class="tab-panel">
                    <div class="quiz-stats" id="quizStats">
                        <span>Total Questions: <span class="stat-number">${allWords.length}</span></span>
                        <span>Answered: <span class="stat-number">0</span></span>
                        <span>Correct Rate: <span class="stat-number">--%</span></span>
                    </div>
                    <div class="quiz-speed-control">
                        <label for="quizSpeedSlider">🔊 Speed:</label>
                        <input type="range" id="quizSpeedSlider" min="0.5" max="1.5" step="0.05" value="0.7">
                        <span class="speed-display" id="quizSpeedDisplay">0.7</span>
                        <button class="reset-btn" id="quizSpeedResetBtn">Reset</button>
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
            
            <div class="footer">
                <button class="close-btn" onclick="window.close()">Close</button>
            </div>
        </div>
        
        <script>
            window.allWordsData = ${JSON.stringify(allWords)};
            
            document.querySelectorAll('.tab-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
                    this.classList.add('active');
                    document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
                    document.getElementById('tab-' + this.dataset.tab).classList.add('active');
                    
                    if (this.dataset.tab === 'quiz') {
                        if (typeof initQuizInPopup === 'function') {
                            initQuizInPopup();
                        }
                    }
                });
            });
            
            // ===== 語速控制功能 =====
            (function initSpeedControl() {
                var slider = document.getElementById('quizSpeedSlider');
                var display = document.getElementById('quizSpeedDisplay');
                var resetBtn = document.getElementById('quizSpeedResetBtn');
                
                if (!slider || !display) return;
                
                var savedSpeed = localStorage.getItem('quizSpeechRate');
                if (savedSpeed !== null) {
                    var val = parseFloat(savedSpeed);
                    if (!isNaN(val) && val >= 0.5 && val <= 1.5) {
                        slider.value = val;
                        display.textContent = val.toFixed(1);
                    }
                }
                
                function updateSpeedDisplay() {
                    var val = parseFloat(slider.value);
                    display.textContent = val.toFixed(1);
                    localStorage.setItem('quizSpeechRate', val.toFixed(1));
                }
                
                slider.addEventListener('input', updateSpeedDisplay);
                
                if (resetBtn) {
                    resetBtn.addEventListener('click', function() {
                        slider.value = '0.7';
                        display.textContent = '0.7';
                        localStorage.setItem('quizSpeechRate', '0.7');
                    });
                }
                
                window.getQuizSpeed = function() {
                    return parseFloat(slider.value) || 0.7;
                };
            })();
            
            // ===== 彈窗內的 Quiz 功能 =====
            var quizDataPopup = [];
            var currentQuestionIdxPopup = 0;
            
            function shuffleArrayPopup(arr) {
                var shuffled = arr.slice();
                for (var i = shuffled.length - 1; i > 0; i--) {
                    var j = Math.floor(Math.random() * (i + 1));
                    var temp = shuffled[i];
                    shuffled[i] = shuffled[j];
                    shuffled[j] = temp;
                }
                return shuffled;
            }
            
            function getRandomWrongOptionsPopup(words, correctIndex, count) {
                var correctWord = words[correctIndex].word.toUpperCase();
                var candidates = [];
                for (var i = 0; i < words.length; i++) {
                    if (words[i].word.toUpperCase() !== correctWord) {
                        candidates.push({ word: words[i].word.toUpperCase(), idx: i });
                    }
                }
                var shuffled = shuffleArrayPopup(candidates);
                var result = [];
                for (var j = 0; j < count && j < shuffled.length; j++) {
                    result.push(shuffled[j].word);
                }
                while (result.length < count) {
                    result.push('---');
                }
                return result;
            }
            
            function generateQuizDataPopup(words) {
                if (!words || words.length === 0) return [];
                var data = [];
                for (var i = 0; i < words.length; i++) {
                    var correctWord = words[i].word.toUpperCase();
                    var explanation = words[i].englishExplanation || words[i].meaning || '';
                    var wrongOptions = getRandomWrongOptionsPopup(words, i, 2);
                    var options = [correctWord].concat(wrongOptions);
                    options = shuffleArrayPopup(options);
                    var correctIndex = options.indexOf(correctWord);
                    var correctLabel = String.fromCharCode(65 + correctIndex);
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
            
            function speakFullQuestionPopup(questionData) {
                var no = questionData.wordIndex + 1;
                var explanation = questionData.explanation || '';
                var optA = questionData.options[0] || '';
                var optB = questionData.options[1] || '';
                var optC = questionData.options[2] || '';
                
                var text = 'Question ' + no + '. ' + explanation + '. ';
                text += 'Option A: ' + optA + '. Option B: ' + optB + '. Option C: ' + optC + '.';
                
                var speed = (window.getQuizSpeed && window.getQuizSpeed()) || 0.7;
                
                if (window.opener && window.opener.speakOnce) {
                    window.opener.speakOnce(text, null, speed);
                } else {
                    var utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = 'en-US';
                    utterance.rate = speed;
                    utterance.pitch = 1.05;
                    utterance.volume = 1;
                    var voices = window.speechSynthesis.getVoices();
                    var voice = voices.find(function(v) { return v.name && v.name.includes('Samantha'); }) || 
                                voices.find(function(v) { return v.name && v.name.includes('Google US English'); }) ||
                                voices.find(function(v) { return v.lang && v.lang === 'en-US'; }) || 
                                voices[0];
                    if (voice) utterance.voice = voice;
                    window.speechSynthesis.speak(utterance);
                }
            }
            
            function renderQuizTablePopup() {
                var container = document.getElementById('quizBody');
                if (!container) return;
                if (!quizDataPopup || quizDataPopup.length === 0) {
                    container.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8;">No quiz data available.</td></tr>';
                    return;
                }
                
                var html = '';
                for (var i = 0; i < quizDataPopup.length; i++) {
                    var q = quizDataPopup[i];
                    var isCurrent = (i === currentQuestionIdxPopup);
                    var isAnswered = (q.userAnswer !== null);
                    var answerDisplay = q.userAnswer !== null ? q.userAnswer : 'Please Select';
                    
                    var resultDisplay = '';
                    if (q.userAnswer !== null) {
                        resultDisplay = q.userAnswer === q.correctLabel
                            ? '<span class="result-correct">✔</span>'
                            : '<span class="result-wrong">✘</span>';
                    }
                    
                    html += '<tr id="quiz_row_' + i + '" class="' + (isCurrent ? 'current-row' : '') + '" data-index="' + i + '">';
                    html += '<td class="col-no">' + (isCurrent ? '<span class="current-marker">▶</span>' : '') + (i + 1) + '</td>';
                    html += '<td class="col-explanation">' + escapeHtml(q.explanation) + '</td>';
                    
                    for (var optIdx = 0; optIdx < q.options.length; optIdx++) {
                        var opt = q.options[optIdx];
                        var label = String.fromCharCode(65 + optIdx);
                        var className = 'col-option';
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
                var total = quizDataPopup.length;
                var answered = 0, correct = 0;
                for (var i = 0; i < quizDataPopup.length; i++) {
                    var q = quizDataPopup[i];
                    if (q.userAnswer !== null) {
                        answered++;
                        if (q.userAnswer === q.correctLabel) correct++;
                    }
                }
                var rate = answered > 0 ? Math.round((correct / answered) * 100) : 0;
                var statsContainer = document.getElementById('quizStats');
                if (statsContainer) {
                    statsContainer.innerHTML =
                        '<span>Total Questions: <span class="stat-number">' + total + '</span></span>' +
                        '<span>Answered: <span class="stat-number">' + answered + '</span></span>' +
                        '<span>Correct Rate: <span class="stat-number">' + (answered > 0 ? rate + '%' : '--%') + '</span></span>';
                }
            }
            
            function updateQuizProgressPopup() {
                var progressEl = document.getElementById('quizProgress');
                if (progressEl && quizDataPopup.length > 0) {
                    progressEl.textContent = 'Progress: ' + (currentQuestionIdxPopup + 1) + ' / ' + quizDataPopup.length;
                }
            }
            
            function bindQuizEventsPopup() {
                document.querySelectorAll('#quizBody tr').forEach(function(row) {
                    row.addEventListener('click', function(e) {
                        if (e.target.closest('.col-option') || e.target.closest('.listen-btn')) return;
                        var index = parseInt(this.dataset.index);
                        if (!isNaN(index) && index !== currentQuestionIdxPopup) {
                            currentQuestionIdxPopup = index;
                            renderQuizTablePopup();
                        }
                    });
                });
                
                document.querySelectorAll('.col-option:not(.option-disabled)').forEach(function(cell) {
                    cell.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var index = parseInt(this.dataset.quizIndex);
                        var label = this.dataset.optionLabel;
                        if (!isNaN(index) && label) {
                            var q = quizDataPopup[index];
                            if (q && q.userAnswer === null) {
                                q.userAnswer = label;
                                q.isCorrect = (label === q.correctLabel);
                                renderQuizTablePopup();
                            }
                        }
                    });
                });
                
                document.querySelectorAll('.listen-btn').forEach(function(btn) {
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var index = parseInt(this.dataset.quizIndex);
                        if (!isNaN(index) && quizDataPopup[index]) {
                            var q = quizDataPopup[index];
                            speakFullQuestionPopup(q);
                        }
                    });
                });
            }
            
            function initQuizInPopup() {
                var words = window.allWordsData || [];
                if (words.length > 0) {
                    quizDataPopup = generateQuizDataPopup(words);
                    currentQuestionIdxPopup = 0;
                    renderQuizTablePopup();
                }
            }
            
            // ===== Words List 播放功能（彈窗內） =====
            var wordsAutoPlayStatePopup = {
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
                var step = 0;
                var repeatCount = 0;
                var isCancelled = false;
                
                function speakNext() {
                    if (isCancelled || (wordsAutoPlayStatePopup && (wordsAutoPlayStatePopup.isPaused || !wordsAutoPlayStatePopup.isPlaying))) {
                        if (onComplete) onComplete();
                        return;
                    }
                    
                    if (step === 0) {
                        var utterance = new SpeechSynthesisUtterance(word);
                        utterance.lang = 'en-US';
                        utterance.rate = 0.85;
                        utterance.pitch = 1.0;
                        utterance.volume = 1;
                        var voices = window.speechSynthesis.getVoices();
                        var voice = voices.find(function(v) { return v.name && v.name.includes('Google US English'); }) || voices.find(function(v) { return v.lang && v.lang === 'en-US'; }) || voices[0];
                        if (voice) utterance.voice = voice;
                        var completed = false;
                        utterance.onend = function() { if (completed) return; completed = true; repeatCount++; if (repeatCount < 3) { setTimeout(speakNext, 450); } else { step = 1; repeatCount = 0; setTimeout(speakNext, 450); } };
                        utterance.onerror = function() { if (completed) return; completed = true; step = 1; repeatCount = 0; setTimeout(speakNext, 450); };
                        try { window.speechSynthesis.speak(utterance); } catch(e) { step = 1; repeatCount = 0; setTimeout(speakNext, 450); }
                    } else if (step === 1) {
                        var utterance2 = new SpeechSynthesisUtterance(meaning);
                        utterance2.lang = 'yue';
                        utterance2.rate = 0.85;
                        utterance2.pitch = 1.0;
                        utterance2.volume = 1;
                        var voice2 = window.opener ? window.opener.getCantoneseVoice() : null;
                        if (voice2) utterance2.voice = voice2;
                        var completed2 = false;
                        utterance2.onend = function() { if (completed2) return; completed2 = true; setTimeout(function() { if (onComplete) onComplete(); }, 350); };
                        utterance2.onerror = function() { if (completed2) return; completed2 = true; setTimeout(function() { if (onComplete) onComplete(); }, 250); };
                        try { window.speechSynthesis.speak(utterance2); } catch(e) { if (onComplete) onComplete(); }
                    }
                }
                speakNext();
            }
            
            function playNextWordPopup() {
                if (!wordsAutoPlayStatePopup.isPlaying || wordsAutoPlayStatePopup.isPaused) return;
                
                var total = wordsAutoPlayStatePopup.totalCount;
                if (wordsAutoPlayStatePopup.playedIndices.length >= total) {
                    wordsAutoPlayStatePopup.isPlaying = false;
                    wordsAutoPlayStatePopup.isPaused = false;
                    if (wordsAutoPlayStatePopup.timeoutId) clearTimeout(wordsAutoPlayStatePopup.timeoutId);
                    var playBtn = document.getElementById('wordsPlayBtn');
                    var stopBtn = document.getElementById('wordsStopBtn');
                    var modeSwitch = document.getElementById('wordsModeSwitch');
                    if (playBtn) { playBtn.textContent = '▶️ Play All'; playBtn.disabled = false; playBtn.style.background = '#22c55e'; }
                    if (stopBtn) stopBtn.disabled = true;
                    if (modeSwitch) modeSwitch.disabled = false;
                    return;
                }
                
                var nextIndex;
                if (wordsAutoPlayStatePopup.mode === 'sequential') {
                    nextIndex = wordsAutoPlayStatePopup.playedIndices.length;
                } else {
                    if (wordsAutoPlayStatePopup.remainingIndices.length === 0) {
                        wordsAutoPlayStatePopup.remainingIndices = [];
                        for (var i = 0; i < total; i++) {
                            wordsAutoPlayStatePopup.remainingIndices.push(i);
                        }
                    }
                    var randomPos = Math.floor(Math.random() * wordsAutoPlayStatePopup.remainingIndices.length);
                    nextIndex = wordsAutoPlayStatePopup.remainingIndices[randomPos];
                    wordsAutoPlayStatePopup.remainingIndices.splice(randomPos, 1);
                }
                
                var wordData = window.allWordsData[nextIndex];
                var progressSpan = document.getElementById('wordsProgress');
                if (progressSpan) progressSpan.textContent = (wordsAutoPlayStatePopup.playedIndices.length + 1) + ' / ' + total;
                
                speakWordWithEnglishAndCantonesePopup(wordData.word, wordData.meaning, function() {
                    wordsAutoPlayStatePopup.playedIndices.push(nextIndex);
                    if (progressSpan) progressSpan.textContent = wordsAutoPlayStatePopup.playedIndices.length + ' / ' + total;
                    wordsAutoPlayStatePopup.timeoutId = setTimeout(function() { playNextWordPopup(); }, 500);
                });
            }
            
            function toggleWordsAutoPlayPopup() {
                var playBtn = document.getElementById('wordsPlayBtn');
                var stopBtn = document.getElementById('wordsStopBtn');
                var modeSwitch = document.getElementById('wordsModeSwitch');
                
                if (!wordsAutoPlayStatePopup.isPlaying && !wordsAutoPlayStatePopup.isPaused) {
                    wordsAutoPlayStatePopup.isPlaying = true;
                    wordsAutoPlayStatePopup.isPaused = false;
                    wordsAutoPlayStatePopup.playedIndices = [];
                    wordsAutoPlayStatePopup.remainingIndices = [];
                    wordsAutoPlayStatePopup.totalCount = window.allWordsData.length;
                    if (wordsAutoPlayStatePopup.mode === 'random') {
                        for (var i = 0; i < window.allWordsData.length; i++) {
                            wordsAutoPlayStatePopup.remainingIndices.push(i);
                        }
                    }
                    if (playBtn) { playBtn.textContent = '⏸️ Pause'; playBtn.style.background = '#f59e0b'; }
                    if (stopBtn) stopBtn.disabled = false;
                    if (modeSwitch) modeSwitch.disabled = true;
                    var progressSpan = document.getElementById('wordsProgress');
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
                try { window.speechSynthesis.cancel(); } catch(e) {}
                if (wordsAutoPlayStatePopup.timeoutId) { clearTimeout(wordsAutoPlayStatePopup.timeoutId); wordsAutoPlayStatePopup.timeoutId = null; }
                wordsAutoPlayStatePopup.isPlaying = false;
                wordsAutoPlayStatePopup.isPaused = false;
                wordsAutoPlayStatePopup.playedIndices = [];
                wordsAutoPlayStatePopup.remainingIndices = [];
                var playBtn = document.getElementById('wordsPlayBtn');
                var stopBtn = document.getElementById('wordsStopBtn');
                var modeSwitch = document.getElementById('wordsModeSwitch');
                if (playBtn) { playBtn.textContent = '▶️ Play All'; playBtn.disabled = false; playBtn.style.background = '#22c55e'; }
                if (stopBtn) stopBtn.disabled = true;
                if (modeSwitch) modeSwitch.disabled = false;
                var progressSpan = document.getElementById('wordsProgress');
                if (progressSpan) progressSpan.textContent = '0 / ' + window.allWordsData.length;
            }
            
            function switchWordsPlayModePopup() {
                var modeSwitch = document.getElementById('wordsModeSwitch');
                var newMode = wordsAutoPlayStatePopup.mode === 'sequential' ? 'random' : 'sequential';
                
                if (wordsAutoPlayStatePopup.isPlaying || wordsAutoPlayStatePopup.isPaused) {
                    if (wordsAutoPlayStatePopup.timeoutId) { clearTimeout(wordsAutoPlayStatePopup.timeoutId); wordsAutoPlayStatePopup.timeoutId = null; }
                    wordsAutoPlayStatePopup.isPlaying = false;
                    wordsAutoPlayStatePopup.isPaused = false;
                    var playBtn = document.getElementById('wordsPlayBtn');
                    var stopBtn = document.getElementById('wordsStopBtn');
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
                var progressSpan = document.getElementById('wordsProgress');
                if (progressSpan) progressSpan.textContent = '0 / ' + window.allWordsData.length;
            }
            
            document.getElementById('wordsPlayBtn').addEventListener('click', toggleWordsAutoPlayPopup);
            document.getElementById('wordsStopBtn').addEventListener('click', stopWordsAutoPlayPopup);
            document.getElementById('wordsModeSwitch').addEventListener('click', switchWordsPlayModePopup);
            
            initQuizInPopup();
        </script>
    </body>
    </html>`;
    
    const newWindow = window.open('', '_blank', 'width=900,height=750,scrollbars=yes');
    if (newWindow) {
        newWindow.document.write(allHtml);
        newWindow.document.close();
        newWindow.opener = window;
        newWindow.getAvailableVoice = getAvailableVoice;
        newWindow.getCantoneseVoice = getCantoneseVoice;
        newWindow.escapeHtml = escapeHtml;
        newWindow.speakOnce = speakOnce;
    } else {
        alert("Popup blocked. Please allow popups for this site.");
    }
}
