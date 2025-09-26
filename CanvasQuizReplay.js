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
                else if (cls.includes('essay_question')) qType = 'essay_question';
                else if (cls.includes('short_answer_question')) qType = 'short_answer_question';
                else qType = 'unknown';
            }

            // collect answer elements
            const answerEls = Array.from(question.querySelectorAll('.answer'));
            const answers = answerEls.map(aEl => {
                // extract answer HTML and plain text. prefer .answer_html (Canvas stores richer markup there)
                const answerHtml = aEl.querySelector('.answer_html')?.innerHTML?.trim() || null;
                const answerTextNode = aEl.querySelector('.answer_text');
                const answerText = answerTextNode ? (answerTextNode.innerText || answerTextNode.textContent || '').trim() :
                    (aEl.querySelector('input[name="answer_text"]')?.value?.trim() || (aEl.innerText || '').trim());
                // correctness markers in Canvas: "correct_answer" or "correct" class, sometimes "selected_answer correct_answer"
                const isCorrect = /\b(correct_answer|correct)\b/.test(aEl.className || '');
                // weight may exist
                const weight = aEl.querySelector('.answer_weight')?.innerText || null;
                return { text: answerText || '', html: answerHtml, isCorrect, weight };
            });

            // numeric/text expected answers (numerical_exact_answer etc.)
            let expected = null;
            let expectedHtml = null;
            let tolerance = null;
            let expectedRange = null; // {start, end} for range answers

            // Prefer explicit short-answer inputs when this is a short_answer question or when
            // a visible short-answer value exists. Some Canvas markup includes hidden numerical_* spans
            // (often with 0) even on short-answer questions; prefer the human-readable short answer
            // (e.g. "O(1)") when present so numeric '0' doesn't override it.
            let shortCandidate = null;
            try {
                // visible question input (e.g. class question_input) or named answer_text inputs
                const qInput = question.querySelector('.question_input, input[name="answer_text"], .answer_type.short_answer input, input.question_input');
                if (qInput) {
                    const v = (qInput.value || qInput.getAttribute('value') || qInput.innerText || qInput.textContent || '').trim();
                    if (v !== '') shortCandidate = v;
                }
                // fallback to answer_text element text if present
                if (!shortCandidate) {
                    const at = question.querySelector('.answer .answer_text, .answer_text');
                    if (at) {
                        // prefer innerHTML so MathJax/SVG/LaTeX preserved
                        const html = at.innerHTML?.trim();
                        const txt = (at.innerText || at.textContent) ? (at.innerText || at.textContent).trim() : '';
                        if (html && html !== '') {
                            shortCandidate = txt || html.replace(/<[^>]+>/g, '').trim();
                            expectedHtml = html;
                        } else if (txt !== '') {
                            shortCandidate = txt;
                        }
                    }
                }
            } catch (e) {
                // ignore and continue to numeric checks
            }

            if (shortCandidate) {
                expected = shortCandidate;
                // if we didn't find expectedHtml earlier, try to get it from answers array
                if (!expectedHtml) {
                    const a = answers.find(a => (a.html && a.html.trim() !== '') || (a.text && a.text.trim() !== ''));
                    if (a) expectedHtml = a.html || a.text;
                }
            }

            // only consider numerical/range detection if we didn't already pick a short-answer expected
            if (!expected) {
                const numExact = question.querySelector('.numerical_exact_answer .answer_exact')?.innerText;
                const numMargin = question.querySelector('.numerical_exact_answer .answer_error_margin')?.innerText
                    || question.querySelector('.numerical_exact_answer .answer_tolerance')?.innerText;
                const numEquation = question.querySelector('.numerical_range_answer .answer_equation')?.innerText;
                // explicit range values (visible range)
                const numRangeStart = question.querySelector('.numerical_range_answer .answer_range_start')?.innerText;
                const numRangeEnd = question.querySelector('.numerical_range_answer .answer_range_end')?.innerText;
                if (numExact) {
                    expected = numExact.trim();
                    if (numMargin) {
                        const parsed = parseFloat(numMargin);
                        if (!isNaN(parsed)) tolerance = parsed;
                    }
                } else if (numEquation) {
                    expected = numEquation.trim();
                } else if (numRangeStart || numRangeEnd) {
                    // prefer explicit range start/end when present
                    const s = numRangeStart ? parseFloat(numRangeStart) : NaN;
                    const e = numRangeEnd ? parseFloat(numRangeEnd) : NaN;
                    if (!isNaN(s) || !isNaN(e)) {
                        expectedRange = {
                            start: !isNaN(s) ? s : null,
                            end: !isNaN(e) ? e : null
                        };
                    }
                }
                console.log(index, numExact, numEquation, numRangeStart, numRangeEnd, expected);
            } else {
                console.log(index, 'short-answer preferred:', expected, 'html?', !!expectedHtml);
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
            } else if (qType.includes('short_answer')) {
                finalType = 'short_answer'
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
                expectedHtml,
                tolerance,            // numeric tolerance if available
                expectedRange         // range object if available
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

