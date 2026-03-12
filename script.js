/**
 * منصة كويزات - محرك التشغيل
 * ملاحظة: يجب تشغيل المشروع عبر سيرفر محلي (Local Server) ليعمل Fetch
 */

let allQuizzes = [];
let userScores = {};
let currentQuiz = null;
let currentQuestionIndex = 0;

// --- الدوال الأساسية ---

async function loadQuizzes() {
    try {
        const response = await fetch('quizzes.json');
        if (!response.ok) throw new Error('فشل تحميل البيانات');
        allQuizzes = await response.json();
        
        hydrateFromUrl(); // التحقق من روابط المشاركة أولاً
        renderHome(allQuizzes);
    } catch (error) {
        showError("عذراً، حدث خطأ أثناء تحميل الاختبارات. تأكد من تشغيل سيرفر محلي.");
        console.error(error);
    }
}

function renderHome(data) {
    const grid = document.getElementById('quizzes-grid');
    grid.innerHTML = '';
    
    data.forEach(quiz => {
        const card = document.createElement('div');
        card.className = 'quiz-card';
        card.innerHTML = `
            <img src="${quiz.image}" alt="${quiz.title}" loading="lazy">
            <div class="card-body">
                <span class="card-category">${quiz.category}</span>
                <h3>${quiz.title}</h3>
                <p>${quiz.description.substring(0, 80)}...</p>
                <small>عدد الأسئلة: ${quiz.questions.length}</small>
            </div>
        `;
        card.onclick = () => renderQuiz(quiz.id);
        grid.appendChild(card);
    });
    
    document.getElementById('quiz-view').classList.add('hidden');
    document.getElementById('result-view').classList.add('hidden');
    document.getElementById('quizzes-grid').classList.remove('hidden');
}

function renderQuiz(quizId) {
    currentQuiz = allQuizzes.find(q => q.id === quizId);
    currentQuestionIndex = 0;
    userScores = {};
    
    // إخفاء الرئيسية وإظهار واجهة الاختبار
    document.getElementById('quizzes-grid').classList.add('hidden');
    document.getElementById('quiz-view').classList.remove('hidden');
    window.scrollTo(0, 0);
    
    showQuestion();
}

function showQuestion() {
    const question = currentQuiz.questions[currentQuestionIndex];
    const area = document.getElementById('question-area');
    
    // تحديث شريط التقدم
    const progress = ((currentQuestionIndex) / currentQuiz.questions.length) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;

    area.innerHTML = `
        <h2 class="question-text">${question.text}</h2>
        <div class="options-list">
            ${question.options.map((opt, index) => `
                <button class="option-btn" onclick="handleAnswer(${index})">
                    ${opt.text}
                </button>
            `).join('')}
        </div>
    `;
}

function handleAnswer(optionIndex) {
    const scores = currentQuiz.questions[currentQuestionIndex].options[optionIndex].scores;
    
    // جمع النقاط
    for (let key in scores) {
        userScores[key] = (userScores[key] || 0) + scores[key];
    }

    currentQuestionIndex++;

    if (currentQuestionIndex < currentQuiz.questions.length) {
        showQuestion();
    } else {
        calculateResult();
    }
}

function calculateResult() {
    // إيجاد المفتاح صاحب أعلى نقاط
    let maxScore = -1;
    let resultKey = '';

    for (let key in userScores) {
        if (userScores[key] > maxScore) {
            maxScore = userScores[key];
            resultKey = key;
        }
    }

    renderResult(resultKey);
}

function renderResult(resultKey) {
    const result = currentQuiz.results[resultKey];
    const view = document.getElementById('result-view');
    const content = document.getElementById('result-content');
    
    document.getElementById('quiz-view').classList.add('hidden');
    view.classList.remove('hidden');

    content.innerHTML = `
        <h2 class="result-title">نتيجتك هي: ${result.title}</h2>
        <p class="result-desc">${result.short}</p>
        <div class="traits">
            <strong>نقاط القوة:</strong> <ul>${result.strengths.map(s => `<li>${s}</li>`).join('')}</ul>
        </div>
    `;

    setupSharing(resultKey);
    renderRecommendations();
    
    // تتبع وهمي للتحليلات
    console.log(`Analytics: Quiz ${currentQuiz.id} completed. Result: ${resultKey}`);
}

// --- التوصيات والبحث ---

function renderRecommendations() {
    const recGrid = document.getElementById('recommendations-grid');
    recGrid.innerHTML = '';
    
    // منطق: نفس التصنيف + أعلى شعبية
    const recs = allQuizzes
        .filter(q => q.id !== currentQuiz.id)
        .sort((a, b) => (b.category === currentQuiz.category) - (a.category === currentQuiz.category) || b.popularity - a.popularity)
        .slice(0, 3);

    recs.forEach(quiz => {
        const div = document.createElement('div');
        div.className = 'quiz-card';
        div.innerHTML = `<h3>${quiz.title}</h3><p>${quiz.category}</p>`;
        div.onclick = () => renderQuiz(quiz.id);
        recGrid.appendChild(div);
    });
}

function setupSharing(resultKey) {
    const shareUrl = `${window.location.origin}${window.location.pathname}?quiz=${currentQuiz.slug}&result=${resultKey}`;
    const text = currentQuiz.results[resultKey].shareText + " " + shareUrl;

    document.getElementById('share-wa').onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    document.getElementById('share-fb').onclick = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`);
    document.getElementById('copy-link').onclick = () => {
        navigator.clipboard.writeText(shareUrl);
        alert("تم نسخ الرابط!");
    };
}

function hydrateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const quizSlug = params.get('quiz');
    const resultKey = params.get('result');

    if (quizSlug && resultKey) {
        currentQuiz = allQuizzes.find(q => q.slug === quizSlug);
        if (currentQuiz) renderResult(resultKey);
    }
}

// --- المستمعات (Listeners) ---

// البحث (Debounced)
let searchTimeout;
document.getElementById('search-input').oninput = (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const term = e.target.value.toLowerCase();
        const filtered = allQuizzes.filter(q => 
            q.title.toLowerCase().includes(term) || 
            q.tags.some(t => t.includes(term))
        );
        renderHome(filtered);
    }, 300);
};

// تصفية التصنيفات
document.querySelectorAll('.cat-filter').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.cat-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.category;
        const filtered = cat === 'all' ? allQuizzes : allQuizzes.filter(q => q.category === cat);
        renderHome(filtered);
    };
});

function showError(msg) {
    const err = document.getElementById('error-message');
    err.textContent = msg;
    err.classList.remove('hidden');
}

// البدء
window.onload = loadQuizzes;


