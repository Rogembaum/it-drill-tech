/* ============================================================================
   Лаба CKA: обзор, задачи, пробный экзамен, вопросы, скорость, день экзамена.
   Данные — labs/cka/data.js (собирается tools/build-lab-cka.py).
   ============================================================================ */
(function(){
"use strict";

const K = window.LabKit, D = window.LAB_DATA.cka;
const esc = K.esc, inl = K.inl, md = K.md, code = K.code, cmd = K.cmd, fmt = K.fmt, plural = K.plural;
const TASKS = D.tasks, QUIZ = D.quiz, SPEED = D.speed, DOCS = D.docs;

const KEY = "it-drill-lab-cka-v1";
const KIT = "labs/cka/cka-lab.zip";
const EXAM_MIN = 120, PASS = 66;
const DOMS = [
  {id:"trbl", name:"Диагностика", short:"Диагностика", w:30, q:5},
  {id:"arch", name:"Архитектура, установка и конфигурация", short:"Архитектура", w:25, q:4},
  {id:"net",  name:"Сервисы и сеть", short:"Сеть", w:20, q:3},
  {id:"work", name:"Нагрузки и планирование", short:"Нагрузки", w:15, q:3},
  {id:"stor", name:"Хранилище", short:"Хранилище", w:10, q:1}
];
const SPT = {base:"Основа kubectl", work:"Нагрузки", arch:"Архитектура и кластер", net:"Сеть", trbl:"Диагностика"};
const DM = {}, TBY = {};
DOMS.forEach(function(d){ DM[d.id] = d; });
TASKS.forEach(function(t){ TBY[t.id] = t; });
/* ответы и карточки привязаны к тексту, а не к позиции: пересборка данных их не перепутает */
QUIZ.forEach(function(q){ q.k = K.hash(q.q); });
SPEED.forEach(function(c){ c.k = K.hash(c.q); });
const QBY = {}, SBY = {};
QUIZ.forEach(function(q){ QBY[q.k] = q; });
SPEED.forEach(function(c){ SBY[c.k] = c; });

const ST = K.store(KEY, function(){ return {labs:{}, quiz:{}, sp:{}, exams:[], ex:null, ui:{}}; });
const S = ST.data;
["labs","quiz","sp","ui"].forEach(function(k){ S[k] = S[k] || {}; });
S.exams = S.exams || [];
function save(){ ST.save(); }

/* ---------- общее ---------- */
function docLink(k){
  const d = DOCS[k]; if(!d) return "";
  return '<a href="'+esc(d[1])+'" target="_blank" rel="noopener noreferrer">'+esc(d[0])+'</a>';
}
function hostLabel(t){ return t.host === "workstation" ? "ваша машина · kubectl · контекст kind-cka" : "узел " + t.host; }
function labSt(id){ return (S.labs[id] || {}).st || ""; }
function setLab(id, st, r){ const o = S.labs[id] || {}; o.st = st; if(r) o.r = r; o.ts = Date.now(); S.labs[id] = o; save(); }
function pill(text, cls){ return '<span class="lx-pill'+(cls ? " "+cls : "")+'">'+text+'</span>'; }
function bar(pct, ok){ return '<div class="lx-bar"><i class="'+(ok ? "ok" : "")+'" style="width:'+pct+'%"></i></div>'; }
function chips(items, attr, cur){
  return '<div class="chips">' + items.map(function(x){
    return '<button class="chip" data-'+attr+'="'+x[0]+'" aria-pressed="'+(cur === x[0])+'">'+esc(x[1])+'<span class="n">'+x[2]+'</span></button>';
  }).join("") + '</div>';
}
function seg(items, attr, cur, label){
  return '<div class="views lx-seg" role="group" aria-label="'+esc(label)+'">' + items.map(function(x){
    return '<button class="vbtn" data-'+attr+'="'+x[0]+'" aria-pressed="'+(cur === x[0])+'">'+esc(x[1])+'</button>';
  }).join("") + '</div>';
}
function parseResult(text){
  const res = {}; let score = null;
  String(text).replace(/\x1b\[[0-9;]*m/g, "").split(/\r?\n/).forEach(function(l){
    const m = l.match(/RESULT\s+(T\d{2})\s+(\d+)\/(\d+)/); if(m) res[m[1]] = [+m[2], +m[3]];
    const s = l.match(/^\s*SCORE\s+(\d+)/); if(s) score = +s[1];
  });
  return {res: res, score: score};
}
function histRows(list){
  return '<div class="lx-hist">' + list.map(function(e){
    return '<div class="lx-h"><span class="lx-muted">'+K.dateStr(e.ts)+'</span><span class="lx-s">'+e.score+'%</span>'+bar(e.score, e.score >= PASS)+'</div>';
  }).join("") + '</div>';
}

/* ---------- выбор задач для экзамена, как ./cka exam ---------- */
function pickExam(seed){
  const r = K.rng(seed);
  const pool = K.shuffle(TASKS.filter(function(t){ return !t.manual && !t.online && !t.heavy && !t.noexam; }), r);
  const q = {}; DOMS.forEach(function(d){ q[d.id] = d.q; });
  const picked = [], keys = new Set(), conf = new Set(); let brk = null;
  pool.forEach(function(t){
    if(q[t.dom] <= 0) return;
    if(t.breaks && brk) return;
    if(t.conflicts.some(function(c){ return keys.has(c); }) || conf.has(t.key)) return;
    q[t.dom]--; keys.add(t.key); t.conflicts.forEach(function(c){ conf.add(c); });
    if(t.breaks) brk = t.id; else picked.push(t.id);
  });
  if(brk) picked.push(brk);
  return picked;
}
function newSeed(){ return Math.floor(Math.random() * 1e9); }
function running(){ return !!(S.ex && S.ex.start && !S.ex.end); }

/* ---------- ОБЗОР ---------- */
function vHome(){
  const per = DOMS.map(function(d){
    const ts = TASKS.filter(function(t){ return t.dom === d.id && !t.manual; });
    const ok = ts.filter(function(t){ return labSt(t.id) === "ok"; }).length;
    let qa = 0, qc = 0;
    QUIZ.filter(function(q){ return q.t === d.id; }).forEach(function(q){ const a = S.quiz[q.k]; if(a){ qa++; if(a.last) qc++; } });
    return {d: d, n: ts.length, ok: ok, qa: qa, qc: qc};
  });
  const tot = TASKS.filter(function(t){ return !t.manual; }).length;
  const okAll = per.reduce(function(s, p){ return s + p.ok; }, 0);
  const last = S.exams[S.exams.length-1];
  const next = TASKS.find(function(t){ return !t.manual && !labSt(t.id); });
  return ''
  + '<section class="lx-card lx-hero">'
  +   '<div class="eyebrow">Certified Kubernetes Administrator · программа v1.35</div>'
  +   '<h2 class="lx-h2">Лаба CKA</h2>'
  +   '<p>Экзамен целиком практический: 2 часа, терминал и кластеры. Здесь '+TASKS.length+' задач в формате экзамена — условие на английском, как на экзамене, с переводом, стенд в kind, который сам готовит сценарий и проверяет результат, разбор и ловушки. К ним пробный экзамен с таймером, '+QUIZ.length+' вопросов на понимание и '+SPEED.length+' карточек на скорость команд.</p>'
  +   '<div class="lx-row">'
  +     (next ? '<button class="btn lx-primary" data-open="'+next.id+'">Продолжить: '+next.id+'</button>' : '')
  +     '<button class="btn" data-go="exam">Пробный экзамен</button>'
  +     '<button class="btn" data-go="day">Что настроить в день экзамена</button>'
  +   '</div>'
  + '</section>'
  + '<div class="lx-facts">'
  +   [["120 мин","на весь экзамен, онлайн с прокторингом"],["15–20","практических задач, у каждой свой вес"],
       ["66%","проходной балл, частичные баллы засчитываются"],["v1.35","версия Kubernetes в текущей программе CNCF"],
       ["1 + 2","бесплатная пересдача и две сессии killer.sh"],[okAll+"/"+tot,"задач лабы решено у вас"]]
      .map(function(f){ return '<div class="lx-fact"><b>'+f[0]+'</b><span>'+f[1]+'</span></div>'; }).join("")
  + '</div>'
  + '<div class="lx-grid2">'
  +   '<section class="lx-card">'
  +     '<div class="lx-row lx-between"><h3 class="lx-h3">Домены и ваш прогресс</h3>'+pill("вес в экзамене")+'</div>'
  +     '<div class="lx-tablewrap"><table class="lx-table"><thead><tr><th>Вес</th><th>Домен</th><th class="lx-hide-sm">Задачи</th><th>Решено</th><th class="lx-hide-sm">Вопросы</th></tr></thead><tbody>'
  +       per.map(function(p){
            return '<tr><td class="lx-num">'+p.d.w+'%</td>'
              + '<td><button class="lx-link" data-dom="'+p.d.id+'">'+esc(p.d.name)+'</button></td>'
              + '<td class="lx-num lx-hide-sm">'+p.ok+'/'+p.n+'</td>'
              + '<td style="width:28%">'+bar(p.n ? Math.round(p.ok/p.n*100) : 0, p.ok === p.n)+'</td>'
              + '<td class="lx-num lx-hide-sm">'+(p.qa ? Math.round(p.qc/p.qa*100)+"%" : "—")+'</td></tr>';
          }).join("")
  +     '</tbody></table></div>'
  +     '<p class="lx-src">Домены и веса — <a href="https://github.com/cncf/curriculum" target="_blank" rel="noopener noreferrer">CNCF curriculum</a> (CKA, v1.35). Формат и правила экзамена проверьте перед регистрацией на <a href="https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/" target="_blank" rel="noopener noreferrer">странице Linux Foundation</a>: они меняются.</p>'
  +   '</section>'
  +   '<section class="lx-card">'
  +     '<h3 class="lx-h3">Последний пробный экзамен</h3>'
  +     (last
        ? '<div class="lx-row" style="align-items:baseline;gap:14px"><span class="lx-score '+(last.score >= PASS ? "ok" : "bad")+'">'+last.score+'%</span>'
          + '<span class="lx-muted">'+K.dateStr(last.ts)+' · '+plural(last.n, ["задача","задачи","задач"])+' · '+(last.src === "grade" ? "по ./cka grade" : "по самооценке")+'</span></div>'
          + histRows(S.exams.slice(-6).reverse())
        : '<p class="lx-muted">Пока не было. Начните с 10–15 отдельных задач, затем проходите пробный экзамен раз в два-три дня: 16 случайных задач по весам доменов, 120 минут, проверка одной командой.</p>'
          + '<div><button class="btn" data-go="exam">Сгенерировать набор</button></div>')
  +   '</section>'
  + '</div>'
  + '<section class="lx-card">'
  +   '<h3 class="lx-h3">Стенд на вашей машине</h3>'
  +   '<ol class="lx-steps">'
  +     '<li><p>Нужны Docker (Docker Desktop, OrbStack или Engine; 4 CPU и 6 ГБ памяти), <code>kind</code>, <code>kubectl</code>, <code>helm</code>. На Windows — WSL2.</p>'
  +       '<div class="lx-row"><a class="btn lx-primary" href="'+KIT+'" download>Скачать cka-lab.zip</a></div></li>'
  +     '<li><p>Распакуйте и поднимите кластер: 1 control plane, 2 worker, metrics-server, Gateway API и Traefik. Занимает 3–6 минут.</p>'
  +       code("unzip cka-lab.zip && cd cka-lab\n./cka up\n./cka list")+'</li>'
  +     '<li><p>Решайте задачу и проверяйте. Проверка смотрит на результат, а не на способ, и даёт частичный балл, как экзамен.</p>'
  +       code("./cka start T14      # готовит сценарий и печатает условие\n./cka check T14      # ✔/✘ по каждому критерию и строка RESULT T14 p/t\n./cka solve T14      # эталонное решение, если застряли")+'</li>'
  +     '<li><p>Узловые задачи выполняются «по ssh»: <code>./cka ssh cka-control-plane</code>. Внутри — systemd, kubelet, static pod и <code>/etc/kubernetes</code>, как на ВМ с kubeadm.</p></li>'
  +   '</ol>'
  +   '<p class="lx-src">Обновление кластера через kubeadm в kind честно не воспроизвести — для этой темы есть разбор (задача T13) и ссылка на бесплатные сценарии killercoda.</p>'
  + '</section>';
}

/* ---------- ЗАДАЧИ ---------- */
function labFilter(){ return S.ui.lf || {dom:"all", st:"all"}; }
function vTasks(){
  const f = labFilter();
  const list = TASKS.filter(function(t){
    if(f.dom !== "all" && t.dom !== f.dom) return false;
    if(f.st === "todo") return labSt(t.id) !== "ok";
    if(f.st === "done") return labSt(t.id) === "ok";
    return true;
  });
  const cur = (S.ui.task && TBY[S.ui.task]) || list[0] || TASKS[0];
  const cnt = function(d){ return TASKS.filter(function(t){ return d === "all" || t.dom === d; }).length; };
  return '<div class="lx-split">'
  + '<aside class="lx-card lx-listcard" aria-label="Список задач">'
  +   chips([["all","Все",cnt("all")]].concat(DOMS.map(function(d){ return [d.id, d.short, cnt(d.id)]; })), "lf-dom", f.dom)
  +   seg([["all","все"],["todo","не решены"],["done","решены"]], "lf-st", f.st, "Статус")
  +   '<div class="lx-tlist">' + (list.map(function(t){
        const meta = DM[t.dom].short+' · '+t.w+'% · ≤ '+t.min+' мин'+(t.node ? " · узел" : "")+(t.manual ? " · разбор" : "")+(t.online ? " · онлайн" : "");
        return '<button class="lx-titem" data-open="'+t.id+'" aria-current="'+(t.id === cur.id)+'">'
          + '<span class="lx-dot '+labSt(t.id)+'" aria-hidden="true"></span>'
          + '<span class="lx-tt">'+esc(t.title)+'<small>'+meta+'</small></span>'
          + '<span class="lx-id">'+t.id+'</span></button>';
      }).join("") || '<p class="lx-muted lx-small">В этом фильтре задач нет.</p>') + '</div>'
  + '</aside>'
  + '<article class="lx-card lx-lab">'+taskDetail(cur)+'</article>'
  + '</div>';
}
function statement(t){
  const ru = !!S.ui.ru;
  return '<section>'
    + '<div class="lx-row lx-between"><h4 class="lx-h4">Условие</h4>'
    +   seg([["0","EN как на экзамене"],["1","EN + перевод"]], "ru", ru ? "1" : "0", "Язык условия")+'</div>'
    + '<div class="lx-prose">'+md(t.en)+'</div>'
    + (ru ? '<div class="lx-prose lx-ru">'+md(t.ru)+'</div>' : '')
    + '</section>';
}
function hostLine(t){
  return '<div class="lx-host"><span class="k">Где:</span> '+esc(hostLabel(t))
    + (t.host !== "workstation" ? ' <span class="k">·</span> <code>./cka ssh '+esc(t.host)+'</code> <span class="k">(на экзамене: ssh)</span>' : '')
    + '</div>';
}
function taskDetail(t){
  const L = S.labs[t.id] || {};
  const lt = S.ui.lt && S.ui.lt.id === t.id ? S.ui.lt : null;
  const stName = {ok:"решено", part:"частично", fail:"не решено"}, stCls = {ok:"ok", part:"warn", fail:"bad"};
  const i = TASKS.indexOf(t), prev = TASKS[i-1], next = TASKS[i+1];
  return ''
  + '<div class="lx-row lx-between" style="align-items:flex-start">'
  +   '<div class="lx-titlebox"><div class="eyebrow">'+t.id+' · '+esc(DM[t.dom].name)+'</div><h3 class="lx-h2">'+esc(t.title)+'</h3></div>'
  +   '<div class="lx-row">'+pill("вес "+t.w+"%", "acc")+pill("цель ≤ "+t.min+" мин")
  +     (L.st ? pill(stName[L.st]+(L.r ? " · "+L.r : ""), stCls[L.st]) : "")+'</div>'
  + '</div>'
  + hostLine(t)
  + (t.manual
    ? '<div class="lx-fb"><b>Сценарий вне kind</b><span>Обновление kubeadm в kind не воспроизвести: тренируйтесь на <a href="https://killercoda.com/killer-shell-cka" target="_blank" rel="noopener noreferrer">killercoda.com/killer-shell-cka</a> или на двух своих ВМ. Ниже — порядок действий.</span></div>'
    : '<section><h4 class="lx-h4">Запуск</h4>'+cmd("./cka start "+t.id)
      + (t.online ? '<p class="lx-small lx-muted">Нужен интернет: задача поднимает второй кластер kind-cka-cni и ставит CNI из манифестов с GitHub. В пробный экзамен не входит.</p>' : '')
      + (t.breaks ? '<p class="lx-small lx-muted">Задача ломает кластер. Если сами не починили: <code>./cka reset '+t.id+'</code>.</p>' : '')
      + '</section>')
  + statement(t)
  + (t.manual ? '' :
      '<section><h4 class="lx-h4">Секундомер</h4>'
    + '<div class="lx-timer"><span class="lx-clock '+(lt && (Date.now()-lt.start)/1000 > t.min*60 ? "over" : "")+'" data-clock="lab">'+(lt ? fmt((Date.now()-lt.start)/1000) : "00:00")+'</span>'
    +   '<span class="lx-muted lx-small">цель ≤ '+t.min+':00'+(L.best ? " · лучшее "+fmt(L.best) : "")+'</span><span style="flex:1"></span>'
    +   (lt ? '<button class="btn lx-primary" data-act="lt-stop">Стоп</button><button class="btn" data-act="lt-reset">Сброс</button>'
            : '<button class="btn" data-act="lt-start" data-id="'+t.id+'">Старт</button>')
    + '</div></section>'
    + '<section><h4 class="lx-h4">Результат</h4><div class="lx-result">'
    +   '<div class="lx-row"><input class="lx-input" id="lx-res" placeholder="Вставьте строку RESULT '+t.id+' 4/5 из ./cka check" aria-label="Строка RESULT из ./cka check">'
    +     '<button class="btn" data-act="res-paste" data-id="'+t.id+'">Учесть</button></div>'
    +   '<div class="lx-row"><span class="lx-muted lx-small">или отметьте сами:</span>'
    +     [["ok","Решено","on-ok"],["part","Частично","on-warn"],["fail","Не решено","on-bad"]].map(function(m){
            return '<button class="btn '+(L.st === m[0] ? m[2] : "")+'" data-mark="'+m[0]+'" data-id="'+t.id+'">'+m[1]+'</button>';
          }).join("")
    +     (L.st ? '<button class="btn" data-mark="" data-id="'+t.id+'">Сбросить</button>' : '')
    +   '</div></div></section>')
  + (t.crit.length ? '<details class="lx-fold"><summary>Что проверяет ./cka check '+pill(t.crit.length)+'</summary><div class="lx-inner"><ul class="lx-crit">'
      + t.crit.map(function(c){ return '<li>'+inl(c)+'</li>'; }).join("") + '</ul></div></details>' : '')
  + '<details class="lx-fold"'+(t.manual ? " open" : "")+'><summary>Решение</summary><div class="lx-inner">'
  +   t.sol.map(function(s){
        return '<div class="lx-solstep">'+(s.h ? '<h5>'+inl(s.h)+'</h5>' : '')+(s.c ? code(s.c) : '')+(s.p ? '<p>'+inl(s.p)+'</p>' : '')+'</div>';
      }).join("")
  + '</div></details>'
  + (t.traps.length ? '<details class="lx-fold"><summary>Ловушки</summary><div class="lx-inner"><ul class="lx-traps">'
      + t.traps.map(function(x){ return '<li>'+inl(x)+'</li>'; }).join("") + '</ul></div></details>' : '')
  + (t.docs.length ? '<section><h4 class="lx-h4">Где в документации</h4><div class="lx-docl">'+t.docs.map(docLink).join("")+'</div></section>' : '')
  + '<div class="lx-row lx-between">'
  +   (prev ? '<button class="btn" data-open="'+prev.id+'">← '+prev.id+'</button>' : '<span></span>')
  +   (next ? '<button class="btn" data-open="'+next.id+'">'+next.id+' →</button>' : '<span></span>')
  + '</div>';
}

/* ---------- ПРОБНЫЙ ЭКЗАМЕН ---------- */
function vExam(){
  let E = S.ex;
  if(!E || !E.ids){ E = S.ex = {seed: newSeed()}; E.ids = pickExam(E.seed); save(); }
  if(!E.start) return exIdle(E);
  if(!E.end) return exRun(E);
  return exDone(E);
}
function exIdle(E){
  const ts = E.ids.map(function(id){ return TBY[id]; });
  const wsum = ts.reduce(function(s, t){ return s + t.w; }, 0);
  return '<div class="lx-grid2">'
  + '<section class="lx-card">'
  +   '<div class="eyebrow">Пробный экзамен · набор '+E.seed+'</div>'
  +   '<h3 class="lx-h2">'+plural(ts.length, ["задача","задачи","задач"])+' · 120 минут · порог '+PASS+'%</h3>'
  +   '<p>Набор собран по весам доменов: диагностика 5, архитектура 4, сеть 3, нагрузки 3, хранилище 1. Задача, которая ломает кластер, — не больше одной. Сначала подготовьте стенд, потом запускайте таймер.</p>'
  +   '<ol class="lx-steps">'
  +     '<li><p>Подготовьте все задачи разом (1–3 минуты):</p>'+cmd("./cka exam "+E.ids.join(" "))+'</li>'
  +     '<li><p>Нажмите «Начать». Условия будут здесь, по одному на экран, как в экзаменационном интерфейсе. Решения и ловушки на время экзамена скрыты.</p></li>'
  +     '<li><p>В конце выполните <code>./cka grade</code> и вставьте вывод — лаба посчитает балл с учётом весов.</p></li>'
  +   '</ol>'
  +   '<div class="lx-row"><button class="btn lx-primary" data-act="ex-start">Начать: 120:00</button><button class="btn" data-act="ex-reroll">Другой набор</button></div>'
  + '</section>'
  + '<section class="lx-card">'
  +   '<div class="lx-row lx-between"><h3 class="lx-h3">Состав</h3>'+pill("сумма весов "+wsum)+'</div>'
  +   '<div class="lx-tablewrap"><table class="lx-table"><thead><tr><th>ID</th><th>Домен</th><th class="lx-num">Вес</th></tr></thead><tbody>'
  +     ts.map(function(t){
          return '<tr><td class="lx-mono">'+t.id+'</td><td>'+DM[t.dom].short
            + (t.breaks ? ' '+pill("!", "warn") : '') + (t.node ? ' '+pill("узел") : '')
            + '</td><td class="lx-num">'+t.w+'%</td></tr>';
        }).join("")
  +   '</tbody></table></div>'
  +   '<p class="lx-src">Названия задач появятся после старта, чтобы не подсказывать тему заранее.</p>'
  + '</section>'
  + '</div>' + histCard();
}
function exRun(E){
  const cur = TBY[E.cur] || TBY[E.ids[0]]; E.cur = cur.id;
  const marks = E.marks || {}, flags = E.flags || {};
  const idx = E.ids.indexOf(cur.id);
  const mk = {ok:"on-ok", part:"on-warn", skip:"on-bad"};
  const done = Object.keys(marks).filter(function(k){ return marks[k] === "ok"; }).length;
  const nflags = Object.keys(flags).filter(function(k){ return flags[k]; }).length;
  return '<div class="lx-exgrid">'
  + '<article class="lx-card lx-lab">'
  +   '<div class="lx-row lx-between" style="align-items:flex-start">'
  +     '<div class="lx-titlebox"><div class="eyebrow">Вопрос '+(idx+1)+' из '+E.ids.length+' · '+cur.id+'</div><h3 class="lx-h2">'+esc(cur.title)+'</h3></div>'
  +     '<div class="lx-row">'+pill("вес "+cur.w+"%", "acc")+'<button class="btn '+(flags[cur.id] ? "on-warn" : "")+'" data-act="ex-flag">'+(flags[cur.id] ? "Снять флаг" : "Пометить флагом")+'</button></div>'
  +   '</div>'
  +   hostLine(cur)
  +   statement(cur)
  +   '<section><h4 class="lx-h4">Проверить только эту задачу</h4>'+cmd("./cka check "+cur.id)
  +     '<p class="lx-small lx-muted">На настоящем экзамене такой проверки нет. Пользуйтесь ей экономно — лучше проверяйте результат kubectl-командами.</p></section>'
  +   '<div class="lx-row"><span class="lx-muted lx-small">Ваша оценка:</span>'
  +     [["ok","Сделано"],["part","Частично"],["skip","Пропустил"]].map(function(m){
          return '<button class="btn '+(marks[cur.id] === m[0] ? mk[m[0]] : "")+'" data-exmark="'+m[0]+'">'+m[1]+'</button>';
        }).join("")
  +   '</div>'
  +   '<div class="lx-row lx-between">'
  +     (idx > 0 ? '<button class="btn" data-exgo="'+E.ids[idx-1]+'">← Назад</button>' : '<span></span>')
  +     (idx < E.ids.length-1 ? '<button class="btn lx-primary" data-exgo="'+E.ids[idx+1]+'">Следующий →</button>'
                              : '<button class="btn lx-primary" data-act="ex-finish-ask">Завершить</button>')
  +   '</div>'
  + '</article>'
  + '<aside class="lx-side">'
  +   '<div class="lx-card">'
  +     '<div class="eyebrow">Осталось</div>'
  +     '<div class="lx-bigclock" data-clock="exam">'+fmt(E.start/1000 + EXAM_MIN*60 - Date.now()/1000)+'</div>'
  +     '<div class="lx-bar"><i data-clock="exbar" style="width:0%"></i></div>'
  +     '<div class="lx-nav">'+E.ids.map(function(id, i){
          return '<button class="'+(id === cur.id ? "cur " : "")+(marks[id] || "")+(flags[id] ? " flag" : "")+'" data-exgo="'+id+'" title="'+TBY[id].w+'%">'+(i+1)+'</button>';
        }).join("")+'</div>'
  +     '<div class="lx-muted lx-small">Сделано '+done+' из '+E.ids.length+' · флагов '+nflags+'</div>'
  +     (E.ask
        ? '<div class="lx-confirm"><b>Завершить экзамен?</b><span class="lx-small">Дальше: <code>./cka grade</code> и вставка вывода.</span>'
          + '<div class="lx-row"><button class="btn lx-primary" data-act="ex-finish">Завершить</button><button class="btn" data-act="ex-finish-no">Продолжить</button></div></div>'
        : '<button class="btn" data-act="ex-finish-ask">Завершить экзамен</button>')
  +   '</div>'
  +   '<div class="lx-card lx-small lx-muted">Задача дольше 8–10 минут — флаг и дальше. В конце вернитесь к флагам.</div>'
  + '</aside>'
  + '</div>';
}
function exDone(E){
  const R = E.result;
  if(!R) return '<section class="lx-card">'
    + '<div class="eyebrow">Экзамен завершён'+(E.used ? " · "+fmt(E.used) : "")+'</div>'
    + '<h3 class="lx-h2">Проверьте результат на стенде</h3>'
    + cmd("./cka grade")
    + '<label for="lx-grade" class="lx-small lx-muted">Вставьте сюда весь вывод команды (нужны строки RESULT):</label>'
    + '<textarea class="lx-input lx-paste" id="lx-grade" placeholder="RESULT T42 3/3&#10;RESULT T05 6/6&#10;…&#10;SCORE 72"></textarea>'
    + '<div class="lx-row"><button class="btn lx-primary" data-act="ex-grade">Посчитать</button><button class="btn" data-act="ex-self">Оценить по своим отметкам</button></div>'
    + '</section>' + histCard();
  const rows = E.ids.map(function(id){ const t = TBY[id], r = R.res[id]; return {t: t, r: r, frac: r ? r[0]/r[1] : 0}; });
  const byDom = DOMS.map(function(d){
    const rs = rows.filter(function(x){ return x.t.dom === d.id; });
    const w = rs.reduce(function(s, x){ return s + x.t.w; }, 0), g = rs.reduce(function(s, x){ return s + x.t.w*x.frac; }, 0);
    return {d: d, w: w, g: g, n: rs.length};
  }).filter(function(x){ return x.n; });
  return '<section class="lx-card">'
  + '<div class="lx-row" style="gap:18px;align-items:baseline"><span class="lx-score '+(R.score >= PASS ? "ok" : "bad")+'">'+R.score+'%</span>'
  +   '<span>'+(R.score >= PASS ? "сдано: порог 66% пройден" : "не сдано: до порога "+(PASS - R.score)+" п.")+'</span>'
  +   pill(R.src === "grade" ? "по ./cka grade" : "по самооценке")
  +   '<span class="lx-muted lx-small">'+(E.used ? "время "+fmt(E.used) : "")+'</span></div>'
  + '<div class="lx-grid2">'
  +   '<div class="lx-tablewrap"><table class="lx-table"><thead><tr><th>Задача</th><th class="lx-num">Вес</th><th class="lx-num">Баллы</th><th class="lx-num">Итог</th></tr></thead><tbody>'
  +     rows.map(function(x){
          return '<tr><td><button class="lx-link" data-open="'+x.t.id+'">'+x.t.id+' · '+esc(x.t.title)+'</button></td>'
            + '<td class="lx-num">'+x.t.w+'%</td><td class="lx-num">'+(x.r ? x.r[0]+"/"+x.r[1] : "—")+'</td>'
            + '<td class="lx-num">'+(x.t.w*x.frac).toFixed(1)+'</td></tr>';
        }).join("")
  +   '</tbody></table></div>'
  +   '<div class="lx-stack">'+byDom.map(function(x){
        const p = Math.round(x.g/x.w*100);
        return '<div><div class="lx-row lx-between"><span>'+esc(x.d.short)+'</span><span class="lx-mono">'+p+'%</span></div>'+bar(p, p >= PASS)+'</div>';
      }).join("")
  +     '<p class="lx-src">Разбор задач — по ссылкам в таблице. Задачи с неполным баллом отмечены в списке задач.</p></div>'
  + '</div>'
  + '<div class="lx-row"><button class="btn lx-primary" data-act="ex-new">Новый экзамен</button>'+cmd("./cka exam-reset")+'</div>'
  + '</section>' + histCard();
}
function histCard(){
  if(!S.exams.length) return "";
  return '<section class="lx-card"><h3 class="lx-h3">История</h3>'+histRows(S.exams.slice().reverse())+'</section>';
}
function finishExam(){
  const E = S.ex; E.end = Date.now(); E.used = Math.min(EXAM_MIN*60, (E.end - E.start)/1000); E.ask = false; save(); K.refresh();
}
function scoreFrom(E, res){
  let w = 0, g = 0;
  E.ids.forEach(function(id){ const t = TBY[id], r = res[id]; w += t.w; if(r && r[1]) g += t.w * r[0]/r[1]; });
  return Math.floor(g / w * 100);
}
function commitResult(res, src){
  const E = S.ex, score = scoreFrom(E, res);
  E.result = {res: res, score: score, src: src};
  S.exams.push({ts: Date.now(), score: score, n: E.ids.length, src: src, ids: E.ids});
  E.ids.forEach(function(id){ const r = res[id]; if(r) setLab(id, r[0] === r[1] ? "ok" : r[0] > 0 ? "part" : "fail", r[0]+"/"+r[1]); });
  save(); K.refresh();
}

/* ---------- ВОПРОСЫ ---------- */
let QS = null;
function quizPool(){
  const f = S.ui.qf || "all", only = !!S.ui.qerr;
  return QUIZ.filter(function(q){ return (f === "all" || q.t === f) && (!only || (S.quiz[q.k] && !S.quiz[q.k].last)); });
}
function quizStart(){ QS = {list: K.shuffle(quizPool()).map(function(q){ return q.k; }), pos: 0, sel: null, done: false, right: 0, ans: 0}; }
function isCorrect(q, sel){
  if(sel == null) return false;
  if(q.y === "s") return sel === q.a;
  if(q.y === "m") return q.a.slice().sort().join() === sel.slice().sort().join();
  const n = function(x){ return String(x).trim().toLowerCase().replace(/^["'`«]+|["'`»]+$/g, "").replace(/\s+/g, " ").replace(/\/$/, ""); };
  return String(sel).trim() !== "" && q.a.some(function(a){ return n(a) === n(sel); });
}
function vQuiz(){
  if(!QS) quizStart();
  const f = S.ui.qf || "all";
  const errN = QUIZ.filter(function(q){ return S.quiz[q.k] && !S.quiz[q.k].last; }).length;
  const cnt = function(k){ return QUIZ.filter(function(q){ return k === "all" || q.t === k; }).length; };
  const head = '<div class="lx-row lx-between">'
    + chips([["all","Все",cnt("all")]].concat(DOMS.map(function(d){ return [d.id, d.short, cnt(d.id)]; })), "qf", f)
    + '<button class="chip" data-act="qerr" aria-pressed="'+!!S.ui.qerr+'">Только ошибки<span class="n">'+errN+'</span></button></div>';
  if(!QS.list.length) return head + '<div class="lx-card"><p class="lx-muted">'+(S.ui.qerr ? "Ошибок в этом разделе нет." : "Вопросов нет.")+'</p></div>';
  if(QS.pos >= QS.list.length) return head + '<div class="lx-card"><div class="eyebrow">Серия завершена</div>'
    + '<div class="lx-score">'+QS.right+'/'+QS.ans+'</div><p class="lx-muted">Ошибки собираются в фильтр «Только ошибки».</p>'
    + '<div><button class="btn lx-primary" data-act="q-again">Ещё раз</button></div></div>';
  const q = QBY[QS.list[QS.pos]], done = QS.done, sel = QS.sel;
  let body;
  if(q.y === "o"){
    body = '<div class="lx-row"><input class="lx-input lx-mono" id="lx-open" autocomplete="off" spellcheck="false" placeholder="ответ" value="'+esc(sel || "")+'"'+(done ? " disabled" : "")+' aria-label="Ответ">'
      + '<button class="btn lx-primary" data-act="q-check"'+(done ? " disabled" : "")+'>Проверить</button></div>';
  } else {
    body = '<div class="lx-opts" role="'+(q.y === "s" ? "radiogroup" : "group")+'">' + q.o.map(function(o, i){
      const chosen = q.y === "s" ? sel === i : (sel || []).indexOf(i) !== -1;
      const right = q.y === "s" ? q.a === i : q.a.indexOf(i) !== -1;
      const cls = done ? (right ? "right" : chosen ? "wrong" : "") : "";
      return '<button class="lx-opt '+cls+'" role="'+(q.y === "s" ? "radio" : "checkbox")+'" aria-checked="'+chosen+'" data-opt="'+i+'"'+(done ? " disabled" : "")+'>'
        + '<span class="k">'+"ABCDEFG"[i]+'</span><span>'+inl(o)+'</span></button>';
    }).join("") + '</div>'
    + (done ? '' : '<div><button class="btn lx-primary" data-act="q-check"'+(sel == null || (Array.isArray(sel) && !sel.length) ? " disabled" : "")+'>Проверить</button></div>');
  }
  const ok = done && isCorrect(q, sel);
  const fb = done ? '<div class="lx-fb '+(ok ? "ok" : "bad")+'"><b>'+(ok ? "Верно" : "Неверно")+'</b>'
      + (!ok && q.y === "o" ? '<span>Правильно: <code>'+esc(q.a[0])+'</code></span>' : '')
      + '<span>'+inl(q.e)+'</span>'+(q.d ? '<span class="lx-small">'+docLink(q.d)+'</span>' : '')+'</div>'
      + '<div><button class="btn lx-primary" data-act="q-next">Дальше →</button></div>' : '';
  return head + '<div class="lx-card lx-qcard">'
    + bar(Math.round(QS.pos/QS.list.length*100))
    + '<div class="lx-row lx-between"><span class="eyebrow">'+(QS.pos+1)+' / '+QS.list.length+' · '+DM[q.t].short+'</span>'
    +   '<span class="lx-muted lx-small">'+(q.y === "s" ? "Один ответ" : q.y === "m" ? "Несколько ответов" : "Введите ответ")+'</span></div>'
    + '<div class="lx-qtext">'+inl(q.q)+'</div>'+body+fb+'</div>';
}

/* ---------- СКОРОСТЬ ---------- */
let SPQ = null;
function speedPool(){
  const f = S.ui.sf || "all", only = !!S.ui.sunk;
  return SPEED.filter(function(c){ return (f === "all" || c.t === f) && (!only || S.sp[c.k] !== 1); });
}
function speedStart(){ SPQ = {list: K.shuffle(speedPool()).map(function(c){ return c.k; }), pos: 0, open: false}; }
function vSpeed(){
  if(!SPQ) speedStart();
  const f = S.ui.sf || "all";
  const known = SPEED.filter(function(c){ return S.sp[c.k] === 1; }).length;
  const cnt = function(k){ return SPEED.filter(function(c){ return k === "all" || c.t === k; }).length; };
  const head = '<div class="lx-row lx-between">'
    + chips([["all","Все",cnt("all")]].concat(Object.keys(SPT).map(function(k){ return [k, SPT[k], cnt(k)]; })), "sf", f)
    + '<button class="chip" data-act="sunk" aria-pressed="'+!!S.ui.sunk+'">Только невыученные<span class="n">'+(SPEED.length - known)+'</span></button></div>';
  if(!SPQ.list.length) return head + '<div class="lx-card"><p class="lx-muted">Всё в этом разделе отмечено как выученное.</p></div>';
  if(SPQ.pos >= SPQ.list.length) return head + '<div class="lx-card"><div class="eyebrow">Колода пройдена</div>'
    + '<p>Выучено '+known+' из '+SPEED.length+'. На экзамене каждая секунда на поиск синтаксиса — минус к последней задаче.</p>'
    + '<div><button class="btn lx-primary" data-act="s-again">Перемешать и заново</button></div></div>';
  const c = SBY[SPQ.list[SPQ.pos]];
  return head + '<div class="lx-card lx-qcard">'
    + bar(Math.round(SPQ.pos/SPQ.list.length*100))
    + '<div class="lx-row lx-between"><span class="eyebrow">'+(SPQ.pos+1)+' / '+SPQ.list.length+' · '+SPT[c.t]+'</span>'
    +   '<span class="lx-muted lx-small">наберите по памяти, потом сверьте · <span class="lx-kbd">Ctrl</span>+<span class="lx-kbd">Enter</span> — показать</span></div>'
    + '<div class="lx-qtext">'+inl(c.q)+'</div>'
    + '<textarea class="lx-input lx-try" id="lx-try" spellcheck="false" autocomplete="off" placeholder="kubectl …" aria-label="Ваша команда">'+esc(S.ui.spdraft || "")+'</textarea>'
    + (SPQ.open
      ? code(c.a.trim()) + (c.n ? '<p class="lx-small lx-muted">'+inl(c.n)+'</p>' : '')
        + '<div class="lx-row"><button class="btn on-ok" data-sp="1">Знал</button><button class="btn on-bad" data-sp="0">Не знал</button></div>'
      : '<div><button class="btn lx-primary" data-act="sp-show">Показать ответ</button></div>')
    + '</div>';
}

/* ---------- ДЕНЬ ЭКЗАМЕНА ---------- */
function vDay(){
  const used = new Set();
  TASKS.forEach(function(t){ t.docs.forEach(function(d){ used.add(d); }); });
  const groups = DOMS.map(function(d){
    const keys = [];
    TASKS.filter(function(t){ return t.dom === d.id; }).forEach(function(t){ t.docs.forEach(function(k){ if(keys.indexOf(k) === -1) keys.push(k); }); });
    return {d: d, keys: keys};
  });
  const tip = function(title, items){ return '<section class="lx-card"><h3 class="lx-h3">'+title+'</h3><ul class="lx-list">'+items.map(function(x){ return '<li>'+x+'</li>'; }).join("")+'</ul></section>'; };
  return ''
  + '<section class="lx-card">'
  +   '<div class="eyebrow">Первые две минуты</div>'
  +   '<h3 class="lx-h2">Что набрать в терминале сразу после старта</h3>'
  +   '<p>Алиас <code>k</code> и автодополнение в экзаменационной среде обычно уже настроены — проверьте <code>type k</code>. Остальное занимает минуту и окупается на каждой задаче.</p>'
  +   code("alias k=kubectl                      # если ещё нет\nexport do=\"--dry-run=client -o yaml\"    # k run web --image=nginx $do > web.yaml\nexport now=\"--force --grace-period 0\"   # k delete pod web $now\ncat >> ~/.vimrc <<'EOF'\nset expandtab tabstop=2 shiftwidth=2 autoindent\nEOF")
  +   '<p class="lx-small lx-muted">Узлы, на которые вы заходите по ssh, не наследуют эти настройки — там пишите полные команды.</p>'
  + '</section>'
  + '<div class="lx-grid2">'
  +   tip("Ход экзамена", [
        "Читайте задачу до конца, прежде чем печатать. Имена, порты, пути и namespace — критерии проверки.",
        "У каждой задачи своя команда <code>ssh &lt;хост&gt;</code> в шапке. Выполните её и не забудьте <code>exit</code> перед следующей задачей.",
        "Задача дольше 8–10 минут — флаг и дальше. Средний бюджет: 120 мин ÷ 16 задач ≈ 7 минут.",
        "Сначала задачи с большим весом и понятным решением. Частичный балл лучше нуля: сделайте, что можете.",
        "После каждой задачи проверяйте результат: <code>k get</code>, <code>describe</code>, запрос из временного пода."])
  +   tip("Скорость", [
        "YAML не пишут с нуля: <code>k create … $do</code>, затем правка в vim.",
        "Нужное поле — <code>k explain pod.spec.containers.securityContext</code>, без браузера.",
        "Под с неизменяемыми полями: <code>k edit</code> сохранит копию в /tmp, потом <code>k replace --force -f /tmp/…</code>.",
        "В vim: <code>:set paste</code> перед вставкой — отступы не поплывут.",
        "Копирование в терминале удалённого рабочего стола — <span class=\"lx-kbd\">Ctrl</span>+<span class=\"lx-kbd\">Shift</span>+<span class=\"lx-kbd\">C</span>/<span class=\"lx-kbd\">V</span>."])
  +   tip("Документация на экзамене", [
        "Открыт браузер с доступом к kubernetes.io/docs, kubernetes.io/blog, helm.sh/docs и gateway-api.sigs.k8s.io. Других сайтов нет.",
        "Поиск по docs медленный. Запомните страницы, откуда копировать YAML: их список ниже, по доменам.",
        "Полезнее всего — kubectl Quick Reference: jsonpath, sort-by, field-selector."])
  +   tip("За неделю до экзамена", [
        "Два прогона killer.sh из пакета экзамена: симулятор сложнее реального экзамена, 50–60% там — хороший знак.",
        "Два-три пробных экзамена здесь с результатом выше 80%.",
        "Отдельно прогоните узловые задачи: etcd, kubelet, static pod, сертификаты. Это 30% веса, и их нельзя «подсмотреть».",
        "Проверьте рабочее место по требованиям PSI: один монитор, веб-камера, чистый стол."])
  + '</div>'
  + '<section class="lx-card">'
  +   '<div class="lx-row lx-between"><h3 class="lx-h3">Карта документации по доменам</h3>'+pill(used.size+" страниц из задач")+'</div>'
  +   '<div class="lx-dmap">'
  +     groups.map(function(g){
          return '<div><h4 class="lx-h4">'+esc(g.d.name)+' <span class="lx-muted lx-small">· '+g.d.w+'%</span></h4><ul class="lx-list">'
            + g.keys.map(function(k){ return '<li>'+docLink(k)+'</li>'; }).join("") + '</ul></div>';
        }).join("")
  +     '<div><h4 class="lx-h4">Справочники</h4><ul class="lx-list">'
  +       ["quickref","kubeadm-install","kubeadm-create","ha"].map(function(k){ return '<li>'+docLink(k)+'</li>'; }).join("")
  +     '</ul></div>'
  +   '</div>'
  + '</section>';
}

/* ---------- таймеры ---------- */
function tick(){
  const E = S.ex;
  if(running()){
    const left = E.start/1000 + EXAM_MIN*60 - Date.now()/1000;
    document.querySelectorAll('[data-clock="exam"]').forEach(function(el){ el.textContent = fmt(left); el.classList.toggle("low", left < 900); });
    document.querySelectorAll('[data-clock="tab"]').forEach(function(el){ el.textContent = fmt(left); });
    document.querySelectorAll('[data-clock="exbar"]').forEach(function(el){ el.style.width = Math.min(100, Math.max(0, (1 - left/(EXAM_MIN*60)) * 100)) + "%"; });
    if(left <= 0){ finishExam(); K.toast("Время вышло"); }
  }
  const lt = S.ui.lt;
  if(lt){
    const t = TBY[lt.id], s = (Date.now() - lt.start)/1000;
    document.querySelectorAll('[data-clock="lab"]').forEach(function(el){ el.textContent = fmt(s); el.classList.toggle("over", !!t && s > t.min*60); });
  }
}
setInterval(tick, 1000);

/* ---------- события ---------- */
function openTask(id){
  S.ui.task = id;
  const lf = labFilter();
  if(lf.dom !== "all" && TBY[id].dom !== lf.dom){ lf.dom = "all"; S.ui.lf = lf; }
  save(); K.go("tasks");
  const el = document.querySelector(".lx-lab"); if(el) el.scrollIntoView({block: "start"});
}
function stopwatchBest(id){
  const s = Math.round((Date.now() - S.ui.lt.start)/1000), L = S.labs[id] || {};
  if(!L.best || s < L.best) L.best = s;
  L.last = s; S.labs[id] = L; S.ui.lt = null; save();
  return s;
}

function click(el){
  const d = el.dataset, E = S.ex;
  if(d.go){ K.go(d.go); return; }
  if(d.open){ openTask(d.open); return; }
  if(d.dom){ S.ui.lf = {dom: d.dom, st: "all"}; S.ui.task = TASKS.find(function(t){ return t.dom === d.dom; }).id; save(); K.go("tasks"); return; }
  if(d.lfDom){ const f = labFilter(); f.dom = d.lfDom; S.ui.lf = f; save(); K.refresh(); return; }
  if(d.lfSt){ const f = labFilter(); f.st = d.lfSt; S.ui.lf = f; save(); K.refresh(); return; }
  if(d.ru !== undefined){ S.ui.ru = d.ru === "1"; save(); K.refresh(); return; }
  if(d.mark !== undefined){ if(d.mark) setLab(d.id, d.mark); else { delete S.labs[d.id]; save(); } K.refresh(); return; }
  if(d.qf){ S.ui.qf = d.qf; save(); quizStart(); K.refresh(); return; }
  if(d.sf){ S.ui.sf = d.sf; save(); speedStart(); K.refresh(); return; }
  if(d.opt !== undefined && QS && !QS.done){
    const q = QBY[QS.list[QS.pos]], i = +d.opt;
    if(q.y === "s") QS.sel = i;
    else { const s = new Set(QS.sel || []); if(s.has(i)) s.delete(i); else s.add(i); QS.sel = Array.from(s); }
    K.refresh(); return;
  }
  if(d.sp !== undefined){
    const c = SBY[SPQ.list[SPQ.pos]]; S.sp[c.k] = +d.sp; S.ui.spdraft = ""; save();
    SPQ.pos++; SPQ.open = false; K.refresh();
    const ta = document.getElementById("lx-try"); if(ta) ta.focus();
    return;
  }
  if(d.exgo){ E.cur = d.exgo; save(); K.refresh(); window.scrollTo(0, 0); return; }
  if(d.exmark){ E.marks = E.marks || {}; E.marks[E.cur] = E.marks[E.cur] === d.exmark ? undefined : d.exmark; save(); K.refresh(); return; }
  switch(d.act){
    case "lt-start": S.ui.lt = {id: d.id, start: Date.now()}; save(); K.refresh(); break;
    case "lt-stop": { const id = S.ui.lt.id, s = stopwatchBest(id); K.refresh(); K.toast("Время: " + fmt(s)); break; }
    case "lt-reset": S.ui.lt = null; save(); K.refresh(); break;
    case "res-paste": {
      const p = parseResult(document.getElementById("lx-res").value);
      const r = p.res[d.id] || p.res[Object.keys(p.res)[0]];
      if(!r){ K.toast("Не нашёл строку RESULT"); break; }
      setLab(d.id, r[0] === r[1] ? "ok" : r[0] > 0 ? "part" : "fail", r[0]+"/"+r[1]);
      if(S.ui.lt && S.ui.lt.id === d.id) stopwatchBest(d.id);
      K.refresh(); break;
    }
    case "ex-reroll": E.seed = newSeed(); E.ids = pickExam(E.seed); save(); K.refresh(); break;
    case "ex-start": E.start = Date.now(); E.cur = E.ids[0]; E.marks = {}; E.flags = {}; save(); K.refresh(); break;
    case "ex-flag": E.flags = E.flags || {}; E.flags[E.cur] = !E.flags[E.cur]; save(); K.refresh(); break;
    case "ex-finish-ask": E.ask = true; save(); K.refresh(); break;
    case "ex-finish-no": E.ask = false; save(); K.refresh(); break;
    case "ex-finish": finishExam(); break;
    case "ex-grade": {
      const p = parseResult(document.getElementById("lx-grade").value);
      if(!E.ids.some(function(id){ return p.res[id]; })){ K.toast("В тексте нет строк RESULT для задач этого экзамена"); break; }
      commitResult(p.res, "grade"); break;
    }
    case "ex-self": {
      const res = {};
      E.ids.forEach(function(id){ const m = (E.marks || {})[id]; res[id] = m === "ok" ? [1,1] : m === "part" ? [1,2] : [0,1]; });
      commitResult(res, "self"); break;
    }
    case "ex-new": S.ex = {seed: newSeed()}; S.ex.ids = pickExam(S.ex.seed); save(); K.refresh(); break;
    case "qerr": S.ui.qerr = !S.ui.qerr; save(); quizStart(); K.refresh(); break;
    case "q-check": {
      const q = QBY[QS.list[QS.pos]];
      if(q.y === "o") QS.sel = document.getElementById("lx-open").value;
      if(q.y === "o" && !String(QS.sel).trim()) break;
      QS.done = true;
      const ok = isCorrect(q, QS.sel); QS.ans++; if(ok) QS.right++;
      const a = S.quiz[q.k] || {c: 0, w: 0}; if(ok) a.c++; else a.w++; a.last = ok ? 1 : 0; S.quiz[q.k] = a;
      save(); K.refresh(); break;
    }
    case "q-next": { QS.pos++; QS.sel = null; QS.done = false; K.refresh(); const i = document.getElementById("lx-open"); if(i) i.focus(); break; }
    case "q-again": quizStart(); K.refresh(); break;
    case "sunk": S.ui.sunk = !S.ui.sunk; save(); speedStart(); K.refresh(); break;
    case "sp-show": S.ui.spdraft = (document.getElementById("lx-try") || {}).value || ""; SPQ.open = true; save(); K.refresh(); break;
    case "s-again": speedStart(); K.refresh(); break;
  }
}
function keydown(e){
  const id = e.target.id, click = function(sel){ const b = document.querySelector(sel); if(b) b.click(); };
  if(e.key === "Enter" && id === "lx-open"){ e.preventDefault(); click('[data-act="q-check"]'); }
  if(e.key === "Enter" && id === "lx-res"){ e.preventDefault(); click('[data-act="res-paste"]'); }
  if(e.key === "Enter" && (e.ctrlKey || e.metaKey) && id === "lx-try"){ e.preventDefault(); click('[data-act="sp-show"]'); }
}
function input(e){ if(e.target.id === "lx-try") S.ui.spdraft = e.target.value; }

K.register("cka", {
  sections: [["home","Обзор"],["tasks","Задачи"],["exam","Пробный экзамен"],["quiz","Вопросы"],["speed","Скорость"],["day","День экзамена"]],
  initial: function(sec){ return running() ? "exam" : sec; },
  tab: function(key){ return key === "exam" && running() ? ' <span class="lx-tabclock" data-clock="tab"></span>' : ""; },
  render: function(sec){
    const v = {home: vHome, tasks: vTasks, exam: vExam, quiz: vQuiz, speed: vSpeed, day: vDay}[sec] || vHome;
    const html = v();
    setTimeout(tick, 0);
    return html;
  },
  click: click, keydown: keydown, input: input
});
})();
