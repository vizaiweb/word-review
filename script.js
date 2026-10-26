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
            <tr id="word_row_${i}" style="border-bottom: 1px solid #e2e8f0; transition: background-color 0.2s;">
                <td style="padding: 10px 12px; text-align: center; width: 60px;">${w.day}</td>
                <td style="padding: 10px 12px; font-weight: bold; color: #dc2626;">${escapeHtml(w.word.toUpperCase())}</td>
                <td style="padding: 10px 12px; color: #334155;">${escapeHtml(w.meaning)}</td>
                <td style="padding: 10px 12px; text-align: center; width: 60px;">
                    <button class="listen-single-btn" data-word="${escapeHtml(w.word)}" data-meaning="${escapeHtml(w.meaning)}" style="background: none; border: none; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px;">🔊</button>
                </td>
            </tr>
        `;
    }
    
    // ===== 生成彈窗完整 HTML（三分頁） =====
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
            
            /* Common Table */
            .words-table-wrapper { overflow-x: auto; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 16px; }
            .words-table { width: 100%; border-collapse: collapse; font-size: 14px; }
            .words-table thead th { background: #f8fafc; padding: 12px; text-align: left; font-weight: 600; color: #1e293b; border-bottom: 2px solid #e2e8f0; }
            .words-table thead th:first-child { width: 60px; text-align: center; }
            
            /* Footer */
            .footer { padding: 16px 20px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0; margin-top: 16px; }
            .close-btn { background: #ff6b35; color: white; border: none; border-radius: 40px; padding: 8px 24px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
            .close-btn:hover { opacity: 0.85; }
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
                    <div class="quiz-stats" id="quizStats"></div>
                    <div style="text-align: center; margin-bottom: 16px;">
                        <button id="quizShuffleToggleBtn" style="background: #f59e0b; color: white; border: none; border-radius: 40px; padding: 6px 20px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;">🔀 Shuffle Questions</button>
                    </div>
                    <div class="quiz-table-wrapper">
                        <table class="quiz-table">
                            <tbody id="quizBody"></tbody>
                        </table>
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
            // ===== 接收父視窗傳遞過來的資料 =====
            window.allWordsData = ${JSON.stringify(allWords)};
            
            // ===== 語音與工具函數包裝 =====
            function getAvailableVoice() {
                const voices = window.speechSynthesis.getVoices();
                if (!voices || voices.length === 0) return null;
                return voices.find(v => v.name && v.name.includes('Google US English')) ||
                       voices.find(v => v.lang && v.lang === 'en-US') || voices[0];
            }

            function getCantoneseVoice() {
                const voices = window.speechSynthesis.getVoices();
                if (!voices || voices.length === 0) return null;
                return voices.find(v => v.name && v.name === 'Sin-Ji') ||
                       voices.find(v => v.lang === 'yue' || v.lang === 'zh-HK') || voices[0];
            }

            // ===== 彈窗內 Words List 高亮控制 =====
            function highlightWordRowPopup(index) {
                const doc = document;
                const total = window.allWordsData.length;
                for (let i = 0; i < total; i++) {
                    const row = doc.getElementById('word_row_' + i);
                    if (row) {
                        if (i === index) {
                            row.style.backgroundColor = '#fff3cd';
                            row.style.fontWeight = 'bold';
                        } else {
                            row.style.backgroundColor = '';
                            row.style.fontWeight = 'normal';
                        }
                    }
                }
            }

            // ===== 彈窗內單字朗讀（英文3次 + 粵語1次） =====
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
                        utterance.onend = () => { 
                            if (completed) return; 
                            completed = true; 
                            repeatCount++; 
                            if (repeatCount < 3) { 
                                setTimeout(speakNext, 450); 
                            } else { 
                                step = 1; 
                                repeatCount = 0; 
                                setTimeout(speakNext, 450); 
                            } 
                        };
                        utterance.onerror = () => { 
                            if (completed) return; 
                            completed = true; 
                            step = 1; 
                            repeatCount = 0; 
                            setTimeout(speakNext, 450); 
                        };
                        try { window.speechSynthesis.speak(utterance); } catch(e) { step = 1; repeatCount = 0; setTimeout(speakNext, 450); }
                    } else if (step === 1) {
                        const utterance = new SpeechSynthesisUtterance(meaning);
                        utterance.lang = 'yue';
                        utterance.rate = 0.75;
                        utterance.pitch = 1.0;
                        utterance.volume = 1;
                        const voice = getCantoneseVoice();
                        if (voice) utterance.voice = voice;
                        
                        let completed = false;
                        utterance.onend = () => { 
                            if (completed) return; 
                            completed = true; 
                            setTimeout(() => { if (onComplete) onComplete(); }, 350); 
                        };
                        utterance.onerror = () => { 
                            if (completed) return; 
                            completed = true; 
                            setTimeout(() => { if (onComplete) onComplete(); }, 250); 
                        };
                        try { window.speechSynthesis.speak(utterance); } catch(e) { if (onComplete) onComplete(); }
                    }
                }
                speakNext();
            }

            // ===== 自動播放狀態與核心迴圈 =====
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

            function playNextWordPopup() {
                if (!wordsAutoPlayStatePopup.isPlaying || wordsAutoPlayStatePopup.isPaused) return;
                
                const total = wordsAutoPlayStatePopup.totalCount;
                if (wordsAutoPlayStatePopup.playedIndices.length >= total) {
                    highlightWordRowPopup(-1);
                    stopWordsAutoPlayPopup();
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
                
                wordsAutoPlayStatePopup.currentIndex = nextIndex;
                
                // 執行當前行高亮
                highlightWordRowPopup(nextIndex);
                
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
                if (wordsAutoPlayStatePopup.timeoutId) { 
                    clearTimeout(wordsAutoPlayStatePopup.timeoutId); 
                    wordsAutoPlayStatePopup.timeoutId = null; 
                }
                wordsAutoPlayStatePopup.isPlaying = false;
                wordsAutoPlayStatePopup.isPaused = false;
                wordsAutoPlayStatePopup.playedIndices = [];
                wordsAutoPlayStatePopup.remainingIndices = [];
                
                highlightWordRowPopup(-1);
                
                const playBtn = document.getElementById('wordsPlayBtn');
                const stopBtn = document.getElementById('wordsStopBtn');
                const modeSwitch = document.getElementById('wordsModeSwitch');
                if (playBtn) { 
                    playBtn.textContent = '▶️ Play All'; 
                    playBtn.disabled = false; 
                    playBtn.style.background = '#22c55e'; 
                }
                if (stopBtn) stopBtn.disabled = true;
                if (modeSwitch) modeSwitch.disabled = false;
                const progressSpan = document.getElementById('wordsProgress');
                if (progressSpan) {
                    progressSpan.textContent = '0 / ' + window.allWordsData.length;
                }
            }

            function switchWordsPlayModePopup() {
                const modeSwitch = document.getElementById('wordsModeSwitch');
                wordsAutoPlayStatePopup.mode = wordsAutoPlayStatePopup.mode === 'sequential' ? 'random' : 'sequential';
                stopWordsAutoPlayPopup();
                if (modeSwitch) {
                    modeSwitch.textContent = wordsAutoPlayStatePopup.mode === 'sequential' ? 'Sequential ○──● Random' : 'Sequential ●──○ Random';
                }
            }

            // ===== 綁定控制按鈕事件 =====
            document.getElementById('wordsPlayBtn').addEventListener('click', toggleWordsAutoPlayPopup);
            document.getElementById('wordsStopBtn').addEventListener('click', stopWordsAutoPlayPopup);
            document.getElementById('wordsModeSwitch').addEventListener('click', switchWordsPlayModePopup);

            // ===== 頁面切換控制 =====
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                    document.getElementById('tab-' + this.dataset.tab).classList.add('active');
                });
            });

            // ===== 單一單字朗讀按鈕事件 =====
            document.querySelectorAll('.listen-single-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const word = this.dataset.word;
                    const meaning = this.dataset.meaning;
                    if (window.opener && typeof window.opener.playSingleWord === 'function') {
                        window.opener.playSingleWord(word, meaning);
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
        newWindow.allWordsData = allWords;
        
        newWindow.document.write(allHtml);
        newWindow.document.close();
    } else {
        alert("Popup blocked. Please allow popups for this site.");
    }
}
