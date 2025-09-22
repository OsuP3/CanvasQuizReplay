// handle toolbar click: inject script then open replay page
browser.browserAction.onClicked.addListener((tab) => {
    browser.tabs.executeScript(tab.id, { file: 'CanvasQuizReplay.js' })
        .then(() => {
            console.log('CanvasQuizReplay.js injected');
            // open replay page after injection
            return browser.tabs.create({ url: browser.runtime.getURL('QuizReplay.html') });
        })
        .catch((error) => {
            console.error('Error injecting script or opening page:', error);
        });
});

// receive quiz data from content script and store it in extension storage
browser.runtime.onMessage.addListener((message, sender) => {
    if (message && message.type === 'quizData') {
        console.log('background received quizData, storing to browser.storage.local');
        return browser.storage.local.set({ quizData: message.data })
            .then(() => {
                console.log('quizData saved to browser.storage.local');
            })
            .catch(err => {
                console.error('failed to save quizData', err);
            });
    }
});