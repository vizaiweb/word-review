// [ ... 這裡保留你原本 script.js 頂部的所有代碼，直到最後一個 } ... ]

// ====================== 這是唯一在腳本底部新增的內容 ======================

function saveCurrentSettings() {
    const config = {
        level: document.getElementById('levelSelect').value,
        file: document.getElementById('fileSelect').value,
        daySelect: document.getElementById('daySelect').value,
        dayNum: document.getElementById('dayNum').value
    };
    localStorage.setItem('kidsEnglish_SavedConfig', JSON.stringify(config));
    alert("All current options have been saved.");
}

async function loadSavedSettings() {
    const savedData = localStorage.getItem('kidsEnglish_SavedConfig');
    if (!savedData) return;

    const config = JSON.parse(savedData);
    
    // 1. 恢復 Level
    if (config.level) {
        document.getElementById('levelSelect').value = config.level;
        currentLevel = config.level;
        
        // 觸發 Confirm 以獲取該 Level 的文件列表
        await loadFileListByLevel(config.level);

        // 2. 恢復 File
        if (config.file) {
            const fileSelect = document.getElementById('fileSelect');
            fileSelect.value = config.file;
            
            // 載入具體檔案數據
            await loadSelectedFile(config.file);

            // 3. 恢復 Day
            if (config.daySelect) {
                document.getElementById('daySelect').value = config.daySelect;
                // 這裡調用你原本 script.js 裡處理 Day 輸入框切換的邏輯
                const dayNum = document.getElementById('dayNum');
                if (config.daySelect === 'all') {
                    dayNum.value = '--';
                    dayNum.readOnly = true;
                } else {
                    dayNum.value = config.dayNum || '1';
                    dayNum.readOnly = false;
                    dayNum.type = 'number';
                }
                
                // 最後執行一次篩選，讓畫面更新成保存時的樣子
                filterByDay();
            }
        }
    }
}

// 修改初始化部分，綁定事件並在開啟時嘗試載入
document.addEventListener('DOMContentLoaded', () => {
    // [ 這裡是原本已有的內容... ]
    
    // 綁定 Save 按鈕事件
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveCurrentSettings);

    // 延遲一點點時間執行自動載入，確保 GitHub 的數據請求環境已準備好
    setTimeout(loadSavedSettings, 500);
});
