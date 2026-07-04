const app = document.querySelector("#app");
const toastNode = document.querySelector("#toast");
let questions = [];
let session = null;
let state = loadState();

function loadState() {
  try {
    return { wrongIds: [], answered: 0, correct: 0, ...JSON.parse(localStorage.getItem("histology-progress") || "{}") };
  } catch { return { wrongIds: [], answered: 0, correct: 0 }; }
}
function persist() { localStorage.setItem("histology-progress", JSON.stringify(state)); }
function unique(values) { return [...new Set(values)]; }
function escapeHtml(value = "") { return value.replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function route() { return location.hash.slice(1).split("?")[0] || "home"; }
function params() { return new URLSearchParams(location.hash.split("?")[1] || ""); }
function toast(text) { toastNode.textContent = text; toastNode.classList.add("show"); setTimeout(() => toastNode.classList.remove("show"), 1800); }

async function init() {
  questions = await fetch("data/questions.json").then(response => {
    if (!response.ok) throw new Error("题库加载失败");
    return response.json();
  });
  window.addEventListener("hashchange", render);
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("service-worker.js");
  render();
}

function render() {
  const current = route();
  document.querySelectorAll("[data-nav]").forEach(node => node.classList.toggle("active", node.dataset.nav === current));
  if (current === "home") renderHome();
  else if (current === "chapters") renderChapters();
  else if (current === "types") renderTypes();
  else if (current === "wrong") renderWrong();
  else if (current === "quiz") startQuiz();
  else location.hash = "home";
  scrollTo(0, 0);
}

function renderHome() {
  const accuracy = state.answered ? Math.round(state.correct / state.answered * 100) : 0;
  app.innerHTML = `<section class="hero">
    <div class="hero-copy"><div class="eyebrow">HISTOLOGY · EMBRYOLOGY</div><h1>组织学与胚胎学<br>专项题库</h1><p>选择一种方式开始练习，错题会自动进入错题本。</p></div>
    <div class="hero-stats"><div><strong>${questions.length}</strong><span>题目总数</span></div><div><strong>${state.wrongIds.length}</strong><span>待巩固错题</span></div><div><strong>${accuracy}%</strong><span>累计正确率</span></div></div>
  </section>
  <section class="mode-grid" aria-label="练习方式">
    <a class="mode-card chapter-mode" href="#chapters"><span class="mode-icon">章</span><div><small>CHAPTER</small><h2>章节练习</h2><p>按教材章节逐个突破</p></div><b>→</b></a>
    <a class="mode-card type-mode" href="#types"><span class="mode-icon">型</span><div><small>QUESTION TYPE</small><h2>题型练习</h2><p>单选、多选、判断、B 型题</p></div><b>→</b></a>
    <a class="mode-card wrong-mode" href="#wrong"><span class="mode-icon">↻</span><div><small>MISTAKES</small><h2>错题重练</h2><p>${state.wrongIds.length ? `${state.wrongIds.length} 道题等待巩固` : "错题自动收录，可反复练习"}</p></div><b>→</b></a>
  </section>`;
}

function pageHeader(title, description, back = "#home") {
  return `<div class="page-head"><a class="back" href="${back}">←</a><div><h1>${title}</h1><p>${description}</p></div></div>`;
}
function renderChapters() {
  const chapters = unique(questions.map(q => q.chapter));
  app.innerHTML = `${pageHeader("章节练习", `共 ${chapters.length} 个章节`)}<section class="choice-grid">${chapters.map((chapter, index) => {
    const count = questions.filter(q => q.chapter === chapter).length;
    return `<a class="choice-card" href="#quiz?chapter=${encodeURIComponent(chapter)}"><span class="choice-number">${String(index + 1).padStart(2,"0")}</span><div><h2>${escapeHtml(chapter)}</h2><p>${count} 道题</p></div><span class="arrow">→</span></a>`;
  }).join("")}</section>`;
}
function renderTypes() {
  const chapter = params().get("chapter");
  if (!chapter) {
    const chapters = unique(questions.map(q => q.chapter));
    app.innerHTML = `${pageHeader("题型练习", "先选择要练习的章节")}<section class="choice-grid">
      <a class="choice-card" href="#types?chapter=${encodeURIComponent("全部章节")}"><span class="choice-number">ALL</span><div><h2>全部章节</h2><p>${questions.length} 道题</p></div><span class="arrow">→</span></a>
      ${chapters.map((name, index) => {
        const count = questions.filter(q => q.chapter === name).length;
        return `<a class="choice-card" href="#types?chapter=${encodeURIComponent(name)}"><span class="choice-number">${String(index + 1).padStart(2,"0")}</span><div><h2>${escapeHtml(name)}</h2><p>${count} 道题</p></div><span class="arrow">→</span></a>`;
      }).join("")}</section>`;
    return;
  }
  const descriptions = {"单选题":"每题只有一个正确答案","多选题":"每题有两个或以上正确答案","判断题":"判断表述是否正确","B型题":"使用共用备选答案作答"};
  const chapterQuestions = chapter === "全部章节" ? questions : questions.filter(q => q.chapter === chapter);
  const types = unique(chapterQuestions.map(q => q.type));
  const chapterQuery = chapter === "全部章节" ? "" : `&chapter=${encodeURIComponent(chapter)}`;
  app.innerHTML = `${pageHeader("选择题型", chapter === "全部章节" ? "全部章节" : escapeHtml(chapter), "#types")}<section class="type-grid">${types.map(type => `<a class="type-card" href="#quiz?type=${encodeURIComponent(type)}${chapterQuery}"><span class="type-symbol">${type[0]}</span><h2>${type}</h2><p>${descriptions[type]}</p><strong>${chapterQuestions.filter(q=>q.type===type).length} 题 →</strong></a>`).join("")}</section>`;
}
function renderWrong() {
  const count = questions.filter(q => state.wrongIds.includes(q.id)).length;
  app.innerHTML = `${pageHeader("错题重练", "答对后自动移出，答错继续保留")}<section class="wrong-panel">${count ? `<span class="wrong-count">${count}</span><h2>道错题等待巩固</h2><p>可以不限次数重复练习，直到全部答对。</p><a class="primary" href="#quiz?wrong=1">开始重练</a>` : `<span class="empty-mark">✓</span><h2>目前没有错题</h2><p>练习时答错的题目会自动出现在这里。</p><a class="secondary" href="#chapters">开始章节练习</a>`}</section>`;
}

function startQuiz() {
  const p = params();
  let pool = questions.filter(q => (!p.get("chapter") || q.chapter === p.get("chapter")) && (!p.get("type") || q.type === p.get("type")));
  if (p.get("wrong")) pool = pool.filter(q => state.wrongIds.includes(q.id));
  if (!pool.length) { location.hash = p.get("wrong") ? "wrong" : "home"; return; }
  session = { pool, index: 0, selected: [], checked: false, right: 0, wrongMode: Boolean(p.get("wrong")) };
  showQuestion();
}
function showQuestion() {
  const q = session.pool[session.index];
  app.innerHTML = `<section class="question-shell"><div class="quiz-head"><a class="close" href="${session.wrongMode ? "#wrong" : "#home"}">×</a><div class="progress-track"><div class="progress-fill" style="width:${(session.index + 1) / session.pool.length * 100}%"></div></div><span>${session.index + 1}/${session.pool.length}</span></div>
  <article class="question-card"><div class="tags"><span>${escapeHtml(q.chapter)}</span><span>${q.type}</span></div>${q.context ? `<p class="context">${q.context}</p>` : ""}<h1>${escapeHtml(q.stem)}</h1><div class="options">${q.options.map(o => `<button class="option" data-key="${o.key}"><span class="option-key">${o.key}</span><span>${escapeHtml(o.text)}</span></button>`).join("")}</div><div id="feedback"></div><button id="submit" class="primary submit" disabled>提交答案</button></article></section>`;
  document.querySelector(".options").onclick = event => selectOption(event, q);
  document.querySelector("#submit").onclick = () => session.checked ? nextQuestion() : checkAnswer(q);
}
function selectOption(event, q) {
  if (session.checked) return;
  const node = event.target.closest(".option"); if (!node) return;
  const key = node.dataset.key;
  session.selected = q.type === "多选题" ? (session.selected.includes(key) ? session.selected.filter(v => v !== key) : [...session.selected, key]) : [key];
  document.querySelectorAll(".option").forEach(n => n.classList.toggle("selected", session.selected.includes(n.dataset.key)));
  document.querySelector("#submit").disabled = !session.selected.length;
}
function checkAnswer(q) {
  session.checked = true;
  const actual = [...session.selected].sort().join("");
  const expected = [...q.answer].sort().join("");
  const correct = actual === expected;
  state.answered++;
  if (correct) { state.correct++; session.right++; state.wrongIds = state.wrongIds.filter(id => id !== q.id); }
  else if (!state.wrongIds.includes(q.id)) state.wrongIds.push(q.id);
  persist();
  document.querySelectorAll(".option").forEach(node => {
    node.classList.remove("selected");
    if (q.answer.includes(node.dataset.key)) node.classList.add("correct");
    else if (session.selected.includes(node.dataset.key)) node.classList.add("wrong");
  });
  document.querySelector("#feedback").innerHTML = `<div class="feedback ${correct ? "good" : "bad"}">${correct ? "回答正确" : `回答错误，正确答案：${expected}`}</div>`;
  const button = document.querySelector("#submit");
  button.disabled = false;
  button.textContent = session.index === session.pool.length - 1 ? "查看结果" : "下一题";
}
function nextQuestion() {
  session.index++;
  if (session.index < session.pool.length) { session.selected = []; session.checked = false; showQuestion(); }
  else showResult();
}
function showResult() {
  const rate = Math.round(session.right / session.pool.length * 100);
  app.innerHTML = `<section class="result"><span>${rate >= 80 ? "✓" : "↻"}</span><h1>本轮练习完成</h1><p>答对 ${session.right} / ${session.pool.length} 题，正确率 ${rate}%</p><div><a class="secondary" href="#home">返回首页</a><a class="primary" href="${session.wrongMode ? "#quiz?wrong=1" : "#chapters"}">${session.wrongMode ? "再练一次" : "继续练习"}</a></div></section>`;
}

init().catch(error => {
  console.error(error);
  app.innerHTML = `<section class="wrong-panel"><h2>题库加载失败</h2><p>请通过部署网址或启动脚本访问。</p></section>`;
});
