document.addEventListener('DOMContentLoaded', () => {
    const quizContainer = document.getElementById('quiz-container');

    // Load quiz data from localStorage
    const quizData = JSON.parse(localStorage.getItem('quizData')) || [];
    if (quizData.length === 0) {
        quizContainer.innerHTML = '<p>No quiz data found. Please collect quiz data first.</p>';
        return;
    }

    // Render the quiz
    quizData.forEach((item, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.classList.add('question');

        // Add the question text
        const questionText = document.createElement('h3');
        questionText.innerText = `Question ${index + 1}: ${item.question}`;
        questionDiv.appendChild(questionText);

        // Add the answers
        const answersDiv = document.createElement('div');
        answersDiv.classList.add('answers');
        item.answers.forEach(answer => {
            const answerDiv = document.createElement('div');
            answerDiv.classList.add('answer');
            if (answer.isCorrect) {
                answerDiv.classList.add('correct');
            }
            answerDiv.innerText = answer.text;
            answersDiv.appendChild(answerDiv);
        });

        questionDiv.appendChild(answersDiv);
        quizContainer.appendChild(questionDiv);
    });
});