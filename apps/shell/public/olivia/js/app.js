/* =========================================================
   Olivia · Lógica de la app
   ========================================================= */

const STORE = {
  due: "olivia_due_date",
  name: "olivia_baby_name",
  prep: "olivia_prep_done",
  journal: "olivia_journal",
  tipSeed: "olivia_tip_seed",
};

const DEFAULT_DUE = "2026-08-05";
const DEFAULT_NAME = "Olivia";
const PREGNANCY_DAYS = 280; // 40 semanas

/* ---------- Utilidades de fecha ---------- */
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}
function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/* ---------- Estado ---------- */
function getDue() {
  const v = localStorage.getItem(STORE.due) || DEFAULT_DUE;
  return startOfDay(new Date(v + "T00:00:00"));
}
function getName() {
  return localStorage.getItem(STORE.name) || DEFAULT_NAME;
}

/* ---------- Cálculos del embarazo ---------- */
function computeProgress() {
  const today = startOfDay(new Date());
  const due = getDue();
  const conception = new Date(due);
  conception.setDate(conception.getDate() - PREGNANCY_DAYS);

  const elapsed = daysBetween(conception, today);          // días desde la concepción estimada
  const daysLeft = Math.max(daysBetween(today, due), 0);   // días hasta la fecha esperada
  const gestDays = Math.min(Math.max(elapsed, 0), 294);    // hasta 42 semanas
  const week = Math.floor(gestDays / 7);
  const dayInWeek = gestDays % 7;
  const pct = Math.min(Math.max((gestDays / PREGNANCY_DAYS) * 100, 0), 100);
  const trimester = week < 14 ? 1 : week < 28 ? 2 : 3;

  return { today, due, week, dayInWeek, daysLeft, pct, trimester, gestDays };
}

/* ---------- Selector pseudoaleatorio estable por día ---------- */
function dailyIndex(arrLength, offset = 0) {
  const today = new Date();
  const seed = dayOfYear(today) + today.getFullYear() * 366 + offset;
  return seed % arrLength;
}

/* ---------- Render principal ---------- */
function renderHero(p) {
  const name = getName();
  document.querySelector(".brand-text h1").textContent = name;

  document.getElementById("weekNumber").textContent = p.week;
  document.getElementById("weekDetail").textContent =
    `${p.week} semanas y ${p.dayInWeek} día${p.dayInWeek === 1 ? "" : "s"}`;

  document.getElementById("daysLeft").textContent = p.daysLeft;
  document.getElementById("trimester").textContent = `${p.trimester}°`;

  const due = p.due;
  document.getElementById("dueDateLabel").textContent = `${due.getDate()} ${MONTHS[due.getMonth()]}`;

  const pct = Math.round(p.pct);
  document.getElementById("ringPct").textContent = `${pct}%`;
  const ring = document.getElementById("ringProgress");
  const r = 52;
  const circ = 2 * Math.PI * r;
  ring.style.strokeDasharray = `${circ}`;
  ring.style.strokeDashoffset = `${circ * (1 - pct / 100)}`;
}

function renderDaily() {
  const today = new Date();
  document.getElementById("todayDate").textContent =
    `${DAYS_LONG[today.getDay()]} ${today.getDate()} ${MONTHS[today.getMonth()]}`;

  const extra = parseInt(localStorage.getItem(STORE.tipSeed) || "0", 10);
  const tip = DAILY_TIPS[(dailyIndex(DAILY_TIPS.length) + extra) % DAILY_TIPS.length];
  const quote = QUOTES[(dailyIndex(QUOTES.length, 7) + extra) % QUOTES.length];

  document.getElementById("dailyTip").textContent = tip;
  document.getElementById("dailyQuote").textContent = `“${quote}”`;
}

function renderWeek(p) {
  const name = getName();
  // Buscar la semana exacta o la más cercana hacia atrás
  let wk = p.week;
  while (wk > 3 && !WEEKS[wk]) wk--;
  const data = WEEKS[wk] || WEEKS[40];

  document.getElementById("weekSizePill").textContent = `Tamaño: ${data.size}`;
  document.getElementById("weekBaby").textContent = data.baby.replace(/Olivia/g, name);
  document.getElementById("weekMom").textContent = data.mom;

  const ul = document.getElementById("weekDad");
  ul.innerHTML = "";
  data.dad.forEach((d) => {
    const li = document.createElement("li");
    li.textContent = d.replace(/Olivia/g, name);
    ul.appendChild(li);
  });
}

/* ---------- Aprendé (lecciones) ---------- */
function renderLessons() {
  const name = getName();
  const idx = dailyIndex(LESSONS.length, 3);
  const lesson = LESSONS[idx];

  // Lección del día
  document.getElementById("lessonCat").textContent = lesson.cat;
  document.getElementById("lessonTitle").textContent = lesson.title;
  const body = document.getElementById("lessonBody");
  body.innerHTML = "";
  lesson.body.forEach((para) => {
    const p = document.createElement("p");
    p.className = "lesson-para";
    p.textContent = para.replace(/Olivia/g, name);
    body.appendChild(p);
  });
  if (lesson.points && lesson.points.length) {
    const ul = document.createElement("ul");
    ul.className = "lesson-points";
    lesson.points.forEach((pt) => {
      const li = document.createElement("li");
      li.textContent = pt;
      ul.appendChild(li);
    });
    body.appendChild(ul);
  }

  // Biblioteca completa (acordeón agrupado por categoría)
  const lib = document.getElementById("lessonLibrary");
  lib.innerHTML = "";
  const cats = [...new Set(LESSONS.map((l) => l.cat))];
  cats.forEach((cat) => {
    const group = document.createElement("div");
    group.className = "lib-group";
    const h = document.createElement("h4");
    h.className = "lib-cat";
    h.textContent = cat;
    group.appendChild(h);

    LESSONS.filter((l) => l.cat === cat).forEach((l) => {
      const det = document.createElement("details");
      det.className = "lib-item";
      const sum = document.createElement("summary");
      sum.textContent = l.title;
      det.appendChild(sum);
      const wrap = document.createElement("div");
      wrap.className = "lib-body";
      l.body.forEach((para) => {
        const p = document.createElement("p");
        p.textContent = para.replace(/Olivia/g, name);
        wrap.appendChild(p);
      });
      if (l.points && l.points.length) {
        const ul = document.createElement("ul");
        l.points.forEach((pt) => {
          const li = document.createElement("li");
          li.textContent = pt;
          ul.appendChild(li);
        });
        wrap.appendChild(ul);
      }
      det.appendChild(wrap);
      group.appendChild(det);
    });
    lib.appendChild(group);
  });
}

