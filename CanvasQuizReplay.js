console.log("QuizReplay Loaded")

function collectQuiz() {
    try {
        var quiz_questions = document.querySelectorAll('[aria-label="Question"]');
        var quiz_data = [];
        if (quiz_questions.length > 0) {
            console.log("Questions found")
            console.log(quiz_questions.length)
            quiz_questions.forEach((question, index) => {
                // Extract the question text
                const questionText = question.querySelector('[class="question_text user_content enhanced"')?.innerText || `Question ${index + 1}`;
                console.log(questionText)
                // Extract the answers and identify the correct one
                const answers = Array.from(question.querySelectorAll('answer')).map(answer => ({
                    text: answer.innerText.trim(),
                    isCorrect: answer.classList.contains('correct')
                }));

                quiz_data.push({ question: questionText, answers });
            });

            localStorage.setItem('quizData', JSON.stringify(quiz_data));
        } else {
            console.warn('No quiz questions found on the page.');
        }
    } catch (e) {
        console.error('Error collecting quiz:', e);
    }
}



var quiz = collectQuiz()

