if (document.getElementById && document.getElementById('quiz-container')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const quizContainer = document.getElementById('quiz-container');
        const controls = document.getElementById('controls');
        const submitBtn = document.getElementById('submit-btn');
        const resetBtn = document.getElementById('reset-btn');
        const resultDiv = document.getElementById('result');

        // load quiz data from extension storage
        let quizData = [];
        try {
            const stored = await browser.storage.local.get('quizData');
            quizData = stored && stored.quizData ? stored.quizData : [];
            console.log('replay loaded quizData from storage', quizData);
        } catch (e) {
            console.error('error reading quizData from storage', e);
        }

        if (!quizData || quizData.length === 0) {
            quizContainer.innerHTML = '<p>No data. Make sure you run Collect on the quiz tab first (click the toolbar button while on the quiz page).</p>';
            return;
        }

        const rawHTML = (s) => (s == null ? '' : s);
        // Normalize option HTML so block-level tags like <p> and <div> don't force options onto new lines.
        // This preserves inner markup (tables, images, math) but prevents paragraphs from breaking layout.
        function normalizeOptionHtml(html) {
            if (!html) return '';
            // replace opening <p ...> with <span class="option-inline"> and closing </p> with </span>
            let out = String(html);
            out = out.replace(/<\s*p[^>]*>/gi, '<span class="option-inline">');
            out = out.replace(/<\s*\/\s*p\s*>/gi, '</span>');
            // replace divs similarly (many Canvas option wrappers use divs)
            out = out.replace(/<\s*div[^>]*>/gi, '<span class="option-inline">');
            out = out.replace(/<\s*\/\s*div\s*>/gi, '</span>');
            // remove empty spans created accidentally
            out = out.replace(/<span class="option-inline">\s*<\/span>/gi, '');
            return out;
        }

        // render UI
        quizContainer.innerHTML = '';
        quizData.forEach((item, i) => {
            const qWrap = document.createElement('div');
            qWrap.className = 'question';
            qWrap.dataset.qindex = i;

            const header = document.createElement('div');
            header.innerHTML = `<strong>Question ${i+1}:</strong> ${rawHTML(item.question)}`;
            qWrap.appendChild(header);

            const answersWrap = document.createElement('div');
            answersWrap.className = 'answers';

            const opts = item.answers || [];

            // Essay: editable textarea
            if (item.rawType === 'short_answer_question' || item.type === 'short_answer') {
                const aDiv = document.createElement('div');
                aDiv.className = 'answer';
                // preserve expected even when it's falsy like 0 — check for null/undefined instead of truthiness
                if (typeof item.expected !== 'undefined' && item.expected !== null) aDiv.dataset.expected = String(item.expected);
                // preserve expected HTML (math markup) so we can render it verbatim in the replay UI
                if (item.expectedHtml) aDiv.dataset.expectedHtml = item.expectedHtml;
                
                const input = document.createElement('input');
                input.type = 'text';
                input.name = `q${i}`;
                input.style.width = '60%';
                input.placeholder = 'Type your answer here';

                aDiv.appendChild(input);
                answersWrap.appendChild(aDiv);
            }

            else if (item.rawType === 'essay_question' || item.type === 'essay') {
                const aDiv = document.createElement('div');
                aDiv.className = 'answer essay';
                const textarea = document.createElement('textarea');
                textarea.name = `q${i}`;
                textarea.style.width = '100%';
                textarea.style.minHeight = '6em';
                textarea.placeholder = 'Type your answer here';
                textarea.className = 'inputtext'
                // if collector saved any user content inside answers, try to prefill
                aDiv.appendChild(textarea);
                answersWrap.appendChild(aDiv);
                qWrap.appendChild(answersWrap);
                const fb = document.createElement('div');
                fb.className = 'feedback';
                qWrap.appendChild(fb);
                quizContainer.appendChild(qWrap);
                return; // next question
            }

            else if (item.type === 'multiple_choice' || item.type === 'true_false') {
                const name = `q${i}`;
                if (item.multiple) {
                    opts.forEach((opt, ai) => {
                        const aDiv = document.createElement('div');
                        aDiv.className = 'answer';
                        if (opt.isCorrect) aDiv.dataset.correct = 'true';

                        const input = document.createElement('input');
                        input.type = 'checkbox';
                        input.name = name;
                        input.id = `${name}_opt${ai}`;
                        input.value = ai;

                        const label = document.createElement('label');
                        label.htmlFor = input.id;
                        label.style.marginLeft = '8px';
                        // prefer rich HTML for options (tables, images, math) when available
                        label.innerHTML = normalizeOptionHtml(rawHTML(opt.html || opt.text || ''));

                        aDiv.appendChild(input);
                        aDiv.appendChild(label);
                        answersWrap.appendChild(aDiv);
                    });
                } else {
                    opts.forEach((opt, ai) => {
                        const aDiv = document.createElement('div');
                        aDiv.className = 'answer';
                        if (opt.isCorrect) aDiv.dataset.correct = 'true';

                        const input = document.createElement('input');
                        input.type = 'radio';
                        input.name = name;
                        input.id = `${name}_opt${ai}`;
                        input.value = ai;

                        const label = document.createElement('label');
                        label.htmlFor = input.id;
                        label.style.marginLeft = '8px';
                        label.innerHTML = normalizeOptionHtml(rawHTML(opt.html || opt.text || ''));

                        aDiv.appendChild(input);
                        aDiv.appendChild(label);
                        answersWrap.appendChild(aDiv);
                    });
                }
            } else if (item.type === 'numerical' || item.type === 'text') {
                const aDiv = document.createElement('div');
                aDiv.className = 'answer';
                // expose any expected range on UI so user knows acceptable values
                if (item.expectedRange && (item.expectedRange.start !== null || item.expectedRange.end !== null)) {
                    aDiv.dataset.rangeStart = item.expectedRange.start;
                    aDiv.dataset.rangeEnd = item.expectedRange.end;
                    const hint = document.createElement('div');
                    hint.className = 'range-hint';
                    const s = item.expectedRange.start !== null ? item.expectedRange.start : '-∞';
                    const e = item.expectedRange.end !== null ? item.expectedRange.end : '∞';
                    hint.textContent = `Accepts values between ${s} and ${e} (inclusive)`;
                    hint.style.fontSize = '0.95em';
                    hint.style.marginBottom = '6px';
                    aDiv.appendChild(hint);
                }
                // preserve expected even when it's falsy like 0
                if (typeof item.expected !== 'undefined' && item.expected !== null) aDiv.dataset.expected = String(item.expected);
                // preserve expected HTML for math/latex rendering
                if (item.expectedHtml) aDiv.dataset.expectedHtml = item.expectedHtml;
                if (typeof item.tolerance !== 'undefined' && item.tolerance !== null) aDiv.dataset.tolerance = String(item.tolerance);

                const input = document.createElement('input');
                input.type = 'text';
                input.name = `q${i}`;
                input.style.width = '60%';
                input.placeholder = 'Type your answer here';

                aDiv.appendChild(input);
                answersWrap.appendChild(aDiv);
            } else {
                opts.forEach((opt, ai) => {
                    const aDiv = document.createElement('div');
                    aDiv.className = 'answer';
                    const span = document.createElement('span');
                    span.innerHTML = normalizeOptionHtml(rawHTML(opt.html || opt.text || ''));
                    aDiv.appendChild(span);
                    answersWrap.appendChild(aDiv);
                });
            }

            qWrap.appendChild(answersWrap);

            const fb = document.createElement('div');
            fb.className = 'feedback';
            qWrap.appendChild(fb);

            quizContainer.appendChild(qWrap);
        });

        // remove MathJax placeholder SVGs that reference external glyph defs (they render as empty boxes)
        (function removeBrokenMathSVGs() {
            const svgs = Array.from(quizContainer.querySelectorAll('svg'));
            svgs.forEach(svg => {
                // remove totally-empty SVGs
                if (!svg.innerHTML || !svg.innerHTML.trim()) {
                    const wrapper = svg.closest('.MathJax_SVG') || svg.parentNode;
                    svg.remove();
                    if (wrapper && wrapper !== document.body && wrapper.innerHTML.trim() === '') wrapper.remove();
                    return;
                }

                const uses = Array.from(svg.querySelectorAll('use'));
                if (uses.length === 0) return;

                // if any <use> references an external URL or MathJax symbol id, treat as broken
                let external = false;
                for (const u of uses) {
                    const href = u.getAttribute('xlink:href') || u.getAttribute('href') || (u.href && u.href.baseVal) || '';
                    if (!href) continue;
                    // hrefs that include an absolute origin or the MJ* ids indicate external defs
                    try {
                        const parsed = new URL(href, window.location.href);
                        if (parsed.origin !== window.location.origin) { external = true; break; }
                    } catch (e) {
                        if (/MJ[A-Z0-9_-]/.test(href) || /MJMATH|MJMAIN|MJMS|MJX/.test(href)) { external = true; break; }
                    }
                }

                if (external) {
                    const wrapper = svg.closest('.MathJax_SVG') || svg.parentNode;
                    svg.remove();
                    if (wrapper && wrapper !== document.body && wrapper.innerHTML.trim() === '') wrapper.remove();
                }
            });
        })();

        // We inlined MathJax uses at collection time, so no MathJax load is required here.
        controls.style.display = 'block';

        function disableInputs(disabled) {
            const inputs = quizContainer.querySelectorAll('input');
            inputs.forEach(i => i.disabled = disabled);
            if (disabled) quizContainer.classList.add('disabled'); else quizContainer.classList.remove('disabled');
        }

        function showResults() {
            let correctCount = 0;
            // count only gradable questions (exclude essay and other non-gradable types)
            const gradableTotal = quizData.filter(it => !(it.rawType === 'essay_question' || it.type === 'essay')).length || 0;

            quizData.forEach((item, i) => {
                const qWrap = quizContainer.querySelector(`[data-qindex="${i}"]`);
                if (!qWrap) return; // safety for early returned essay blocks
                const feedback = qWrap.querySelector('.feedback');
                feedback.innerHTML = '';
                const opts = item.answers || [];

                // Essay: skip grading, but mark as not graded
                if (item.rawType === 'essay_question' || item.type === 'essay') {
                    feedback.innerHTML = '<span>Essay — not graded</span>';
                    return;
                } else if (item.rawType === 'short_answer_question' || item.type === 'short_answer') {
                    const input = qWrap.querySelector('input[type="text"]');
                    // expected for short answer is stored on the .answer dataset when rendered.
                    // Use dataset.expected if present (preserves '0'), otherwise fall back to item.expected.
                    const elemExpected = qWrap.querySelector('.answer')?.dataset?.expected;
                    const expected = (typeof elemExpected !== 'undefined' && elemExpected !== null && elemExpected !== '')
                        ? String(elemExpected).trim()
                        : (item.expected != null ? String(item.expected).trim() : '');
                    const given = (input?.value || '').trim();
                    if (!given) {
                        feedback.innerHTML = '<span class="incorrect">No answer provided</span>';
                    } else if (expected) {
                            // <-----------START HERE THIS IS SUPPOSED TO BE SHORT ANSWER
                            let isCorrect = expected.trim().toLowerCase() === given.trim().toLowerCase();

                            if (isCorrect) {
                                feedback.innerHTML = '<span class="correct">Correct</span>';
                                correctCount++;
                                qWrap.querySelector('.answer')?.classList.add('correct');
                            } else {
                                // prefer expectedHtml if available so math markup is preserved
                                const expHtml = qWrap.querySelector('.answer')?.dataset?.expectedHtml;
                                if (expHtml) {
                                    feedback.innerHTML = `<span class="incorrect">Incorrect — expected: "<span style=\"font-weight:600\">${expHtml}</span>"</span>`;
                                } else {
                                    feedback.innerHTML = `<span class="incorrect">Incorrect — expected: "${expected}"</span>`;
                                }
                                qWrap.querySelector('.answer')?.classList.add('incorrect');
                            }
                        } 
                } else if (item.type === 'multiple_choice' || item.type === 'true_false') {
                    if (item.multiple) {
                        const checked = Array.from(qWrap.querySelectorAll('input[type="checkbox"]:checked')).map(n => parseInt(n.value,10));
                        const correctIndices = opts.map((o,idx) => o.isCorrect ? idx : -1).filter(v => v>=0);
                        const checkedSet = new Set(checked);
                        const same = checked.length === correctIndices.length && correctIndices.every(ci => checkedSet.has(ci));
                        if (same) {
                            feedback.innerHTML = '<span class="correct">Correct</span>';
                            correctCount++;
                        } else {
                            feedback.innerHTML = `<span class="incorrect">Incorrect</span>`;
                        }
                        qWrap.querySelectorAll('.answer').forEach((aEl, ai) => {
                            if (opts[ai] && opts[ai].isCorrect) aEl.classList.add('correct');
                        });
                    } else {
                        const selected = qWrap.querySelector(`input[type="radio"]:checked`);
                        if (!selected) {
                            feedback.innerHTML = '<span class="incorrect">No answer selected</span>';
                        } else {
                            const selIndex = parseInt(selected.value, 10);
                            const isCorrect = !!(opts[selIndex] && opts[selIndex].isCorrect);
                            if (isCorrect) {
                                feedback.innerHTML = '<span class="correct">Correct</span>';
                                correctCount++;
                            } else {
                                feedback.innerHTML = '<span class="incorrect">Incorrect</span>';
                            }
                        }
                        qWrap.querySelectorAll('.answer').forEach((aEl, ai) => {
                            if (opts[ai] && opts[ai].isCorrect) aEl.classList.add('correct');
                        });
                    }
                } else if (item.type === 'numerical' || item.type === 'text') {
                    const input = qWrap.querySelector('input[type="text"]');
                    const expected = (qWrap.querySelector('.answer')?.dataset.expected || item.expected || '').trim();
                    const rangeStart = qWrap.querySelector('.answer')?.dataset.rangeStart;
                    const rangeEnd = qWrap.querySelector('.answer')?.dataset.rangeEnd;
                    const tol = (qWrap.querySelector('.answer')?.dataset.tolerance !== undefined) ? parseFloat(qWrap.querySelector('.answer').dataset.tolerance) : item.tolerance;
                    const given = (input?.value || '').trim();
                    if (!given) {
                        feedback.innerHTML = '<span class="incorrect">No answer provided</span>';
                    } else if (rangeStart !== undefined || expected) {
                        // if range present, prefer range check
                        if ((typeof rangeStart !== 'undefined') && (rangeStart !== null && rangeStart !== 'undefined')) {
                            const s = (rangeStart === 'null') ? -Infinity : parseFloat(rangeStart);
                            const e = (rangeEnd === 'null' || typeof rangeEnd === 'undefined') ? Infinity : parseFloat(rangeEnd);
                            const givenNum = Number(given);
                            if (!isNaN(givenNum) && givenNum >= s && givenNum <= e) {
                                feedback.innerHTML = '<span class="correct">Correct</span>';
                                correctCount++;
                                qWrap.querySelector('.answer')?.classList.add('correct');
                            } else {
                                feedback.innerHTML = `<span class="incorrect">Incorrect — expected between ${s} and ${e}</span>`;
                                qWrap.querySelector('.answer')?.classList.add('incorrect');
                            }
                        } else if (expected) {
                            const expNum = Number(expected);
                            const givenNum = Number(given);
                            let isCorrect = false;
                            if (!isNaN(expNum) && !isNaN(givenNum)) {
                                if (!isNaN(tol)) isCorrect = Math.abs(expNum - givenNum) <= tol;
                                else isCorrect = Math.abs(expNum - givenNum) < 1e-6;
                            } else {
                                isCorrect = expected.trim().toLowerCase() === given.trim().toLowerCase();
                            }
                            if (isCorrect) {
                                feedback.innerHTML = '<span class="correct">Correct</span>';
                                correctCount++;
                                qWrap.querySelector('.answer')?.classList.add('correct');
                            } else {
                                // prefer HTML expected if present
                                const expHtml = qWrap.querySelector('.answer')?.dataset?.expectedHtml;
                                if (expHtml) {
                                    feedback.innerHTML = `<span class="incorrect">Incorrect — expected: "<span style=\"font-weight:600\">${expHtml}</span>"${tol ? ` ±${tol}` : ''}</span>`;
                                } else {
                                    feedback.innerHTML = `<span class="incorrect">Incorrect — expected: "${expected}"${tol ? ` ±${tol}` : ''}</span>`;
                                }
                                qWrap.querySelector('.answer')?.classList.add('incorrect');
                            }
                        }
                    } else {
                        feedback.innerHTML = '<span>Answer recorded (no reference available)</span>';
                    }
                } else {
                    feedback.innerHTML = '<span>Not gradable</span>';
                }
            });

            const total = gradableTotal || 0;
            resultDiv.innerHTML = total > 0
                ? `<div class="score">Score: ${correctCount} / ${total}</div>`
                : `<div class="score">Score: N/A (no gradable questions)</div>`;
        }

        submitBtn.addEventListener('click', () => {
            showResults();
            disableInputs(true);
        });

        resetBtn.addEventListener('click', () => {
            quizContainer.querySelectorAll('input').forEach(i => { if (i.type==='checkbox' || i.type==='radio') i.checked = false; else i.value = ''; });
            quizContainer.querySelectorAll('.feedback').forEach(f => f.innerHTML = '');
            quizContainer.querySelectorAll('.answer').forEach(a => { a.classList.remove('correct','incorrect'); });
            resultDiv.innerHTML = '';
            disableInputs(false);
        });

        // mark images that should be shown at natural size
        (function markFullsizeImages() {
            const imgs = Array.from(quizContainer.querySelectorAll('img'));
            const THRESHOLD = 160; // px, adjust if needed
            imgs.forEach(img => {
                const attrW = img.getAttribute('width');
                const attrH = img.getAttribute('height');
                const hasExplicit = (attrW && Number(attrW) > THRESHOLD) || (attrH && Number(attrH) > THRESHOLD);
                const markIfLarge = () => {
                    const nat = img.naturalWidth || 0;
                    if (hasExplicit || nat > THRESHOLD) {
                        img.classList.add('fullsize');
                        img.setAttribute('data-fullsize', 'true');
                    }
                };
                // try immediately; if image not loaded yet, use load event
                markIfLarge();
                if ((img.naturalWidth || 0) === 0) {
                    img.addEventListener('load', markIfLarge, { once: true });
                }
            });
        })();
    });
} else {
    // not the replay UI — do nothing
}