function toggleLibrary() {
  const lib = document.getElementById("lessonLibrary");
  const btn = document.getElementById("toggleLibBtn");
  const open = lib.classList.toggle("open");
  btn.textContent = open ? "Ocultar biblioteca ▲" : "Ver todas las lecciones ▼";
}

/* ---------- Checklist de preparativos ---------- */
function getPrepDone() {
  try {
    return JSON.parse(localStorage.getItem(STORE.prep) || "{}");
  } catch {
    return {};
  }
}
function renderPrep() {
  const done = getPrepDone();
  const ul = document.getElementById("prepList");
  ul.innerHTML = "";
  let count = 0;
  PREP.forEach((item, i) => {
    const li = document.createElement("li");
    li.className = "prep-item" + (done[i] ? " done" : "");
    li.innerHTML = `
      <span class="prep-box">${done[i] ? "✓" : ""}</span>
      <span>
        <span class="prep-label">${item.text}</span>
        <span class="prep-tri">${item.tri}</span>
      </span>`;
    li.addEventListener("click", () => {
      const d = getPrepDone();
      d[i] = !d[i];
      localStorage.setItem(STORE.prep, JSON.stringify(d));
      renderPrep();
    });
    if (done[i]) count++;
    ul.appendChild(li);
  });
  document.getElementById("checkProgress").textContent = `${count}/${PREP.length} listo`;
}

/* ---------- Diario / notas ---------- */
function getJournal() {
  try {
    return JSON.parse(localStorage.getItem(STORE.journal) || "[]");
  } catch {
    return [];
  }
}
function renderJournal() {
  const list = getJournal();
  const ul = document.getElementById("journalList");
  ul.innerHTML = "";
  list.forEach((entry, i) => {
    const li = document.createElement("li");
    li.className = "journal-entry";
    const d = new Date(entry.ts);
    li.innerHTML = `
      <button class="je-del" title="Borrar" data-i="${i}">×</button>
      <div class="je-date">${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}</div>
      <div class="je-text"></div>`;
    li.querySelector(".je-text").textContent = entry.text;
    li.querySelector(".je-del").addEventListener("click", () => {
      const arr = getJournal();
      arr.splice(i, 1);
      localStorage.setItem(STORE.journal, JSON.stringify(arr));
      renderJournal();
    });
    ul.appendChild(li);
  });
}
function saveJournal() {
  const ta = document.getElementById("journalText");
  const text = ta.value.trim();
  if (!text) return;
  const arr = getJournal();
  arr.unshift({ ts: Date.now(), text });
  localStorage.setItem(STORE.journal, JSON.stringify(arr));
  ta.value = "";
  const status = document.getElementById("journalStatus");
  status.textContent = "Guardado 💛";
  setTimeout(() => (status.textContent = ""), 2000);
  renderJournal();
}

/* ---------- Ajustes ---------- */
function openSettings() {
  document.getElementById("dueDateInput").value =
    localStorage.getItem(STORE.due) || DEFAULT_DUE;
  document.getElementById("babyNameInput").value = getName();
  document.getElementById("settingsModal").hidden = false;
}
function closeSettings() {
  document.getElementById("settingsModal").hidden = true;
}
function saveSettings() {
  const due = document.getElementById("dueDateInput").value;
  const name = document.getElementById("babyNameInput").value.trim() || DEFAULT_NAME;
  if (due) localStorage.setItem(STORE.due, due);
  localStorage.setItem(STORE.name, name);
  closeSettings();
  renderAll();
}

/* ---------- Init ---------- */
function renderAll() {
  const p = computeProgress();
  renderHero(p);
  renderDaily();
  renderWeek(p);
  renderLessons();
  renderPrep();
  renderJournal();
}

document.addEventListener("DOMContentLoaded", () => {
  renderAll();

  document.getElementById("settingsBtn").addEventListener("click", openSettings);
  document.getElementById("closeSettingsBtn").addEventListener("click", closeSettings);
  document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
  document.getElementById("settingsModal").addEventListener("click", (e) => {
    if (e.target.id === "settingsModal") closeSettings();
  });

  document.getElementById("saveJournalBtn").addEventListener("click", saveJournal);
  document.getElementById("toggleLibBtn").addEventListener("click", toggleLibrary);

  document.getElementById("newTipBtn").addEventListener("click", () => {
    const cur = parseInt(localStorage.getItem(STORE.tipSeed) || "0", 10);
    localStorage.setItem(STORE.tipSeed, String(cur + 1));
    renderDaily();
  });
});
