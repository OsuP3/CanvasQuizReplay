console.log("QuizReplay Loaded")

function collectQuiz() {
    try {
        const quiz_questions = Array.from(document.querySelectorAll('[aria-label="Question"]'));
        const quiz_data = quiz_questions.map((question, index) => {
            // question text
            // preserve HTML (images, MathJax SVGs, inline math) so replay can render them identically
            const qText = question.querySelector('.question_text.user_content.enhanced')?.innerHTML.trim()
                || question.querySelector('.question_text')?.innerHTML.trim()
                 || `Question ${index+1}`;

            // detect question type from hidden meta or class names
            const qTypeNode = question.querySelector('.question_type');
            let qType = qTypeNode?.innerText?.trim() || '';
            if (!qType) {
                const cls = Array.from(question.classList || []).join(' ');
                if (cls.includes('numerical_question')) qType = 'numerical_question';
                else if (cls.includes('true_false_question')) qType = 'true_false_question';
                else if (cls.includes('multiple_choice_question')) qType = 'multiple_choice_question';
                else qType = 'unknown';
            }

            // collect answer elements
            const answerEls = Array.from(question.querySelectorAll('.answer'));
            const answers = answerEls.map(aEl => {
                // preserve answer HTML when available
                const text = aEl.querySelector('.answer_text')?.innerHTML?.trim()
                    || aEl.querySelector('input[name="answer_text"]')?.value?.trim()
                    || aEl.innerHTML?.trim() || '';
                // correctness markers in Canvas: "correct_answer" or "correct" class, sometimes "selected_answer correct_answer"
                const isCorrect = /\b(correct_answer|correct)\b/.test(aEl.className || '');
                // weight may exist
                const weight = aEl.querySelector('.answer_weight')?.innerText || null;
                return { text, isCorrect, weight };
            });

            // numeric/text expected answers (numerical_exact_answer etc.)
            let expected = null;
            let tolerance = null;
            const numExact = question.querySelector('.numerical_exact_answer .answer_exact')?.innerText;
            const numMargin = question.querySelector('.numerical_exact_answer .answer_error_margin')?.innerText
                || question.querySelector('.numerical_exact_answer .answer_tolerance')?.innerText;
            const numEquation = question.querySelector('.numerical_range_answer .answer_equation')?.innerText;
            if (numExact) {
                expected = numExact.trim();
                if (numMargin) {
                    const parsed = parseFloat(numMargin);
                    if (!isNaN(parsed)) tolerance = parsed;
                }
            } else if (numEquation) {
                expected = numEquation.trim();
            } else {
                // also check for short_answer field value inside hidden short_answer block
                const shortVal = question.querySelector('.answer_type.short_answer input[name="answer_text"]')?.value;
                if (shortVal) expected = shortVal.trim();
            }

            // determine if multi-select: more than one correct marker among answers OR a DOM hint
            const correctCount = answers.filter(a => a.isCorrect).length;
            const multiple = correctCount > 1 || /\bmultiple_answers_question\b/.test(question.className || '');

            // normalize: if no answer elements but expected exists, treat as input/numerical
            let finalType = qType;
            if ((answers.length === 0 || answers.every(a => !a.text)) && expected) {
                finalType = qType.includes('numerical') ? 'numerical' : 'text';
            } else if (qType === 'true_false_question') {
                finalType = 'true_false';
            } else if (qType.includes('numerical')) {
                finalType = 'numerical';
            } else {
                finalType = 'multiple_choice';
            }

            return {
                question: qText,
                rawType: qType,
                type: finalType,
                multiple,             // allow multiple selection if true
                answers,              // array of {text, isCorrect, weight}
                expected,             // for numerical/text when present
                tolerance             // numeric tolerance if available
            };
        });

        console.log('collected quiz_data', quiz_data);

        // send data to background for extension storage (accessible from extension pages)
        if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
            browser.runtime.sendMessage({ type: 'quizData', data: quiz_data })
                .then(() => console.log('quiz data sent to background'))
                .catch((err) => console.error('error sending quiz data', err));
        } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'quizData', data: quiz_data }, function() {
                if (chrome.runtime.lastError) console.error('error sending quiz data', chrome.runtime.lastError);
                else console.log('quiz data sent to background (chrome API)');
            });
        } else {
            // fallback: store on page (not readable from extension pages)
            localStorage.setItem('quizData', JSON.stringify(quiz_data));
            console.warn('Stored quizData on page localStorage as fallback (extension pages cannot read this).');
        }

        return quiz_data;
    } catch (e) {
        console.error('collectQuiz error', e);
        return null;
    }
}

// call it when injected
collectQuiz();

