// ====================== 模式切换 ======================
function toggleMode(mode) {
    const previousMode = currentMode;
    currentMode = mode;
    const fileRow = document.getElementById('fileRow');
    const externalRow = document.getElementById('externalUrlRow');
    const levelRow = document.getElementById('levelRow');
    const toggleBtn = document.getElementById('modeToggleBtn');
    const dayRow = document.getElementById('dayRow');
    
    if (mode === "local") {
        fileRow.style.display = 'flex';
        externalRow.style.display = 'none';
        levelRow.classList.remove('hidden-level');
        toggleBtn.textContent = "📁 Built-in DB";
        toggleBtn.classList.add('active');
        
        // 清空当前显示的句子和单词数据
        allWords = [];
        filteredWords = [];
        allSentences = [];
        document.getElementById("wordContent").innerHTML = '<p style="color:#64748b;">✨ 切换到 Local 模式，请选择等级和文件 ✨</p>';
        document.getElementById("sentenceArea").style.display = 'none';
        document.getElementById("showAllBtn").style.display = 'none';
        document.getElementById("dayRow").style.display = 'none';
        document.getElementById("infoTipContainer").innerHTML = '';
        
    } else {
        fileRow.style.display = 'none';
        externalRow.style.display = 'flex';
        levelRow.classList.add('hidden-level');
        toggleBtn.textContent = "🌐 External Link";
        toggleBtn.classList.remove('active');
        
        // 清空当前显示的句子和单词数据
        allWords = [];
        filteredWords = [];
        allSentences = [];
        document.getElementById("wordContent").innerHTML = '<p style="color:#64748b;">🔗 切换到 External 模式，请输入 URL 并点击 Load 🔗</p>';
        document.getElementById("sentenceArea").style.display = 'none';
        document.getElementById("showAllBtn").style.display = 'none';
        document.getElementById("dayRow").style.display = 'none';
        document.getElementById("infoTipContainer").innerHTML = '';
    }
    
    saveCurrentState();
    
    // ========== 切换模式后，加载该模式上次保存的状态 ==========
    const savedState = loadSavedState();
    console.log(`🔄 切换到 ${mode} 模式，尝试恢复该模式的上次状态...`);
    
    if (mode === 'local' && savedState.mode === 'local' && savedState.level && savedState.fileName) {
        console.log('📀 发现 Local 模式的保存状态，正在恢复...');
        setTimeout(async () => {
            const levelSelect = document.getElementById('levelSelect');
            if (levelSelect) {
                levelSelect.value = savedState.level;
            }
            currentLevel = savedState.level;
            
            await loadFileListByLevel(savedState.level);
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const fileSelect = document.getElementById('fileSelect');
            if (fileSelect && savedState.fileName) {
                const fileExists = Array.from(fileSelect.options).some(opt => opt.value === savedState.fileName);
                if (fileExists) {
                    fileSelect.value = savedState.fileName;
                    await loadSelectedFile(savedState.fileName);
                    await new Promise(resolve => setTimeout(resolve, 800));
                    
                    const daySelect = document.getElementById('daySelect');
                    const dayNum = document.getElementById('dayNum');
                    
                    if (daySelect && dayNum && savedState.dayMode === 'custom') {
                        daySelect.value = savedState.dayMode;
                        const changeEvent = new Event('change');
                        daySelect.dispatchEvent(changeEvent);
                        await new Promise(resolve => setTimeout(resolve, 100));
                        dayNum.value = savedState.dayNumber;
                        filterByDay();
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                    
                    if (filteredWords.length > 0 && savedState.wordIndex < filteredWords.length) {
                        currentWordIdx = savedState.wordIndex;
                        showWord();
                        console.log(`✅ 恢复 Local 模式单词位置: #${currentWordIdx + 1}`);
                    }
                    
                    if (allSentences.length > 0 && savedState.sentenceIndex < allSentences.length) {
                        currentSentenceIdx = savedState.sentenceIndex;
                        updateSentenceUI();
                        console.log(`✅ 恢复 Local 模式句子位置: #${currentSentenceIdx + 1}`);
                    }
                } else {
                    console.log('⚠️ 保存的文件不存在:', savedState.fileName);
                }
            }
        }, 200);
        
    } else if (mode === 'external' && savedState.mode === 'external' && savedState.externalUrl) {
        console.log('📀 发现 External 模式的保存状态，正在恢复...');
        
        const urlInput = document.getElementById('externalUrlInput');
        if (urlInput) {
            urlInput.value = savedState.externalUrl;
            console.log('✅ 已填入 URL:', savedState.externalUrl);
        }
        
        setTimeout(async () => {
            await loadFromExternalUrl(savedState.externalUrl);
            await new Promise(resolve => setTimeout(resolve, 800));
            
            const daySelect = document.getElementById('daySelect');
            const dayNum = document.getElementById('dayNum');
            
            if (daySelect && dayNum && savedState.dayMode === 'custom') {
                daySelect.value = savedState.dayMode;
                const changeEvent = new Event('change');
                daySelect.dispatchEvent(changeEvent);
                await new Promise(resolve => setTimeout(resolve, 100));
                dayNum.value = savedState.dayNumber;
                filterByDay();
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            if (filteredWords.length > 0 && savedState.wordIndex < filteredWords.length) {
                currentWordIdx = savedState.wordIndex;
                showWord();
                console.log(`✅ 恢复 External 模式单词位置: #${currentWordIdx + 1}`);
            }
            
            if (allSentences.length > 0 && savedState.sentenceIndex < allSentences.length) {
                currentSentenceIdx = savedState.sentenceIndex;
                updateSentenceUI();
                console.log(`✅ 恢复 External 模式句子位置: #${currentSentenceIdx + 1}`);
            }
            
        }, 200);
    } else {
        console.log(`ℹ️ 没有找到 ${mode} 模式的保存状态`);
    }
}
