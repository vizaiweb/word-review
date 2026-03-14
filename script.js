// ====================== Show All Words Function ======================
/**
 * Open a new window to display all words in the current list
 */
function showAllWords() {
  if (allWords.length === 0) return;

  // Create new window content
  let allWordsHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>All Words - ${removeFileExtension(currentFileName)}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          line-height: 1.8;
          background: #f0f4f8;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 25px;
          border-radius: 15px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        h1 {
          color: #ff9a56;
          text-align: center;
          margin-bottom: 20px;
          font-size: 22px;
        }
        .word-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .word-table th, .word-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }
        .word-table th {
          background: #f8fafc;
          color: #334155;
        }
        .close-btn {
          display: block;
          margin: 20px auto 0;
          padding: 10px 20px;
          background: #ff9a56;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
        }
        .close-btn:hover {
          background: #ff6b35;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>All Words - ${currentLevel} | ${removeFileExtension(currentFileName)}</h1>
        
        <table class="word-table">
          <tr>
            <th>Day</th>
            <th>English Word</th>
            <th>Chinese Meaning</th>
          </tr>
          ${allWords.map(word => `
            <tr>
              <td>${word.day}</td>
              <td><strong>${word.word.toUpperCase()}</strong></td>
              <td>${word.meaning}</td>
            </tr>
          `).join('')}
        </table>
        
        <button class="close-btn" onclick="window.close()">❌ Close Window</button>
      </div>
    </body>
    </html>
  `;

  // Open new window and write content
  const newWindow = window.open('', '_blank', 'width=900,height=700');
  newWindow.document.write(allWordsHtml);
  newWindow.document.close();
}

// ====================== Initialize Events ======================
document.addEventListener('DOMContentLoaded', () => {
  const showAllBtn = document.getElementById('showAllBtn');
  
  // Level selection
  document.getElementById("levelConfirm").addEventListener('click', () => {
    const level = document.getElementById("levelSelect").value;
    if (!level) {
      alert('Please select P1/P2!');
      return;
    }
    currentLevel = level;
    loadFileListByLevel(level);
    showAllBtn.disabled = true; // Disable show all button
  });

  // File selection
  document.getElementById("fileConfirm").addEventListener('click', () => {
    const file = document.getElementById("fileSelect").value;
    loadSelectedFile(file);
    showAllBtn.disabled = false; // Enable show all button after file load
  });

  // Day filter
  document.getElementById("filterBtn").addEventListener('click', filterByDay);

  // Show All Words button click
  showAllBtn.addEventListener('click', showAllWords);
});
