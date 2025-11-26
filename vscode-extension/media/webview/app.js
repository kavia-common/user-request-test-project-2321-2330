(function () {
  const vscode = acquireVsCodeApi();

  // Notify extension that the webview has loaded
  vscode.postMessage({ type: 'chat:loaded' });

  // Listen for messages from the extension (placeholder)
  window.addEventListener('message', (event) => {
    const message = event.data;
    console.log('KAVIA Chat webview received:', message);
    // TODO: Handle message types in later steps
  });

  const btn = document.getElementById('openDocs');
  if (btn) {
    btn.addEventListener('click', () => {
      vscode.postMessage({ type: 'chat:openSettings' });
    });
  }
})();
