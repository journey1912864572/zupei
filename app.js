const app = document.querySelector("#app");
const toastNode = document.querySelector("#toast");
let questions = [];
let session = null;
let state = loadState();

function loadState() {
  try {
    return { wrongIds: [], answered: 0, correct: 0, customPapers: [], nextPaperNumber: 1, ...JSON.parse(localStorage.getItem("histology-progress") || "{}") };
  } catch { return { wrongIds: [], answered: 0, correct: 0, customPapers: [], nextPaperNumber: 1 }; }
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
  else if (current === "type-chapters") renderTypeChapters();
  else if (current === "papers") renderPapers();
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
    <a class="mode-card type-mode" href="#types"><span class="mode-icon">型</span><div><small>QUESTION TYPE</small><h2>题型练习</h2><p>多选题型和章节，自主组卷</p></div><b>→</b></a>
    <a class="mode-card paper-mode" href="#papers"><span class="mode-icon">卷</span><div><small>CUSTOM PAPERS</small><h2>自主组卷</h2><p>${state.customPapers.length ? `已保存 ${state.customPapers.length} 份试卷` : "按题型和章节创建专属试卷"}</p></div><b>→</b></a>
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
  const descriptions = {"单选题":"每题只有一个正确答案","多选题":"每题有两个或以上正确答案","判断题":"判断表述是否正确","B型题":"使用共用备选答案作答"};
  const types = unique(questions.map(q => q.type));
  app.innerHTML = `${pageHeader("选择题型", "第一步：可同时选择多个题型")}<section class="type-grid selectable-grid">${types.map(type => `<button class="type-card selectable-card" data-value="${escapeHtml(type)}"><span class="select-mark">✓</span><span class="type-symbol">${type[0]}</span><h2>${type}</h2><p>${descriptions[type]}</p><strong>${questions.filter(q=>q.type===type).length} 题</strong></button>`).join("")}</section><div class="selection-bar"><span id="selection-count">请选择题型</span><button id="selection-next" class="primary" disabled>下一步：选择章节</button></div>`;
  setupSelection(selected => { location.hash = `type-chapters?types=${encodeURIComponent(selected.join(","))}`; }, "种题型");
}
function renderTypeChapters() {
  const selectedTypes = (params().get("types") || "").split(",").filter(Boolean);
  if (!selectedTypes.length) { location.hash = "types"; return; }
  const eligible = questions.filter(q => selectedTypes.includes(q.type));
  const chapters = unique(eligible.map(q => q.chapter));
  app.innerHTML = `${pageHeader("选择章节", `第二步：已选择 ${selectedTypes.length} 种题型，可多选章节`, "#types")}<section class="choice-grid selectable-grid">${chapters.map((chapter, index) => `<button class="choice-card selectable-card" data-value="${escapeHtml(chapter)}"><span class="choice-number">${String(index + 1).padStart(2,"0")}</span><div><h2>${escapeHtml(chapter)}</h2><p>${eligible.filter(q => q.chapter === chapter).length} 道符合题型的题目</p></div><span class="select-mark">✓</span></button>`).join("")}</section><div class="selection-bar"><span id="selection-count">请选择章节</span><button id="selection-next" class="primary" disabled>建立自主组卷</button></div>`;
  setupSelection(selected => createPaper(selectedTypes, selected), "个章节");
}
function setupSelection(onNext, unit) {
  const selected = [];
  const next = document.querySelector("#selection-next");
  const count = document.querySelector("#selection-count");
  document.querySelector(".selectable-grid").onclick = event => {
    const card = event.target.closest(".selectable-card");
    if (!card) return;
    const value = card.dataset.value;
    const index = selected.indexOf(value);
    if (index >= 0) selected.splice(index, 1); else selected.push(value);
    card.classList.toggle("selected", index < 0);
    count.textContent = selected.length ? `已选择 ${selected.length} ${unit}` : "请至少选择一项";
    next.disabled = !selected.length;
  };
  next.onclick = () => onNext(selected);
}
function createPaper(types, chapters) {
  const paperQuestions = questions.filter(q => types.includes(q.type) && chapters.includes(q.chapter));
  if (!paperQuestions.length) { toast("没有符合条件的题目"); return; }
  const number = state.nextPaperNumber++;
  state.customPapers.push({ id: `paper-${Date.now()}`, name: `自主组卷 ${number}`, types, chapters, questionIds: paperQuestions.map(q => q.id), createdAt: new Date().toISOString() });
  persist();
  location.hash = "papers";
}
function renderPapers() {
  if (!state.customPapers.length) {
    app.innerHTML = `${pageHeader("自主组卷", "按题型和章节建立专属试卷")}<section class="wrong-panel"><span class="empty-mark">卷</span><h2>还没有自主组卷</h2><p>先多选题型，再多选章节，系统会自动保存试卷。</p><a class="primary" href="#types">建立第一份试卷</a></section>`;
    return;
  }
  app.innerHTML = `${pageHeader("自主组卷", `已保存 ${state.customPapers.length} 份试卷`)}<section class="choice-grid paper-grid">${state.customPapers.map((paper, index) => `<a class="choice-card" href="#quiz?paper=${encodeURIComponent(paper.id)}"><span class="choice-number">${String(index + 1).padStart(2,"0")}</span><div><h2>${escapeHtml(paper.name)}</h2><p>${paper.questionIds.length} 题 · ${paper.types.map(escapeHtml).join("、")} · ${paper.chapters.length} 个章节</p></div><span class="arrow">开始 →</span></a>`).join("")}</section><div class="page-actions"><a class="primary" href="#types">＋ 新建自主组卷</a></div>`;
}
function renderWrong() {
  const count = questions.filter(q => state.wrongIds.includes(q.id)).length;
  app.innerHTML = `${pageHeader("错题重练", "答对后自动移出，答错继续保留")}<section class="wrong-panel">${count ? `<span class="wrong-count">${count}</span><h2>道错题等待巩固</h2><p>可以不限次数重复练习，直到全部答对。</p><a class="primary" href="#quiz?wrong=1">开始重练</a>` : `<span class="empty-mark">✓</span><h2>目前没有错题</h2><p>练习时答错的题目会自动出现在这里。</p><a class="secondary" href="#chapters">开始章节练习</a>`}</section>`;
}

