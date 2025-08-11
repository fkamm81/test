/* Parlez Avec Amour — single-file app logic.
   All data lives in localStorage.
*/
(() => {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ---------- State ----------
  const STATE_KEY = "fr_amour_v1";
  const startState = () => ({
    name: "",
    theme: "provence",
    hardMode: false,
    packs: WORD_PACKS.map(p => p.id), // all enabled by default
    streak: 0,
    lastStudyDate: null,
    xpToday: 0,
    xpHistory: {}, // { '2025-08-11': 40, ... }
    level: 1,
    SRS: {}, // { 'bonjour': { due: '2025-08-12', interval:1, ease:2.5 } }
    // simple counters
    totals: { reviews: 0, correct: 0, wrong: 0 }
  });

  const loadState = () => {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return startState();
      const s = JSON.parse(raw);
      return { ...startState(), ...s };
    } catch {
      return startState();
    }
  };
  const saveState = () => localStorage.setItem(STATE_KEY, JSON.stringify(state));

  let state = loadState();

  // Day handling in user's local time
  const todayStr = () => new Date().toISOString().slice(0,10);
  const ensureDay = () => {
    const today = todayStr();
    if (state.lastStudyDate !== today) {
      // update streak: if yesterday == lastStudyDate, +1; else reset
      if (state.lastStudyDate) {
        const last = new Date(state.lastStudyDate);
        const diff = (new Date(today) - last) / (1000*3600*24);
        state.streak = (diff <= 2 && diff >= 1) ? (state.streak+1) : 1;
      } else {
        state.streak = 1;
      }
      state.xpToday = 0;
      state.lastStudyDate = today;
      saveState();
    }
  };
  ensureDay();

  // ---------- Derived data ----------
  const activeDeck = () => {
    const enabled = new Set(state.packs);
    return WORD_PACKS.filter(p => enabled.has(p.id)).flatMap(p => p.entries.map(e => ({...e, pack:p.id})));
  };

  // ---------- UI Helpers ----------
  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function updateHeader() {
    $("#streak").textContent = state.streak;
    $("#xpToday").textContent = state.xpToday;
    $("#level").textContent = state.level;

    // progress ring: out of 60 XP goal/day
    const goal = 60;
    const circ = 339.292;
    const ratio = Math.min(1, state.xpToday/goal);
    $("#xpRing").style.strokeDashoffset = String(circ * (1 - ratio));
  }

  function addXP(n) {
    ensureDay();
    const today = todayStr();
    state.xpToday += n;
    state.xpHistory[today] = (state.xpHistory[today] || 0) + n;
    // simple level curve
    const totalXP = Object.values(state.xpHistory).reduce((a,b)=>a+b,0);
    state.level = 1 + Math.floor(totalXP / 400);
    saveState();
    updateHeader();
  }

  function normalise(s) {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu,"")
      .replace(/['’`´]/g,"")
      .replace(/[^a-zA-Z0-9 ]/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function choice(arr, n) {
    const copy = [...arr];
    for (let i=copy.length-1; i>0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return n ? copy.slice(0,n) : copy;
  }

  // ---------- Flashcards (SRS) ----------
  const deckSelect = $("#deckSelect");
  WORD_PACKS.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id; opt.textContent = p.name;
    deckSelect.appendChild(opt);
  });

  function getDeckEntries(deckId) {
    return WORD_PACKS.find(p => p.id===deckId)?.entries || [];
  }

  let currentDeck = deckSelect.value || WORD_PACKS[0].id;
  deckSelect.value = currentDeck;

  let queue = [];
  function buildQueue() {
    const entries = getDeckEntries(currentDeck);
    // prioritise items due in SRS, then random new ones
    const today = todayStr();
    const due = [];
    const fresh = [];
    for (const e of entries) {
      const key = `${e.fr}|${e.en}`;
      const s = state.SRS[key];
      if (s && s.due <= today) due.push(e); else fresh.push(e);
    }
    queue = [...choice(due), ...choice(fresh)];
  }

  function gradeCard(grade, card) {
    // SM-2-ish lite
    const key = `${card.fr}|${card.en}`;
    const s = state.SRS[key] || { interval: 0, ease: 2.3 };
    let q;
    if (grade === "again") q = 2;
    if (grade === "good") q = state.hardMode ? 3 : 4;
    if (grade === "easy") q = state.hardMode ? 4 : 5;
    s.ease = Math.max(1.3, s.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    if (q < 3) {
      s.interval = 0;
    } else if (s.interval === 0) {
      s.interval = 1;
    } else if (s.interval === 1) {
      s.interval = 3;
    } else {
      s.interval = Math.round(s.interval * s.ease);
    }
    const next = new Date();
    next.setDate(next.getDate() + (grade==="again" ? 0 : s.interval));
    s.due = next.toISOString().slice(0,10);
    state.SRS[key] = s;
    state.totals.reviews += 1;
    if (grade === "again") state.totals.wrong += 1; else state.totals.correct += 1;
    saveState();
    addXP(grade === "easy" ? 8 : grade === "good" ? 6 : 2);
  }

  const fcEl = $("#flashcard");
  let fcIndex = 0;
  let fcData = [];

  function renderFlashcard() {
    if (queue.length === 0) buildQueue();
    if (fcIndex >= queue.length) fcIndex = 0;
    const item = queue[fcIndex];
    $("#cardFront").textContent = item.fr;
    $("#cardBack").textContent = item.en;
    $("#cardHint").textContent = item.hint || "";
    fcEl.classList.remove("flipped");
    fcData = item;
  }

  fcEl.addEventListener("click", () => fcEl.classList.toggle("flipped"));
  fcEl.addEventListener("keydown", (e) => { if (e.code === "Space") { e.preventDefault(); fcEl.click(); } });

  $$(".fc-actions .btn").forEach(btn => {
    btn.addEventListener("click", () => {
      gradeCard(btn.dataset.grade, fcData);
      fcIndex++;
      renderFlashcard();
    });
  });

  $("#shuffleDeck").addEventListener("click", () => { buildQueue(); fcIndex = 0; renderFlashcard(); addXP(1); });
  $("#speakCard").addEventListener("click", () => {
    speak(fcData?.fr || $("#cardFront").textContent);
  });
  deckSelect.addEventListener("change", (e) => { currentDeck = e.target.value; buildQueue(); fcIndex=0; renderFlashcard(); });

  // ---------- Quiz ----------
  const quizDeckChip = $("#quizDeckChip");
  const quizModeChip = $("#quizModeChip");
  const quizQ = $("#quizQuestion");
  const quizOpts = $("#quizOptions");
  const nextQBtn = $("#nextQuestion");

  let quizPool = activeDeck();

  function newQuestion() {
    quizPool = activeDeck();
    const mode = Math.random() < 0.5 ? "fr2en" : "en2fr";
    quizModeChip.textContent = mode === "fr2en" ? "FR → EN" : "EN → FR";
    const sample = choice(quizPool, 4);
    const answer = sample[0];
    quizDeckChip.textContent = "Mixed";
    if (mode === "fr2en") {
      quizQ.textContent = `Le mot « ${answer.fr} » signifie…`;
      renderOptions(sample.map(x => x.en), answer.en);
    } else {
      quizQ.textContent = `Translate: ${answer.en}`;
      renderOptions(sample.map(x => x.fr), answer.fr);
    }
  }

  function renderOptions(options, correct) {
    quizOpts.innerHTML = "";
    choice(options).forEach(opt => {
      const div = document.createElement("button");
      div.className = "quiz-option";
      div.textContent = opt;
      div.addEventListener("click", () => {
        const ok = normalise(opt) === normalise(correct);
        div.classList.add(ok ? "correct" : "wrong");
        addXP(ok ? 6 : 0);
      }, { once: true });
      quizOpts.appendChild(div);
    });
  }
  nextQBtn.addEventListener("click", newQuestion);

  // ---------- Listening ----------
  const listeningDeck = $("#listeningDeck");
  WORD_PACKS.forEach(p => {
    const o = document.createElement("option"); o.value=p.id; o.textContent=p.name; listeningDeck.appendChild(o);
  });
  const playAudio = $("#playAudio");
  const listenInput = $("#listenInput");
  const listenFeedback = $("#listenFeedback");
  $("#checkListen").addEventListener("click", () => {
    const entries = getDeckEntries(listeningDeck.value);
    const target = choice(entries,1)[0];
    const user = listenInput.value;
    if (!user) { listenFeedback.textContent = "Type what you heard."; return; }
    const ok = normalise(user) === normalise(target.fr);
    listenFeedback.textContent = ok ? `Correct: ${target.fr}` : `Not quite. It was: ${target.fr}`;
    listenFeedback.className = "feedback " + (ok ? "ok" : "no");
    addXP(ok ? 7 : 2);
  });
  playAudio.addEventListener("click", () => {
    const entries = getDeckEntries(listeningDeck.value);
    const word = choice(entries,1)[0].fr;
    speak(word);
  });

  // ---------- Speaking ----------
  const speakPrompt = $("#speakPrompt");
  const speakResult = $("#speakResult");
  $("#startSpeak").addEventListener("click", async () => {
    // choose a random word
    const entries = activeDeck();
    const w = choice(entries,1)[0];
    speakPrompt.textContent = w.fr;
    // speech recognition (webkit)
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      speakResult.textContent = "Speech recognition not supported in this browser.";
      speakResult.className = "feedback no";
      return;
    }
    const sr = new SR();
    sr.lang = "fr-FR";
    sr.interimResults = false;
    sr.maxAlternatives = 1;
    sr.onresult = (e) => {
      const heard = e.results[0][0].transcript || "";
      const ok = normalise(heard) === normalise(w.fr);
      speakResult.textContent = ok ? `Great! You said: “${heard}”.` : `Heard “${heard}”, expected “${w.fr}”`;
      speakResult.className = "feedback " + (ok ? "ok" : "no");
      addXP(ok ? 10 : 3);
    };
    sr.onerror = () => {
      speakResult.textContent = "Recognition error — try again.";
      speakResult.className = "feedback no";
    };
    sr.start();
  });

  // ---------- Matching ----------
  const matchDeck = $("#matchDeck");
  WORD_PACKS.forEach(p => {
    const o = document.createElement("option"); o.value=p.id; o.textContent=p.name; matchDeck.appendChild(o);
  });
  const colFr = $("#matchColFr");
  const colEn = $("#matchColEn");
  let selection = { fr: null, en: null };

  function renderMatch() {
    const entries = choice(getDeckEntries(matchDeck.value), 6);
    colFr.innerHTML = ""; colEn.innerHTML = "";
    entries.forEach(e => {
      const a = document.createElement("div"); a.className="token"; a.textContent=e.fr; a.dataset.key=e.en;
      a.addEventListener("click", () => selectToken(a, "fr"));
      colFr.appendChild(a);
      const b = document.createElement("div"); b.className="token"; b.textContent=e.en; b.dataset.key=e.en;
      b.addEventListener("click", () => selectToken(b, "en"));
      colEn.appendChild(b);
    });
    selection = { fr:null, en:null };
    $("#matchFeedback").textContent = "";
  }

  function selectToken(el, side) {
    $$(".token.selected").forEach(t => t.classList.remove("selected"));
    el.classList.add("selected");
    selection[side] = el;
    if (selection.fr && selection.en) {
      const ok = selection.fr.dataset.key === selection.en.dataset.key;
      $("#matchFeedback").textContent = ok ? "Matched!" : "Not a match.";
      $("#matchFeedback").className = "feedback " + (ok ? "ok" : "no");
      if (ok) {
        selection.fr.style.opacity=.4; selection.en.style.opacity=.4;
        addXP(6);
      }
      selection = { fr:null, en:null };
    }
  }

  $("#newMatch").addEventListener("click", renderMatch);
  matchDeck.addEventListener("change", renderMatch);

  // ---------- Writing ----------
  const writeDeck = $("#writeDeck");
  WORD_PACKS.forEach(p => {
    const o = document.createElement("option"); o.value=p.id; o.textContent=p.name; writeDeck.appendChild(o);
  });
  const writePrompt = $("#writePrompt");
  const writeInput = $("#writeInput");
  const writeFeedback = $("#writeFeedback");

  function newWrite() {
    const entries = getDeckEntries(writeDeck.value);
    const item = choice(entries,1)[0];
    writePrompt.textContent = item.en;
    writeInput.value = "";
    writeInput.focus();
  }
  $("#newWrite").addEventListener("click", newWrite);
  $("#checkWrite").addEventListener("click", () => {
    const entries = getDeckEntries(writeDeck.value);
    const targetFr = entries.find(e => e.en === writePrompt.textContent)?.fr || "";
    const ok = normalise(writeInput.value) === normalise(targetFr);
    writeFeedback.textContent = ok ? "Perfect!" : `It should be: ${targetFr}`;
    writeFeedback.className = "feedback " + (ok ? "ok" : "no");
    addXP(ok ? 7 : 2);
  });

  // ---------- Progress ----------
  const progressCards = $("#progressCards");
  const achievements = $("#achievements");

  function renderProgress() {
    progressCards.innerHTML = "";
    const totalXP = Object.values(state.xpHistory).reduce((a,b)=>a+b,0);
    const cards = [
      { label: "Total XP", value: totalXP },
      { label: "Cards reviewed", value: state.totals.reviews },
      { label: "Accuracy", value: (state.totals.reviews ? Math.round(100*state.totals.correct/state.totals.reviews) : 0) + "%" },
    ];
    cards.forEach(c => {
      const div = document.createElement("div");
      div.className = "pcard";
      div.innerHTML = `<div class="big">${c.value}</div><div class="muted">${c.label}</div>`;
      progressCards.appendChild(div);
    });

    achievements.innerHTML = "";
    const badges = [];
    if (state.streak >= 3) badges.push("🔥 3-day streak");
    if (state.streak >= 7) badges.push("🔥🔥 7-day streak");
    if (totalXP >= 400) badges.push("🏅 Level 2 reached");
    if (totalXP >= 1200) badges.push("🥇 Bronze Scholar");
    if (state.totals.reviews >= 100) badges.push("📚 100 reviews");
    badges.forEach(b => {
      const span = document.createElement("span");
      span.className = "badge";
      span.textContent = b;
      achievements.appendChild(span);
    });

    drawXPChart();
  }

  function drawXPChart() {
    const canvas = $("#xpChart");
    const ctx = canvas.getContext("2d");
    // clear
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const days = 14;
    const labels = [];
    const values = [];
    for (let i=days-1;i>=0;i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0,10);
      labels.push(key.slice(5));
      values.push(state.xpHistory[key] || 0);
    }
    // compute scale
    const w = canvas.width, h = canvas.height;
    const pad = 24;
    const maxV = Math.max(60, Math.max(...values, 10));
    const xStep = (w - pad*2) / (days-1);
    const y = v => h - pad - (v / maxV) * (h - pad*2);

    // axes
    ctx.globalAlpha = .4;
    ctx.beginPath();
    ctx.moveTo(pad, pad); ctx.lineTo(pad, h-pad); ctx.lineTo(w-pad, h-pad);
    ctx.strokeStyle = "#ffffff"; ctx.stroke();
    ctx.globalAlpha = 1;

    // line
    ctx.beginPath();
    values.forEach((v,i) => {
      const x = pad + i*xStep;
      const yy = y(v);
      if (i===0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    });
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    // points
    values.forEach((v,i) => {
      const x = pad + i*xStep;
      const yy = y(v);
      ctx.beginPath(); ctx.arc(x, yy, 3.5, 0, Math.PI*2);
      ctx.fillStyle = "#ffffff"; ctx.fill();
    });
  }

  // ---------- Settings ----------
  const themeSelect = $("#themeSelect");
  const nameInput = $("#nameInput");
  const hardMode = $("#hardMode");
  const packsEl = $("#packs");
  WORD_PACKS.forEach(p => {
    const wrap = document.createElement("label");
    wrap.className = "pack";
    wrap.innerHTML = `<input type="checkbox" data-pack="${p.id}"> ${p.name}`;
    packsEl.appendChild(wrap);
  });

  function populateSettings() {
    themeSelect.value = state.theme;
    nameInput.value = state.name || "";
    hardMode.checked = state.hardMode;
    $$("#packs input[type=checkbox]").forEach(cb => {
      cb.checked = state.packs.includes(cb.dataset.pack);
    });
    setTheme(state.theme);
  }

  themeSelect.addEventListener("change", e => {
    state.theme = e.target.value; setTheme(state.theme); saveState();
  });
  nameInput.addEventListener("input", e => { state.name = e.target.value.slice(0,40); saveState(); });
  hardMode.addEventListener("change", e => { state.hardMode = !!e.target.checked; saveState(); });
  packsEl.addEventListener("change", e => {
    if (e.target.matches("input[type=checkbox]")) {
      const id = e.target.dataset.pack;
      if (e.target.checked) { if (!state.packs.includes(id)) state.packs.push(id); }
      else { state.packs = state.packs.filter(x => x !== id); }
      saveState();
    }
  });

  // Export/Import
  $("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "french-progress.json"; a.click();
    URL.revokeObjectURL(url);
  });
  $("#importBtn").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        state = { ...startState(), ...obj }; saveState();
        populateSettings(); updateHeader(); renderAll();
        alert("Progress imported!");
      } catch { alert("Invalid file."); }
    };
    reader.readAsText(file);
  });

  // ---------- Speech Synthesis ----------
  function speak(text) {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const fr = voices.find(v => v.lang.startsWith("fr"));
    if (fr) u.voice = fr;
    u.lang = "fr-FR";
    speechSynthesis.speak(u);
  }
  // Some browsers load voices asynchronously
  window.speechSynthesis?.addEventListener("voiceschanged", () => {});

  // ---------- Navigation ----------
  $$(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const id = btn.dataset.tab;
      $$(".panel").forEach(p => p.classList.remove("active"));
      $("#"+id).classList.add("active");
      if (id === "progress") renderProgress();
    });
  });

  // ---------- Initial render ----------
  function renderAll() {
    buildQueue();
    renderFlashcard();
    newQuestion();
    renderMatch();
    newWrite();
    renderProgress();
  }
  populateSettings();
  updateHeader();
  renderAll();

  // ---------- Keyboard shortcuts ----------
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    if (e.key === " ") { e.preventDefault(); fcEl.click(); }
    if (["1","2","3"].includes(e.key)) {
      const map = { "1":"again","2":"good","3":"easy" };
      const b = $(`.fc-actions .btn.${map[e.key]}`); b?.click();
    }
  });
})();
