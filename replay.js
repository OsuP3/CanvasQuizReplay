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

            if (item.type === 'multiple_choice' || item.type === 'true_false') {
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
                        label.innerHTML = rawHTML(opt.text);

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
                        label.innerHTML = rawHTML(opt.text);

                        aDiv.appendChild(input);
                        aDiv.appendChild(label);
                        answersWrap.appendChild(aDiv);
                    });
                }
            } else if (item.type === 'numerical' || item.type === 'text') {
                const aDiv = document.createElement('div');
                aDiv.className = 'answer';
                if (item.expected) aDiv.dataset.expected = item.expected;
                if (typeof item.tolerance !== 'undefined' && item.tolerance !== null) aDiv.dataset.tolerance = item.tolerance;

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
                    span.textContent = opt.text || '';
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
            quizData.forEach((item, i) => {
                const qWrap = quizContainer.querySelector(`[data-qindex="${i}"]`);
                const feedback = qWrap.querySelector('.feedback');
                feedback.innerHTML = '';
                const opts = item.answers || [];

                if (item.type === 'multiple_choice' || item.type === 'true_false') {
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
                    const tol = (qWrap.querySelector('.answer')?.dataset.tolerance !== undefined) ? parseFloat(qWrap.querySelector('.answer').dataset.tolerance) : item.tolerance;
                    const given = (input?.value || '').trim();
                    if (!given) {
                        feedback.innerHTML = '<span class="incorrect">No answer provided</span>';
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
                            feedback.innerHTML = `<span class="incorrect">Incorrect — expected: "${expected}"${tol ? ` ±${tol}` : ''}</span>`;
                            qWrap.querySelector('.answer')?.classList.add('incorrect');
                        }
                    } else {
                        feedback.innerHTML = '<span>Answer recorded (no reference available)</span>';
                    }
                } else {
                    feedback.innerHTML = '<span>Not gradable</span>';
                }
            });

            resultDiv.innerHTML = `<div class="score">Score: ${correctCount} / ${quizData.length}</div>`;
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
    });
} else {
    // not the replay UI — do nothing
}