function startQuiz() {
  const p = params();
  const paper = p.get("paper") ? state.customPapers.find(item => item.id === p.get("paper")) : null;
  let pool = paper ? questions.filter(q => paper.questionIds.includes(q.id)) : questions.filter(q => (!p.get("chapter") || q.chapter === p.get("chapter")) && (!p.get("type") || q.type === p.get("type")));
  if (p.get("wrong")) pool = pool.filter(q => state.wrongIds.includes(q.id));
  if (!pool.length) { location.hash = p.get("wrong") ? "wrong" : "home"; return; }
  session = { pool, index: 0, selected: [], checked: false, right: 0, wrongMode: Boolean(p.get("wrong")), paperId: paper?.id };
  showQuestion();
}
function showQuestion() {
  const q = session.pool[session.index];
  app.innerHTML = `<section class="question-shell"><div class="quiz-head"><a class="close" href="${session.wrongMode ? "#wrong" : session.paperId ? "#papers" : "#home"}">×</a><div class="progress-track"><div class="progress-fill" style="width:${(session.index + 1) / session.pool.length * 100}%"></div></div><span>${session.index + 1}/${session.pool.length}</span></div>
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
  const repeatLink = session.wrongMode ? "#quiz?wrong=1" : session.paperId ? `#quiz?paper=${encodeURIComponent(session.paperId)}` : "#chapters";
  app.innerHTML = `<section class="result"><span>${rate >= 80 ? "✓" : "↻"}</span><h1>本轮练习完成</h1><p>答对 ${session.right} / ${session.pool.length} 题，正确率 ${rate}%</p><div><a class="secondary" href="${session.paperId ? "#papers" : "#home"}">${session.paperId ? "返回组卷" : "返回首页"}</a><a class="primary" href="${repeatLink}">${session.wrongMode || session.paperId ? "再练一次" : "继续练习"}</a></div></section>`;
}

init().catch(error => {
  console.error(error);
  app.innerHTML = `<section class="wrong-panel"><h2>题库加载失败</h2><p>请通过部署网址或启动脚本访问。</p></section>`;
});
