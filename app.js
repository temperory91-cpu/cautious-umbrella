// Register GSAP
gsap.registerPlugin(ScrollToPlugin);

// --- 1. CONFIGURATION ---
// Integrated your specific API key as requested
const GEMINI_API_KEY = "[GEMINI_API_KEY]"; 
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- 2. BACKGROUND ANIMATION ---
const svg = document.getElementById('mainSvg');
function initBackground() {
    for (let i = 0; i < 36; i++) {
        const pos = i % 2 === 0 ? 1 : -1;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const d = `M-${380 - i * 5 * pos} -${189 + i * 6}C-${380 - i * 5 * pos} -${189 + i * 6} -${312 - i * 5 * pos} ${216 - i * 6} ${152 - i * 5 * pos} ${343 - i * 6}C${616 - i * 5 * pos} ${470 - i * 6} ${684 - i * 5 * pos} ${875 - i * 6} ${684 - i * 5 * pos} ${875 - i * 6}`;
        path.setAttribute("d", d);
        path.setAttribute("class", "floating-path");
        path.style.strokeWidth = 0.5 + (i * 0.03);
        svg.appendChild(path);
        gsap.to(path, { opacity: 0.3, duration: 3, delay: i * 0.05 });
        gsap.to(path, { strokeDasharray: "1, 1000", strokeDashoffset: -1000, duration: 15 + Math.random() * 10, repeat: -1, ease: "none" });
    }
}
initBackground();

// --- 3. PDF EXTRACTION ---
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

async function extractText(file) {
    const reader = new FileReader();
    return new Promise((resolve) => {
        reader.onload = async () => {
            const typedArray = new Uint8Array(reader.result);
            const pdf = await pdfjsLib.getDocument(typedArray).promise;
            let text = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map(s => s.str).join(" ");
            }
            resolve(text.trim());
        };
        reader.readAsArrayBuffer(file);
    });
}

// --- 4. CORE AI LOGIC ---
const qInput = document.getElementById('qUpload');
const aInput = document.getElementById('aUpload');
const btnEvaluate = document.getElementById('btnEvaluate');

qInput.onchange = () => {
    document.getElementById('qStatus').innerText = qInput.files[0].name;
    document.getElementById('qCheck').classList.remove('hidden');
};

aInput.onchange = () => {
    document.getElementById('aStatus').innerText = aInput.files[0].name;
    document.getElementById('aCheck').classList.remove('hidden');
};

btnEvaluate.onclick = async () => {
    if (!qInput.files[0] || !aInput.files[0]) return alert("Upload both files first.");

    // 1. Extract Text
    const qText = await extractText(qInput.files[0]);
    const aText = await extractText(aInput.files[0]);

    // 2. Validation: Check if text contains questions or answers
    // Basic check: If text is too short or doesn't contain common academic keywords
    const isQuestionPaper = qText.length > 20 && (qText.toLowerCase().includes("question") || qText.toLowerCase().includes("marks") || /\d+[\.\)]/.test(qText));
    const isAnswerSheet = aText.length > 20;

    if (!isQuestionPaper || !isAnswerSheet) {
        alert("{upload correct pdfs}");
        return;
    }

    // UI Transition: Scroll to results and show Loader
    gsap.to("#results", { opacity: 1, y: 0, duration: 1.2, ease: "power4.out" });
    gsap.to(window, { scrollTo: "#results", duration: 1.5, ease: "expo.inOut" });
    
    document.getElementById('aiLoader').classList.remove('hidden');
    document.getElementById('resultContent').classList.add('hidden');

    try {
        const prompt = `Evaluate these papers. Question Paper: ${qText}. Answer Sheet: ${aText}. Give scores for 5 questions (0-10) and 4 feedback points. Return ONLY JSON: {"questions":[8,7,9,6,8],"finalScore":7.6,"feedback":["..."]}`;

        const response = await fetch("/api/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: prompt }] }], 
                generationConfig: { responseMimeType: "application/json" } 
            })
        });

        const data = await response.json();
        
        if (data.error) throw new Error(data.error.message);

        const result = JSON.parse(data.candidates[0].content.parts[0].text);

        // Hide Loader, Show Results
        document.getElementById('aiLoader').classList.add('hidden');
        document.getElementById('resultContent').classList.remove('hidden');

        displayResult(result);
        generateChart(result.questions);

    } catch (err) {
        console.error(err);
        document.getElementById('aiLoader').innerHTML = `<h1 class='text-red-500'>Analysis Failed: ${err.message}</h1>`;
    }
};

function displayResult(result) {
    document.getElementById('finalScore').innerText = `${result.finalScore}/10`;
    const list = document.getElementById('feedbackList');
    list.innerHTML = "";
    result.feedback.forEach(text => {
        const li = document.createElement('li');
        li.className = "flex items-center gap-4 text-sm border-b border-white/5 pb-2";
        li.innerHTML = `<span class="w-1.5 h-1.5 bg-white rounded-full"></span> ${text}`;
        list.appendChild(li);
    });
}

function generateChart(scores) {
    const ctx = document.getElementById('scoreChart');
    // Destroy previous chart instance if it exists to prevent overlap
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
            datasets: [{
                data: scores,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderRadius: 8,
                barThickness: 25
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, max: 10, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666' } },
                x: { grid: { display: false }, ticks: { color: '#666' } }
            }
        }
    });
}

document.getElementById('btnExport').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("AI Evaluation Report", 20, 20);
    doc.text(`Score: ${document.getElementById('finalScore').innerText}`, 20, 35);
    doc.save("report.pdf");
};