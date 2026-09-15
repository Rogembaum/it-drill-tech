/* ============================================================================
   Логика тренажёра. Обычно этот файл трогать не нужно:
   вопросы лежат в data/questions.js, кейсы в data/cases.js,
   темы и уровни в data/config.js, строки интерфейса в data/i18n.js,
   переводы содержания в data/en/.
   ============================================================================ */
(function(){
"use strict";

const LEVELS    = window.LEVELS;
const TOPICS    = window.TOPICS;
const PLAN      = window.PLAN;
const QUESTIONS = window.QUESTIONS;
const CASES     = window.CASES;
const LANGS     = window.LANGS || [["ru","RU","ru"]];
const I18N      = window.I18N || { ru: {} };

/* ---------------- язык ---------------- */
const LSK_LANG = "it-drill-lang";
const CODES = LANGS.map(function(l){ return l[0]; });

function pickLang(){
  const url = new URLSearchParams(location.search).get("lang");
  if(url && CODES.indexOf(url) !== -1) return url;
  let saved = null;
  try { saved = localStorage.getItem(LSK_LANG); } catch(e){}
  if(saved && CODES.indexOf(saved) !== -1) return saved;
  const def = (window.SITE && window.SITE.defaultLang) || "ru";
  if(def === "auto"){
    const nav = (navigator.language || "ru").slice(0,2).toLowerCase();
    return CODES.indexOf(nav) !== -1 ? nav : "en";
  }
  return CODES.indexOf(def) !== -1 ? def : CODES[0];
}
let lang = pickLang();

/* словари переводов содержания, заполняются при переключении языка */
let TRQ = {}, TRC = {};

/* строка интерфейса с откатом на русский */
function t(key){
  const d = I18N[lang] || {};
  const v = (d[key] !== undefined) ? d[key] : (I18N.ru || {})[key];
  return v === undefined ? key : v;
}
/* значение вида "строка" либо {ru:…, en:…} */
function loc(v){
  if(v && typeof v === "object" && !Array.isArray(v)) return v[lang] !== undefined ? v[lang] : v.ru;
  return v;
}
function fmt(s, vals){
  return String(s).replace(/\{(\w+)\}/g, function(_, k){ return vals[k]; });
}
function plural(n, forms){
  if(lang === "ru"){
    const m10 = n % 10, m100 = n % 100;
    if(m10 === 1 && m100 !== 11) return forms[0];
    if(m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
    return forms[2];
  }
  return n === 1 ? forms[0] : forms[2];
}

/* перевод поля записи; если перевода нет — русский оригинал */
function f(item, field, dict){
  if(lang === "ru") return item[field];
  const tr = dict[item.key];
  return (tr && tr[field] !== undefined) ? tr[field] : item[field];
}
const fq = function(q, field){ return f(q, field, TRQ); };
const fc = function(c, field){ return f(c, field, TRC); };
function translated(item, dict){ return lang === "ru" || !!dict[item.key]; }
/* сколько записей переведено — от этого зависит, показывать ли плашки RU
   у каждой записи или одну строку сверху */
function covered(list, dict){
  if(lang === "ru") return list.length;
  let n = 0;
  list.forEach(function(x){ if(dict[x.key]) n++; });
  return n;
}

/* ---------------- прогресс ---------------- */
const LSK = "it-drill-marks-v1";
const LSK_OLD = "sre-prep-marks-v1";      // ключ до переименования проекта
let marks = {};
try {
  marks = JSON.parse(localStorage.getItem(LSK) || "null")
       || JSON.parse(localStorage.getItem(LSK_OLD) || "{}") || {};
} catch(e) { marks = {}; }
function save(){ try { localStorage.setItem(LSK, JSON.stringify(marks)); } catch(e){} }

let active = new Set();
let activeLvl = new Set();
let activeTags = new Set();
let onlyGaps = false, onlyUnseen = false, allOpen = false, query = "";
let view = "q";

/* ---------------- вспомогательное ---------------- */
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function inline(s){
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}
function el(id){ return document.getElementById(id); }

const LR = {jun:0, mid:1, sen:2};
const label = {}, abbr = {}, lvlName = {};

function rebuildDicts(){
  TOPICS.forEach(function(x){ label[x[0]] = loc(x[1]); abbr[x[0]] = x[2]; });
  LEVELS.forEach(function(x){ lvlName[x[0]] = loc(x[1]); });
}

/* Идентификаторы не зависят от языка: отметки «+ / ~ / −» остаются
   на месте при переключении RU ↔ EN. */
(function assignIds(){
  const prefix = {};
  TOPICS.forEach(function(x){ prefix[x[0]] = x[2]; });
  const counters = {};
  QUESTIONS.forEach(function(q, i){
    counters[q.t] = (counters[q.t] || 0) + 1;
    q.id = (prefix[q.t] || q.t.toUpperCase().slice(0,3)) + "-" + String(counters[q.t]).padStart(2,"0");
    q.i = i;
  });
  CASES.forEach(function(c, i){
    c.id = "CASE-" + String(i+1).padStart(2,"0");
    c.i = i;
  });
})();

const THIDX = {};
QUESTIONS.forEach(function(q){ (THIDX[q.th] = THIDX[q.th] || []).push(q); });
Object.keys(THIDX).forEach(function(k){
  THIDX[k].sort(function(a,b){ return LR[a.lvl] - LR[b.lvl]; });
});

/* ---------------- загрузка переводов ---------------- */
function loadLang(code, done){
  if(code === "ru"){ TRQ = {}; TRC = {}; return done(); }
  const haveQ = window["QUESTIONS_" + code.toUpperCase()];
  const haveC = window["CASES_" + code.toUpperCase()];
  if(haveQ || haveC){
    TRQ = haveQ || {}; TRC = haveC || {};
    return done();
  }
  let left = 2;
  const next = function(){ if(--left === 0){
    TRQ = window["QUESTIONS_" + code.toUpperCase()] || {};
    TRC = window["CASES_" + code.toUpperCase()] || {};
    done();
  }};
  ["questions","cases"].forEach(function(name){
    const s = document.createElement("script");
    s.src = "data/" + code + "/" + name + ".js";
    s.onload = next;
    s.onerror = next;            // нет файла — работаем с тем, что есть
    document.head.appendChild(s);
  });
}

/* ---------------- отрисовка шапки и панели ---------------- */
function renderChrome(){
  const S = window.SITE || {};
  const put = function(id, text, html){
    const e = el(id); if(!e) return;
    if(html) e.innerHTML = text || ""; else e.textContent = text || "";
  };
  put("brand", S.brand);
  put("siteTitle", loc(S.title));
  put("siteLede", loc(S.lede));
  put("caseLede", loc(S.caseLede));
  put("siteFooter", loc(S.footer), true);
  document.title = (S.brand ? S.brand + " — " : "") + loc(S.title);
  document.documentElement.lang = (LANGS.filter(function(l){ return l[0] === lang; })[0] || [,, "ru"])[2];

  el("plan").innerHTML = PLAN.map(function(p){
    return '<div class="slot"><div class="when">'+esc(loc(p[0]))+'</div>'
         + '<div class="what">'+esc(loc(p[1]))+'</div>'
         + '<div class="how">'+esc(loc(p[2]))+'</div></div>';
  }).join("");

  el("mTotal").textContent  = QUESTIONS.length;
  el("mTotalW").textContent = plural(QUESTIONS.length, t("metaQuestions"));
  el("mCases").textContent  = CASES.length;
  el("mCasesW").textContent = plural(CASES.length, t("metaCases"));
  el("mStorage").innerHTML  = t("metaStorage");
  el("mLv").textContent = LEVELS.map(function(l){
    return QUESTIONS.filter(function(q){ return q.lvl === l[0]; }).length + " " + loc(l[1]).toLowerCase();
  }).join(" · ");

  el("langs").innerHTML = LANGS.map(function(l){
    return '<button class="vbtn" data-lang="'+l[0]+'" aria-pressed="'+(l[0]===lang)+'">'+l[1]+'</button>';
  }).join("");

  el("vQ").childNodes[0].nodeValue = t("viewQuestions") + " ";
  el("vC").childNodes[0].nodeValue = t("viewCases") + " ";
  el("nQ").textContent = QUESTIONS.length;
  el("nC").textContent = CASES.length;

  el("q").placeholder = t("searchPlaceholder");
  el("q").setAttribute("aria-label", t("searchPlaceholder"));
  el("fUnknown").textContent = t("btnGaps");
  el("fUnseen").textContent  = t("btnUnseen");
  el("rnd").textContent      = t("btnRandom");
  el("toggleAll").textContent = allOpen ? t("btnCollapse") : t("btnExpand");
  el("reset").textContent    = t("btnReset");
  el("exportBtn").textContent = t("btnExport");
  el("exportBtn").title       = t("exportTitle");
  el("importLabel").childNodes[0].nodeValue = t("btnImport") + " ";
  el("importLabel").title = t("importTitle");

  el("chips").innerHTML = TOPICS.map(function(x){
    const n = QUESTIONS.filter(function(q){ return q.t === x[0]; }).length;
    return '<button class="chip" data-t="'+x[0]+'" aria-pressed="'+active.has(x[0])+'">'
         + esc(loc(x[1]))+'<span class="n">'+n+'</span></button>';
  }).join("");

  el("lvlchips").innerHTML = '<span class="lab">'+esc(t("levelLabel"))+'</span>'
    + LEVELS.map(function(l){
        const n = QUESTIONS.filter(function(q){ return q.lvl === l[0]; }).length;
        return '<button class="chip" data-l="'+l[0]+'" aria-pressed="'+activeLvl.has(l[0])+'">'
             + esc(loc(l[1]))+'<span class="n">'+n+'</span></button>';
      }).join("");

  const tags = [];
  CASES.forEach(function(c){ const g = fc(c, "tag"); if(tags.indexOf(g) === -1) tags.push(g); });
  el("casechips").innerHTML = tags.map(function(g){
    const n = CASES.filter(function(c){ return fc(c, "tag") === g; }).length;
    return '<button class="chip" data-ct="'+esc(g)+'" aria-pressed="'+activeTags.has(g)+'">'
         + esc(g)+'<span class="n">'+n+'</span></button>';
  }).join("");
}

/* ---------------- вопросы ---------------- */
/* Плашка RU имеет смысл только там, где часть записей уже переведена:
   когда не переведено вообще ничего, она превращается в шум на каждой
   строке, и вместо неё показывается одна строка-предупреждение (#langNote). */
let badgeQ = false, badgeC = false;

function badge(item, dict, on){
  if(!on || translated(item, dict)) return "";
  return '<span class="tag untr" title="'+esc(t("untranslatedTitle"))+'">'+esc(t("untranslated"))+'</span>';
}

/* Строка о состоянии перевода для текущего раздела. */
function drawLangNote(){
  const box = el("langNote");
  if(!box) return;
  if(lang === "ru"){ box.hidden = true; box.textContent = ""; return; }
  const isQ = view === "q";
  const list = isQ ? QUESTIONS : CASES;
  const done = isQ ? covered(QUESTIONS, TRQ) : covered(CASES, TRC);
  const left = list.length - done;
  if(left === 0){ box.hidden = true; box.textContent = ""; return; }
  box.textContent = fmt(t(done === 0 ? "langNoteAll" : "langNotePart"),
                        {n: left, total: list.length});
  box.hidden = false;
}

/* Липкая панель меняет высоту: язык, перенос чипсов, узкий экран.
   Держим её реальную высоту в --barh, иначе переходы по «лесенке»
   и «Случайный» уводят вопрос под панель. */
let barTimer = null;
function syncBarOffset(){
  const bar = document.querySelector(".bar");
  if(!bar) return;
  const h = Math.ceil(bar.getBoundingClientRect().height);
  if(h > 0) document.documentElement.style.setProperty("--barh", h + "px");
}
function syncBarOffsetSoon(){
  clearTimeout(barTimer);
  barTimer = setTimeout(syncBarOffset, 60);
}

function renderQuestions(){
  el("list").innerHTML = QUESTIONS.map(function(q, i){
    const tags = '<span class="lvl '+q.lvl+'">'+esc(lvlName[q.lvl])+'</span>'
      + '<span class="tag">'+esc(label[q.t])+'</span>'
      + (q.hard ? '<span class="tag hard">'+esc(t("tagHard"))+'</span>' : '')
      + badge(q, TRQ, badgeQ);
    return '<article class="item" data-i="'+i+'">'
      + '<div class="ihead">'
      +   '<span class="idx">'+q.id+'</span>'
      +   '<div class="qmain">'
      +     '<p class="qtext" role="button" tabindex="0">'+inline(fq(q,"q"))+'</p>'
      +     '<div class="tags">'+tags
      +       '<span class="marks">'
      +         '<button class="mark" data-v="3" title="'+esc(t("markKnow"))+'" aria-pressed="false">+</button>'
      +         '<button class="mark" data-v="2" title="'+esc(t("markShaky"))+'" aria-pressed="false">~</button>'
      +         '<button class="mark" data-v="1" title="'+esc(t("markUnknown"))+'" aria-pressed="false">−</button>'
      +       '</span>'
      +     '</div>'
      +   '</div>'
      + '</div>'
      + '<div class="body"></div>'
    + '</article>';
  }).join("");
}

function ladderHTML(q){
  const sib = (THIDX[q.th] || []).filter(function(x){ return x.i !== q.i; });
  if(!sib.length) return "";
  const up   = sib.filter(function(x){ return LR[x.lvl] > LR[q.lvl]; });
  const same = sib.filter(function(x){ return LR[x.lvl] === LR[q.lvl]; });
  const down = sib.filter(function(x){ return LR[x.lvl] < LR[q.lvl]; });
  const rows = up.concat(same, down).map(function(x){
    return '<li><span class="lvl '+x.lvl+'">'+esc(lvlName[x.lvl])+'</span>'
      + '<a data-goto="'+x.i+'" tabindex="0">'+inline(fq(x,"q"))+'</a></li>';
  }).join("");
  return '<div class="pane ladder"><p class="h">'+esc(up.length ? t("ladderDeeper") : t("ladderOther"))
       + '</p><ul>'+rows+'</ul></div>';
}

function answerHTML(q){
  const d = fq(q,"d") || [], fu = fq(q,"f") || [], code = fq(q,"code");
  let h = '<div class="ans">';
  h += '<div class="pane short"><p class="h">'+esc(t("paneShort"))+'</p><p>'+inline(fq(q,"a"))+'</p></div>';
  h += '<div class="pane deep"><p class="h">'+esc(t("paneDeep"))+'</p><ul>'
     + d.map(function(x){ return '<li>'+inline(x)+'</li>'; }).join("") + '</ul>';
  if(code) h += '<pre>'+esc(code).replace(/^(#.*)$/gm,'<span class="c">$1</span>')+'</pre>';
  h += '</div>';
  if(fu.length) h += '<div class="pane fu"><p class="h">'+esc(t("paneFollow"))+'</p><ul>'
     + fu.map(function(x){ return '<li>'+inline(x)+'</li>'; }).join("") + '</ul></div>';
  h += ladderHTML(q);
  return h + '</div>';
}

/* ---------------- кейсы ---------------- */
function renderCases(){
  el("caselist").innerHTML = CASES.map(function(c, i){
    return '<article class="case" data-i="'+i+'">'
      + '<div class="chead">'
      +   '<span class="sev '+c.sev+'">'+c.sev+'</span>'
      +   '<span class="cid">'+c.id+'</span>'
      +   '<span class="tag">'+esc(fc(c,"tag"))+'</span>'
      +   badge(c, TRC, badgeC)
      +   '<span class="marks">'
      +     '<button class="mark" data-v="3" title="'+esc(t("caseMarkOk"))+'" aria-pressed="false">+</button>'
      +     '<button class="mark" data-v="1" title="'+esc(t("caseMarkNo"))+'" aria-pressed="false">−</button>'
      +   '</span>'
      + '</div>'
      + '<h3 class="ctitle">'+inline(fc(c,"q"))+'</h3>'
      + '<p class="sym">'+inline(fc(c,"sym"))+'</p>'
      + '<pre>'+esc(fc(c,"out"))+'</pre>'
      + '<button class="btn solve">'+esc(t("caseSolve"))+'</button>'
      + '<div class="cbox"></div>'
    + '</article>';
  }).join("");
}

function caseHTML(c){
  return '<div class="cbody">'
    + '<div class="pane"><p class="h">'+esc(t("paneHyp"))+'</p><ol>'
    +   (fc(c,"hyp")||[]).map(function(x){ return '<li>'+inline(x)+'</li>'; }).join("") + '</ol></div>'
    + '<div class="pane"><p class="h">'+esc(t("paneDiag"))+'</p><pre>'+esc(fc(c,"diag"))+'</pre></div>'
    + '<div class="pane cause"><p class="h">'+esc(t("paneCause"))+'</p><p>'+inline(fc(c,"cause"))+'</p></div>'
    + '<div class="pane"><p class="h">'+esc(t("paneFix"))+'</p><ul>'
    +   (fc(c,"fix")||[]).map(function(x){ return '<li>'+inline(x)+'</li>'; }).join("") + '</ul></div>'
    + '<div class="pane trap"><p class="h">'+esc(t("paneTrap"))+'</p><p>'+inline(fc(c,"trap"))+'</p></div>'
  + '</div>';
}

/* ---------------- отметки и прогресс ---------------- */
function paintMarks(node, item){
  node.querySelectorAll(".mark").forEach(function(b){
    b.setAttribute("aria-pressed", marks[item.id] === +b.dataset.v ? "true" : "false");
  });
}
function paintAllMarks(){
  document.querySelectorAll("#list .item").forEach(function(n){ paintMarks(n, QUESTIONS[+n.dataset.i]); });
  document.querySelectorAll("#caselist .case").forEach(function(n){ paintMarks(n, CASES[+n.dataset.i]); });
}

function drawProgress(){
  el("progress").innerHTML = TOPICS.map(function(x){
    const qs = QUESTIONS.filter(function(q){ return q.t === x[0]; });
    const c = {1:0,2:0,3:0};
    qs.forEach(function(q){ if(marks[q.id]) c[marks[q.id]]++; });
    const n = qs.length || 1;
    const pct = function(v){ return (v/n*100).toFixed(2)+"%"; };
    return '<div class="pcell"><div class="plabel"><span>'+esc(loc(x[1]))+'</span>'
      + '<span>'+c[3]+'/'+qs.length+'</span></div>'
      + '<div class="pbar"><i class="s3" style="width:'+pct(c[3])+'"></i>'
      + '<i class="s2" style="width:'+pct(c[2])+'"></i>'
      + '<i class="s1" style="width:'+pct(c[1])+'"></i></div></div>';
  }).join("");
}

/* ---------------- фильтрация ---------------- */
function open(node, on){
  const q = QUESTIONS[+node.dataset.i];
  const body = node.querySelector(".body");
  if(on && !body.innerHTML) body.innerHTML = answerHTML(q);
  else if(!on) body.innerHTML = "";
}

function apply(){
  let shown = 0;
  document.querySelectorAll("#list .item").forEach(function(node){
    const q = QUESTIONS[+node.dataset.i];
    let ok = (active.size === 0 || active.has(q.t));
    if(ok && activeLvl.size) ok = activeLvl.has(q.lvl);
    if(ok && onlyGaps)   ok = (marks[q.id] === 1 || marks[q.id] === 2);
    if(ok && onlyUnseen) ok = !marks[q.id];
    if(ok && query){
      const hay = [fq(q,"q"), fq(q,"a"), (fq(q,"d")||[]).join(" "),
                   (fq(q,"f")||[]).join(" "), fq(q,"code")||"", q.q, q.a].join(" ").toLowerCase();
      ok = hay.indexOf(query) !== -1;
    }
    node.classList.toggle("hidden", !ok);
    if(ok) shown++;
  });
  el("count").textContent = fmt(t("shown"), {n: shown, total: QUESTIONS.length});
  const empty = el("emptyMsg");
  if(shown === 0 && !empty){
    const d = document.createElement("div");
    d.id = "emptyMsg"; d.className = "empty"; d.textContent = t("emptyFilter");
    el("list").appendChild(d);
  } else if(shown > 0 && empty){ empty.remove(); }

  document.querySelectorAll("#caselist .case").forEach(function(node){
    const c = CASES[+node.dataset.i];
    node.classList.toggle("hidden", activeTags.size > 0 && !activeTags.has(fc(c,"tag")));
  });
}

/* ---------------- полная перерисовка ---------------- */
function renderAll(){
  rebuildDicts();
  const doneQ = covered(QUESTIONS, TRQ), doneC = covered(CASES, TRC);
  badgeQ = lang !== "ru" && doneQ > 0 && doneQ < QUESTIONS.length;
  badgeC = lang !== "ru" && doneC > 0 && doneC < CASES.length;
  renderChrome();
  renderQuestions();
  renderCases();
  paintAllMarks();
  drawProgress();
  drawLangNote();
  allOpen = false;
  el("toggleAll").setAttribute("aria-pressed","false");
  el("toggleAll").textContent = t("btnExpand");
  apply();
  syncBarOffsetSoon();
}

function setLang(code){
  if(code === lang) return;
  lang = code;
  try { localStorage.setItem(LSK_LANG, code); } catch(e){}
  loadLang(code, function(){
    activeTags.clear();          // теги кейсов языкозависимы
    renderAll();
  });
}

/* ---------------- события ---------------- */
el("langs").addEventListener("click", function(e){
  const b = e.target.closest("[data-lang]"); if(!b) return;
  setLang(b.dataset.lang);
});

el("chips").addEventListener("click", function(e){
  const b = e.target.closest(".chip"); if(!b) return;
  const x = b.dataset.t;
  if(active.has(x)) active.delete(x); else active.add(x);
  b.setAttribute("aria-pressed", active.has(x) ? "true" : "false");
  apply();
});

el("lvlchips").addEventListener("click", function(e){
  const b = e.target.closest(".chip"); if(!b) return;
  const x = b.dataset.l;
  if(activeLvl.has(x)) activeLvl.delete(x); else activeLvl.add(x);
  b.setAttribute("aria-pressed", activeLvl.has(x) ? "true" : "false");
  apply();
});

el("casechips").addEventListener("click", function(e){
  const b = e.target.closest(".chip"); if(!b) return;
  const x = b.dataset.ct;
  if(activeTags.has(x)) activeTags.delete(x); else activeTags.add(x);
  b.setAttribute("aria-pressed", activeTags.has(x) ? "true" : "false");
  apply();
});

function jumpTo(i){
  const node = document.querySelectorAll("#list .item")[i];
  if(node.classList.contains("hidden")){
    active.clear(); activeLvl.clear(); onlyGaps = false; onlyUnseen = false; query = "";
    el("q").value = "";
    el("chips").querySelectorAll(".chip").forEach(function(b){ b.setAttribute("aria-pressed","false"); });
    el("lvlchips").querySelectorAll(".chip").forEach(function(b){ b.setAttribute("aria-pressed","false"); });
    el("fUnknown").setAttribute("aria-pressed","false");
    el("fUnseen").setAttribute("aria-pressed","false");
    apply();
  }
  open(node, true);
  syncBarOffset();
  node.scrollIntoView({behavior:"smooth", block:"start"});
  node.querySelector(".qtext").focus();
}

el("list").addEventListener("click", function(e){
  const g = e.target.closest("[data-goto]");
  if(g){ e.preventDefault(); jumpTo(+g.dataset.goto); return; }
  const m = e.target.closest(".mark");
  if(m){
    const node = m.closest(".item"), q = QUESTIONS[+node.dataset.i], v = +m.dataset.v;
    marks[q.id] = (marks[q.id] === v) ? 0 : v;
    save(); paintMarks(node, q); drawProgress();
    if(onlyGaps || onlyUnseen) apply();
    return;
  }
  const x = e.target.closest(".qtext");
  if(x){ const node = x.closest(".item"); open(node, !node.querySelector(".ans")); }
});

el("list").addEventListener("keydown", function(e){
  if(e.key !== "Enter" && e.key !== " ") return;
  if(e.target.hasAttribute("data-goto")){ e.preventDefault(); jumpTo(+e.target.dataset.goto); return; }
  if(e.target.classList.contains("qtext")){
    e.preventDefault();
    const node = e.target.closest(".item"); open(node, !node.querySelector(".ans"));
  }
});

el("caselist").addEventListener("click", function(e){
  const m = e.target.closest(".mark");
  if(m){
    const node = m.closest(".case"), c = CASES[+node.dataset.i], v = +m.dataset.v;
    marks[c.id] = (marks[c.id] === v) ? 0 : v;
    save(); paintMarks(node, c);
    return;
  }
  const b = e.target.closest(".solve");
  if(b){
    const node = b.closest(".case"), box = node.querySelector(".cbox");
    if(box.innerHTML){ box.innerHTML = ""; b.textContent = t("caseSolve"); }
    else { box.innerHTML = caseHTML(CASES[+node.dataset.i]); b.textContent = t("caseHide"); }
  }
});

el("views").addEventListener("click", function(e){
  const b = e.target.closest(".vbtn"); if(!b) return;
  view = b.dataset.v;
  Array.prototype.forEach.call(this.children, function(x){
    x.setAttribute("aria-pressed", x.dataset.v === view ? "true" : "false");
  });
  const isQ = view === "q";
  // lvlchips здесь обязателен: уровни относятся только к вопросам,
  // в разделе кейсов эти чипсы ни на что не влияют.
  ["chips","lvlchips","q","fUnknown","fUnseen","rnd","toggleAll","progress","count","list"]
    .forEach(function(id){ el(id).hidden = !isQ; });
  el("casechips").hidden = isQ;
  el("casewrap").hidden = isQ;
  drawLangNote();
  syncBarOffsetSoon();
  window.scrollTo({top:0, behavior:"smooth"});
});

el("q").addEventListener("input", function(e){ query = e.target.value.trim().toLowerCase(); apply(); });

el("fUnknown").addEventListener("click", function(e){
  onlyGaps = !onlyGaps; e.currentTarget.setAttribute("aria-pressed", onlyGaps?"true":"false");
  if(onlyGaps){ onlyUnseen = false; el("fUnseen").setAttribute("aria-pressed","false"); }
  apply();
});
el("fUnseen").addEventListener("click", function(e){
  onlyUnseen = !onlyUnseen; e.currentTarget.setAttribute("aria-pressed", onlyUnseen?"true":"false");
  if(onlyUnseen){ onlyGaps = false; el("fUnknown").setAttribute("aria-pressed","false"); }
  apply();
});
el("toggleAll").addEventListener("click", function(e){
  allOpen = !allOpen;
  e.currentTarget.setAttribute("aria-pressed", allOpen?"true":"false");
  e.currentTarget.textContent = allOpen ? t("btnCollapse") : t("btnExpand");
  document.querySelectorAll("#list .item").forEach(function(n){
    if(!n.classList.contains("hidden")) open(n, allOpen);
  });
});
el("rnd").addEventListener("click", function(){
  const vis = Array.prototype.filter.call(
    document.querySelectorAll("#list .item"), function(n){ return !n.classList.contains("hidden"); });
  if(!vis.length) return;
  const node = vis[Math.floor(Math.random()*vis.length)];
  document.querySelectorAll("#list .item").forEach(function(n){ open(n, false); });
  allOpen = false;
  el("toggleAll").setAttribute("aria-pressed","false");
  el("toggleAll").textContent = t("btnExpand");
  syncBarOffset();
  node.scrollIntoView({behavior:"smooth", block:"start"});
  node.querySelector(".qtext").focus();
});
el("reset").addEventListener("click", function(){
  if(!confirm(t("confirmReset"))) return;
  marks = {}; save(); paintAllMarks(); drawProgress(); apply();
});

/* ---------------- перенос прогресса ---------------- */
el("exportBtn").addEventListener("click", function(){
  const payload = { format: "it-drill-progress", version: 1, savedAt: new Date().toISOString(), marks: marks };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "it-drill-progress-" + new Date().toISOString().slice(0,10) + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
});
el("importFile").addEventListener("change", function(e){
  const file = e.target.files && e.target.files[0]; if(!file) return;
  const r = new FileReader();
  r.onload = function(){
    try {
      const data = JSON.parse(r.result);
      const m = data && data.marks;
      if(!m || typeof m !== "object") throw new Error(t("importNoMarks"));
      let n = 0;
      Object.keys(m).forEach(function(k){ if(m[k]){ marks[k] = m[k]; n++; } });
      save(); paintAllMarks(); drawProgress(); apply();
      alert(fmt(t("importedN"), {n: n}));
    } catch(err){
      alert(fmt(t("importFailed"), {err: err.message}));
    }
    e.target.value = "";
  };
  r.readAsText(file);
});

/* ---------------- старт ---------------- */
window.addEventListener("resize", syncBarOffsetSoon);
/* шрифты подгружаются после первой отрисовки и меняют высоту панели */
if(document.fonts && document.fonts.ready) document.fonts.ready.then(syncBarOffset);

loadLang(lang, renderAll);

})();
