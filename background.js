browser.browserAction.onClicked.addListener((tab) => {
    // Inject the content script into the active tab
    browser.tabs.executeScript(tab.id, { file: 'CanvasQuizReplay.js' })
        .then(() => {
            console.log('CanvasQuizReplay.js executed in the active tab.');
        })
        .catch((error) => {
            console.error('Error injecting script:', error);
        });

    browser.tabs.create({ url: browser.runtime.getURL('QuizReplay.html') });
});