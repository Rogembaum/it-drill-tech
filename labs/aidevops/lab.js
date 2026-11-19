/* ============================================================================
   Лаба AI DevOps: обзор, задачи, практикумы, вопросы, экзамен, карьера.
   Данные — labs/aidevops/data.js (собирается tools/build-lab-aidevops.py).
   ============================================================================ */
(function(){
"use strict";

const K = window.LabKit, D = window.LAB_DATA.aidevops;
const esc = K.esc, inl = K.inl, md = K.md, code = K.code, cmd = K.cmd, fmt = K.fmt, plural = K.plural;
const MODS = D.modules, TASKS = D.tasks, QUIZ = D.questions, LABS = D.labs, CERTS = D.certs;

const KEY = "it-drill-lab-aidevops-v1";
const KIT = "labs/aidevops/ai-devops-labs.zip";
const EXAM_PER = 2, PASS = 70;
const MBY = {}, TBY = {}, QBY = {}, LBY = {};
MODS.forEach(function(m){ MBY[m.id] = m; });
TASKS.forEach(function(t){ TBY[t.id] = t; });
QUIZ.forEach(function(q){ QBY[q.id] = q; });
LABS.forEach(function(l){ LBY[l.id] = l; });
const QMODS = MODS.filter(function(m){ return QUIZ.some(function(q){ return q.module === m.id; }); });

const ST = K.store(KEY, function(){ return {tasks:{}, quiz:{}, labs:{}, exams:[], pex:[], ex:null, ui:{}}; });
const S = ST.data;
["tasks","quiz","labs","ui"].forEach(function(k){ S[k] = S[k] || {}; });
S.exams = S.exams || []; S.pex = S.pex || [];
function save(){ ST.save(); }

/* ---------- общее ---------- */
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
function ext(href, text){ return '<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(text)+'</a>'; }
function mshort(id){ const m = MBY[id]; return m ? m.title : id; }

/* md из kit.js плюс заголовки и таблицы — они есть в TASK.md и PORTFOLIO_TRACKS.md */
function mdx(src){
  const L = String(src).split("\n"), out = [], buf = [];
  const flush = function(){ if(buf.length){ out.push(md(buf.join("\n"))); buf.length = 0; } };
  const cells = function(r){ return r.trim().replace(/^\||\|$/g, "").split("|").map(function(c){ return c.trim(); }); };
  let i = 0;
  while(i < L.length){
    const l = L[i];
    if(/^```/.test(l)){
      buf.push(L[i++]);
      while(i < L.length && !/^```/.test(L[i])) buf.push(L[i++]);
      if(i < L.length) buf.push(L[i++]);
      continue;
    }
    const h = l.match(/^#{1,6}\s+(.*)$/);
    if(h){ flush(); out.push('<h5>'+inl(h[1])+'</h5>'); i++; continue; }
    if(/^\s*\|/.test(l)){
      flush(); const rows = [];
      while(i < L.length && /^\s*\|/.test(L[i])) rows.push(L[i++]);
      const body = rows.filter(function(r){ return !/^\s*\|[\s:|-]+\|\s*$/.test(r); }).map(cells);
      out.push('<div class="lx-tablewrap"><table class="lx-table"><thead><tr>'
        + body[0].map(function(c){ return '<th>'+inl(c)+'</th>'; }).join("") + '</tr></thead><tbody>'
        + body.slice(1).map(function(r){ return '<tr>'+r.map(function(c){ return '<td>'+inl(c)+'</td>'; }).join("")+'</tr>'; }).join("")
        + '</tbody></table></div>');
      continue;
    }
    buf.push(l); i++;
  }
  flush();
  return out.join("");
}

/* «R23–R25, C37» → ["R23","R24","R25","C37"]: только существующие задачи */
function taskRefs(text){
  const ids = [];
  String(text).replace(/\b([A-Z])(\d{2})(?:\s*[–-]\s*\1?(\d{2}))?\b/g, function(_, p, a, b){
    for(let n = +a; n <= (b ? +b : +a); n++){
      const id = p + String(n).padStart(2, "0");
      if(TBY[id] && ids.indexOf(id) === -1) ids.push(id);
    }
  });
  return ids;
}
function taskBtns(ids){
  return ids.map(function(id){ return '<button class="btn" data-open="'+id+'">'+id+'</button>'; }).join("");
}

/* RESULT A01 4/5 (failed 1, skipped 0) — SKIP не засчитывается как PASS */
function parseResult(text){
  const res = {};
  String(text).replace(/\x1b\[[0-9;]*m/g, "").split(/\r?\n/).forEach(function(l){
    const m = l.match(/RESULT\s+([A-Z]\d{2})\s+(\d+)\/(\d+)(?:\s*\(failed\s+(\d+),\s*skipped\s+(\d+)\))?/);
    if(m) res[m[1]] = {p: +m[2], n: +m[3], f: m[4] == null ? +m[3] - +m[2] : +m[4], s: +(m[5] || 0)};
  });
  return res;
}
function taskSt(id){ return (S.tasks[id] || {}).st || ""; }
function setTask(id, r){
  const st = r.f === 0 && r.p > 0 ? "ok" : r.p > 0 ? "part" : "fail";
  S.tasks[id] = {st: st, r: r.p+"/"+r.n+(r.s ? " · SKIP "+r.s : ""), ts: Date.now()};
}
function histRows(list){
  return '<div class="lx-hist">' + list.map(function(e){
    return '<div class="lx-h"><span class="lx-muted">'+K.dateStr(e.ts)+'</span><span class="lx-s">'+e.score+'%</span>'+bar(e.score, e.score >= PASS)+'</div>';
  }).join("") + '</div>';
}
function labDone(l){
  const c = S.labs[l.id] || {};
  return l.checks.filter(function(x){ return c[K.hash(x)]; }).length;
}

/* ---------- ОБЗОР ---------- */
function vHome(){
  const per = MODS.map(function(m){
    const ts = TASKS.filter(function(t){ return t.dom === m.id; });
    const ok = ts.filter(function(t){ return taskSt(t.id) === "ok"; }).length;
    let qa = 0, qc = 0;
    QUIZ.filter(function(q){ return q.module === m.id; }).forEach(function(q){ const a = S.quiz[q.id]; if(a){ qa++; if(a.last) qc++; } });
    const ls = LABS.filter(function(l){ return l.module === m.id; });
    const lc = ls.reduce(function(s, l){ return s + l.checks.length; }, 0), ld = ls.reduce(function(s, l){ return s + labDone(l); }, 0);
    return {m: m, n: ts.length, ok: ok, qa: qa, qc: qc, lc: lc, ld: ld};
  });
  const okAll = per.reduce(function(s, p){ return s + p.ok; }, 0);
  const next = TASKS.find(function(t){ return !taskSt(t.id); });
  const nNew = TASKS.filter(function(t){ return t.new; }).length + QUIZ.filter(function(q){ return q.new; }).length + LABS.filter(function(l){ return l.new; }).length;
  return ''
  + '<section class="lx-card lx-hero">'
  +   '<div class="eyebrow">AI DevOps Academy · v2</div>'
  +   '<h2 class="lx-h2">AI DevOps: агенты, MCP, RAG, evals, LLM serving</h2>'
  +   '<p>Практический курс для DevOps и SRE, которые эксплуатируют AI-сервисы. '+TASKS.length+' задач со стартовыми файлами и автопроверкой <code>./ai-lab check</code>: сервис агента и tool calling, MCP, Kubernetes, CI-гейты, безопасность, RAG, evals, AI-native инструменты, автоматизация и ModelOps. Всё работает на CPU и kind, без GPU и платных API. К задачам — '+LABS.length+' практикумов с чек-листами, '+QUIZ.length+' вопросов на понимание и сертификации.</p>'
  +   '<div class="lx-row">'
  +     (next ? '<button class="btn lx-primary" data-open="'+next.id+'">Продолжить: '+next.id+'</button>' : '')
  +     '<a class="btn" href="'+KIT+'" download>Скачать ai-devops-labs.zip</a>'
  +     '<button class="btn" data-go="exam">Экзамен</button>'
  +   '</div>'
  + '</section>'
  + '<div class="lx-facts">'
  +   [[String(TASKS.length),"задач с автопроверкой PASS / FAIL / SKIP"],[String(MODS.length - 1),"направлений, плюс итоговый проект"],
       ["CPU","kind, Ollama и mock-режим, GPU не нужен"],[String(QUIZ.length),"вопросов, варианты перемешиваются"],
       [String(nNew),"новых материалов на сайте: ModelOps L41–L44 и др."],[okAll+"/"+TASKS.length,"задач решено у вас"]]
      .map(function(f){ return '<div class="lx-fact"><b>'+f[0]+'</b><span>'+f[1]+'</span></div>'; }).join("")
  + '</div>'
  + '<section class="lx-card">'
  +   '<h3 class="lx-h3">Направления и ваш прогресс</h3>'
  +   '<div class="lx-tablewrap"><table class="lx-table"><thead><tr><th>№</th><th>Направление</th><th class="lx-hide-sm">Задачи</th><th>Решено</th><th class="lx-hide-sm">Вопросы</th><th class="lx-hide-sm">Чек-листы</th></tr></thead><tbody>'
  +     per.map(function(p){
          return '<tr><td class="lx-num">'+esc(p.m.num)+'</td>'
            + '<td><button class="lx-link" data-dom="'+p.m.id+'">'+esc(p.m.title)+'</button><br><span class="lx-muted lx-small">'+esc(p.m.short)+'</span></td>'
            + '<td class="lx-num lx-hide-sm">'+p.ok+'/'+p.n+'</td>'
            + '<td style="width:22%">'+bar(p.n ? Math.round(p.ok/p.n*100) : 0, p.n && p.ok === p.n)+'</td>'
            + '<td class="lx-num lx-hide-sm">'+(p.qa ? Math.round(p.qc/p.qa*100)+"%" : "—")+'</td>'
            + '<td class="lx-num lx-hide-sm">'+(p.lc ? p.ld+"/"+p.lc : "—")+'</td></tr>';
        }).join("")
  +   '</tbody></table></div>'
  + '</section>'
  + '<div class="lx-grid2">'
  +   '<section class="lx-card">'
  +     '<h3 class="lx-h3">Стенд на вашей машине</h3>'
  +     '<ol class="lx-steps">'
  +       '<li><p>Нужны Python 3.10+ и bash; для задач K07–K09, S13, L43 — Docker, <code>kind</code> и <code>kubectl</code>. На Windows — WSL2.</p>'
  +         '<div class="lx-row"><a class="btn lx-primary" href="'+KIT+'" download>Скачать ai-devops-labs.zip</a><span class="lx-muted lx-small">'+D.kit.files+' файлов · '+D.kit.kb+' КБ</span></div></li>'
  +       '<li><p>Окружение и проверка зависимостей:</p>'
  +         code("unzip ai-devops-labs.zip && cd ai-devops-labs\npython3 -m venv .venv && source .venv/bin/activate\npip install -r requirements.txt\n./ai-lab doctor\n./ai-lab list")+'</li>'
  +       '<li><p>Цикл задачи: стартовые файлы попадают в <code>workspaces/&lt;ID&gt;/</code>, их и правите.</p>'
  +         code("./ai-lab start A01\n./ai-lab check A01     # PASS/FAIL/SKIP и строка RESULT A01 p/n\n./ai-lab solve A01     # эталон, перезаписывает workspace")+'</li>'
  +       '<li><p>Kubernetes-задачи — только в отдельном кластере <code>kind-ai-labs</code>: <code>./ai-lab up</code>, <code>seed</code>, <code>apply</code>. С рабочим kubeconfig не запускайте.</p></li>'
  +     '</ol>'
  +   '</section>'
  +   '<section class="lx-card">'
  +     '<h3 class="lx-h3">Что проверено перед публикацией</h3>'
  +     '<ul class="lx-list">'
  +       '<li>Каждая задача прогнана дважды: эталон проходит офлайн-проверки, стартовые файлы их не проходят.</li>'
  +       '<li>SKIP — проверка не проводилась (нужен GitLab, n8n, Postgres, MCP SDK или живой кластер). Это не «сдано»: подтвердите вручную.</li>'
  +       '<li>Live-проверки K07–K09, S13 и L43 требуют применённых манифестов в <code>kind-ai-labs</code>, а для L43 — ещё KEDA и Prometheus.</li>'
  +       '<li>Исправлено в архиве: CI задачи C37 (зависимости и импорт), чтение UTF-8 в тестах на Windows, <code>pytest.ini</code> для запуска из корня, справка и экзамен <code>./ai-lab</code>.</li>'
  +       '<li>Добавлено: направление ModelOps — задачи L41–L44, вопросы, переписанные практикумы по RAG, evals, AI-native и автоматизации.</li>'
  +       '<li>В вопросах правильный ответ чаще стоял вторым; здесь варианты перемешиваются.</li>'
  +     '</ul>'
  +   '</section>'
  + '</div>';
}

/* ---------- ЗАДАЧИ ---------- */
function taskFilter(){ return S.ui.tf || {dom:"all", st:"all"}; }
function vTasks(){
  const f = taskFilter();
  const list = TASKS.filter(function(t){
    if(f.dom !== "all" && t.dom !== f.dom) return false;
    if(f.st === "todo") return taskSt(t.id) !== "ok";
    if(f.st === "done") return taskSt(t.id) === "ok";
    if(f.st === "new") return t.new;
    return true;
  });
  const cur = (S.ui.task && TBY[S.ui.task]) || list[0] || TASKS[0];
  const cnt = function(d){ return TASKS.filter(function(t){ return d === "all" || t.dom === d; }).length; };
  return '<div class="lx-split">'
  + '<aside class="lx-card lx-listcard" aria-label="Список задач">'
  +   chips([["all","Все",cnt("all")]].concat(MODS.filter(function(m){ return cnt(m.id); }).map(function(m){ return [m.id, m.title, cnt(m.id)]; })), "tf-dom", f.dom)
  +   seg([["all","все"],["todo","не решены"],["done","решены"],["new","новые"]], "tf-st", f.st, "Статус")
  +   '<div class="lx-tlist">' + (list.map(function(t){
        return '<button class="lx-titem" data-open="'+t.id+'" aria-current="'+(t.id === cur.id)+'">'
          + '<span class="lx-dot '+taskSt(t.id)+'" aria-hidden="true"></span>'
          + '<span class="lx-tt">'+esc(t.title)+'<small>'+esc(mshort(t.dom))+(t.prereq ? " · после "+esc(t.prereq) : "")+(t.new ? " · новая" : "")+'</small></span>'
          + '<span class="lx-id">'+t.id+'</span></button>';
      }).join("") || '<p class="lx-muted lx-small">В этом фильтре задач нет.</p>') + '</div>'
  + '</aside>'
  + '<article class="lx-card lx-lab">'+taskDetail(cur)+'</article>'
  + '</div>';
}
function files(list){
  return list.map(function(f){ return '<div class="lx-solstep"><h5 class="lx-mono">'+esc(f[0])+'</h5>'+code(f[1].replace(/\n$/, ""))+'</div>'; }).join("");
}
function taskDetail(t){
  const L = S.tasks[t.id] || {};
  const stName = {ok:"решено", part:"частично", fail:"не решено"}, stCls = {ok:"ok", part:"warn", fail:"bad"};
  const i = TASKS.indexOf(t), prev = TASKS[i-1], next = TASKS[i+1];
  const labs = LABS.filter(function(l){ return taskRefs(l.objective + " " + l.steps.join(" ") + " " + l.snippet).indexOf(t.id) !== -1; });
  return ''
  + '<div class="lx-row lx-between" style="align-items:flex-start">'
  +   '<div class="lx-titlebox"><div class="eyebrow">'+t.id+' · '+esc(mshort(t.dom))+'</div><h3 class="lx-h2">'+esc(t.title)+'</h3></div>'
  +   '<div class="lx-row">'+(t.new ? pill("новая", "acc") : "")+(t.prereq ? pill("после "+esc(t.prereq)) : "")
  +     (L.st ? pill(stName[L.st]+(L.r ? " · "+esc(L.r) : ""), stCls[L.st]) : "")+'</div>'
  + '</div>'
  + '<section><h4 class="lx-h4">Задание</h4><div class="lx-prose">'+md(t.goal)+'</div></section>'
  + '<section><h4 class="lx-h4">Что проверяет ./ai-lab check</h4><div class="lx-prose">'+md(t.ev)+'</div></section>'
  + t.notes.map(function(n){ return '<section>'+(n.h ? '<h4 class="lx-h4">'+inl(n.h)+'</h4>' : '')+'<div class="lx-prose">'+mdx(n.md)+'</div></section>'; }).join("")
  + '<section><h4 class="lx-h4">Запуск</h4>'
  +   code("./ai-lab start "+t.id+"\n# правка: "+t.files.map(function(f){ return "workspaces/"+t.id+"/"+f; }).join(", ")+"\n./ai-lab check "+t.id)
  + '</section>'
  + '<section><h4 class="lx-h4">Результат</h4><div class="lx-result">'
  +   '<div class="lx-row"><input class="lx-input" id="lx-res" placeholder="Вставьте строку RESULT '+t.id+' 4/5 (failed 1, skipped 0)" aria-label="Строка RESULT из ./ai-lab check">'
  +     '<button class="btn" data-act="res-paste" data-id="'+t.id+'">Учесть</button></div>'
  +   '<div class="lx-row"><span class="lx-muted lx-small">или отметьте сами:</span>'
  +     [["ok","Решено","on-ok"],["part","Частично","on-warn"],["fail","Не решено","on-bad"]].map(function(m){
          return '<button class="btn '+(L.st === m[0] ? m[2] : "")+'" data-mark="'+m[0]+'" data-id="'+t.id+'">'+m[1]+'</button>';
        }).join("")
  +     (L.st ? '<button class="btn" data-mark="" data-id="'+t.id+'">Сбросить</button>' : '')
  +   '</div>'
  +   '<p class="lx-small lx-muted">SKIP в строке RESULT означает, что часть проверок требует живой среды. Задача без FAIL отмечается решённой, число SKIP остаётся в статусе.</p>'
  + '</div></section>'
  + (t.starter.length ? '<details class="lx-fold"><summary>Стартовые файлы '+pill(t.starter.length)+'</summary><div class="lx-inner">'+files(t.starter)+'</div></details>' : '')
  + '<details class="lx-fold"><summary>Эталонное решение</summary><div class="lx-inner">'
  +   '<p class="lx-small lx-muted">То же, что <code>./ai-lab solve '+t.id+'</code>. Сначала попробуйте сами: проверка смотрит на поведение, а не на совпадение с эталоном.</p>'
  +   files(t.solution)
  + '</div></details>'
  + (labs.length ? '<section><h4 class="lx-h4">Практикумы с этой задачей</h4><div class="lx-row">'
      + labs.map(function(l){ return '<button class="btn" data-lab="'+l.id+'">'+esc(l.title)+'</button>'; }).join("") + '</div></section>' : '')
  + '<div class="lx-row lx-between">'
  +   (prev ? '<button class="btn" data-open="'+prev.id+'">← '+prev.id+'</button>' : '<span></span>')
  +   (next ? '<button class="btn" data-open="'+next.id+'">'+next.id+' →</button>' : '<span></span>')
  + '</div>';
}

/* ---------- ПРАКТИКУМЫ ---------- */
function vPractice(){
  const f = S.ui.pf || "all";
  const cnt = function(d){ return LABS.filter(function(l){ return d === "all" || l.module === d; }).length; };
  const list = LABS.filter(function(l){ return f === "all" || l.module === f; });
  return '<section class="lx-card"><p>Практикумы связывают несколько задач в один сценарий и добавляют то, что автопроверка не покрывает: живые вызовы, негативные кейсы, замеры. Отмечайте пункты «Готово, если» по мере выполнения.</p>'
  + chips([["all","Все",cnt("all")]].concat(MODS.filter(function(m){ return cnt(m.id); }).map(function(m){ return [m.id, m.title, cnt(m.id)]; })), "pf", f)
  + '</section>'
  + list.map(function(l){
      const done = labDone(l), c = S.labs[l.id] || {}, refs = taskRefs(l.objective + " " + l.steps.join(" ") + " " + l.snippet);
      return '<details class="lx-fold lx-card" id="lab-'+l.id+'"'+(S.ui.lab === l.id ? " open" : "")+'>'
        + '<summary>'+esc(l.title)+' '+pill(done+"/"+l.checks.length, done === l.checks.length ? "ok" : "")+(l.new ? " "+pill("новый", "acc") : "")+'</summary>'
        + '<div class="lx-inner">'
        +   '<div class="lx-row">'+pill(esc(mshort(l.module)))+pill(esc(l.time))+pill(esc(l.difficulty))+'</div>'
        +   '<p><b>Цель.</b> '+inl(l.objective)+'</p>'
        +   '<ol class="lx-steps">'+l.steps.map(function(s){ return '<li><p>'+inl(s)+'</p></li>'; }).join("")+'</ol>'
        +   (l.snippet ? code(l.snippet) : '')
        +   '<h4 class="lx-h4">Готово, если</h4>'
        +   '<div class="lx-opts" role="group">'+l.checks.map(function(x){
              const on = !!c[K.hash(x)];
              return '<button class="lx-opt '+(on ? "right" : "")+'" role="checkbox" aria-checked="'+on+'" data-chk="'+K.hash(x)+'" data-lid="'+l.id+'"><span class="k">'+(on ? "✓" : "")+'</span><span>'+inl(x)+'</span></button>';
            }).join("")+'</div>'
        +   (l.hint ? '<p class="lx-small lx-muted">'+inl(l.hint)+'</p>' : '')
        +   (refs.length ? '<div class="lx-row"><span class="lx-muted lx-small">Задачи:</span>'+taskBtns(refs)+'</div>' : '')
        + '</div></details>';
    }).join("");
}

/* ---------- ВОПРОСЫ ---------- */
let QS = null;
function quizPool(){
  const f = S.ui.qf || "all", only = !!S.ui.qerr;
  return QUIZ.filter(function(q){ return (f === "all" || q.module === f) && (!only || (S.quiz[q.id] && !S.quiz[q.id].last)); });
}
function order(q){ return K.shuffle(q.options.map(function(_, i){ return i; })); }
function quizStart(){ QS = {list: K.shuffle(quizPool()).map(function(q){ return q.id; }), pos: 0, sel: null, done: false, right: 0, ans: 0, ord: null}; }
function explain(q){
  return '<span>'+inl(q.why)+'</span>'
    + (q.code ? code(q.code) : '')
    + (q.tip ? '<span class="lx-small"><b>Совет:</b> '+inl(q.tip)+'</span>' : '');
}
function opts(q, ord, sel, done, attr){
  return '<div class="lx-opts" role="radiogroup">' + ord.map(function(i, k){
    const cls = done ? (i === q.answer ? "right" : sel === i ? "wrong" : "") : "";
    return '<button class="lx-opt '+cls+'" role="radio" aria-checked="'+(sel === i)+'" '+attr+'="'+i+'"'+(done ? " disabled" : "")+'>'
      + '<span class="k">'+"ABCDEF"[k]+'</span><span>'+inl(q.options[i])+'</span></button>';
  }).join("") + '</div>';
}
function vQuiz(){
  if(!QS) quizStart();
  const f = S.ui.qf || "all";
  const errN = QUIZ.filter(function(q){ return S.quiz[q.id] && !S.quiz[q.id].last; }).length;
  const cnt = function(k){ return QUIZ.filter(function(q){ return k === "all" || q.module === k; }).length; };
  const head = '<div class="lx-row lx-between">'
    + chips([["all","Все",cnt("all")]].concat(QMODS.map(function(m){ return [m.id, m.title, cnt(m.id)]; })), "qf", f)
    + '<button class="chip" data-act="qerr" aria-pressed="'+!!S.ui.qerr+'">Только ошибки<span class="n">'+errN+'</span></button></div>';
  if(!QS.list.length) return head + '<div class="lx-card"><p class="lx-muted">'+(S.ui.qerr ? "Ошибок в этом разделе нет." : "Вопросов нет.")+'</p></div>';
  if(QS.pos >= QS.list.length) return head + '<div class="lx-card"><div class="eyebrow">Серия завершена</div>'
    + '<div class="lx-score">'+QS.right+'/'+QS.ans+'</div><p class="lx-muted">Ошибки собираются в фильтр «Только ошибки».</p>'
    + '<div><button class="btn lx-primary" data-act="q-again">Ещё раз</button></div></div>';
  const q = QBY[QS.list[QS.pos]], done = QS.done, sel = QS.sel;
  if(!QS.ord) QS.ord = order(q);
  const ok = done && sel === q.answer;
  return head + '<div class="lx-card lx-qcard">'
    + bar(Math.round(QS.pos/QS.list.length*100))
    + '<div class="lx-row lx-between"><span class="eyebrow">'+(QS.pos+1)+' / '+QS.list.length+' · '+esc(mshort(q.module))+'</span>'
    +   '<span class="lx-row">'+(q.new ? pill("новый", "acc") : "")+'<span class="lx-muted lx-small">уровень '+q.level+'</span></span></div>'
    + '<div class="lx-qtext">'+inl(q.title)+'</div>'
    + opts(q, QS.ord, sel, done, "data-opt")
    + (done
      ? '<div class="lx-fb '+(ok ? "ok" : "bad")+'"><b>'+(ok ? "Верно" : "Неверно")+'</b>'+explain(q)+'</div>'
        + '<div><button class="btn lx-primary" data-act="q-next">Дальше →</button></div>'
      : '<div><button class="btn lx-primary" data-act="q-check"'+(sel == null ? " disabled" : "")+'>Проверить</button></div>')
    + '</div>';
}

/* ---------- ЭКЗАМЕН ---------- */
function newExam(){
  const ids = [], ord = {};
  QMODS.forEach(function(m){
    K.shuffle(QUIZ.filter(function(q){ return q.module === m.id; })).slice(0, EXAM_PER).forEach(function(q){ ids.push(q.id); ord[q.id] = order(q); });
  });
  return {ids: K.shuffle(ids), ord: ord, ans: {}, start: null, end: null};
}
function vExam(){
  let E = S.ex;
  if(!E || !E.ids || E.ids.some(function(id){ return !QBY[id]; })){ E = S.ex = newExam(); save(); }
  const nAns = Object.keys(E.ans).length;
  let head;
  if(!E.start){
    head = '<section class="lx-card">'
      + '<div class="eyebrow">Теория</div><h3 class="lx-h2">'+plural(E.ids.length, ["вопрос","вопроса","вопросов"])+' · по '+EXAM_PER+' из каждого направления · порог '+PASS+'%</h3>'
      + '<p>Ответы и разборы откроются после сдачи. Ориентир — 30 минут.</p>'
      + '<div class="lx-row"><button class="btn lx-primary" data-act="ex-start">Начать</button><button class="btn" data-act="ex-new">Другой набор</button></div>'
      + '</section>';
    return head + practical() + histCard();
  }
  const done = !!E.end;
  const right = E.ids.filter(function(id){ return E.ans[id] === QBY[id].answer; }).length;
  const score = Math.round(right / E.ids.length * 100);
  head = '<section class="lx-card">'
    + (done
      ? '<div class="lx-row" style="gap:18px;align-items:baseline"><span class="lx-score '+(score >= PASS ? "ok" : "bad")+'">'+score+'%</span>'
        + '<span>'+right+' из '+E.ids.length+(score >= PASS ? " · сдано" : " · до порога "+(PASS - score)+" п.")+'</span>'
        + '<span class="lx-muted lx-small">время '+fmt((E.end - E.start)/1000)+'</span></div>'
        + '<div class="lx-stack">'+QMODS.map(function(m){
            const ids = E.ids.filter(function(id){ return QBY[id].module === m.id; });
            const r = ids.filter(function(id){ return E.ans[id] === QBY[id].answer; }).length, p = ids.length ? Math.round(r/ids.length*100) : 0;
            return '<div><div class="lx-row lx-between"><span>'+esc(m.title)+'</span><span class="lx-mono">'+r+'/'+ids.length+'</span></div>'+bar(p, p >= PASS)+'</div>';
          }).join("")+'</div>'
        + '<div class="lx-row"><button class="btn lx-primary" data-act="ex-new">Новый экзамен</button></div>'
      : '<div class="lx-row lx-between"><span class="eyebrow">Отвечено '+nAns+' из '+E.ids.length+'</span>'
        + '<button class="btn lx-primary" data-act="ex-finish">Сдать</button></div>'+bar(Math.round(nAns/E.ids.length*100)))
    + '</section>';
  return head
    + E.ids.map(function(id, n){
        const q = QBY[id], sel = E.ans[id];
        return '<div class="lx-card lx-qcard"><span class="eyebrow">'+(n+1)+' · '+esc(mshort(q.module))+'</span>'
          + '<div class="lx-qtext">'+inl(q.title)+'</div>'
          + opts(q, E.ord[id], sel == null ? null : sel, done, 'data-qid="'+id+'" data-exopt')
          + (done ? '<div class="lx-fb '+(sel === q.answer ? "ok" : "bad")+'"><b>'+(sel === q.answer ? "Верно" : sel == null ? "Без ответа" : "Неверно")+'</b>'+explain(q)+'</div>' : '')
          + '</div>';
      }).join("")
    + (done ? '' : '<div class="lx-row"><button class="btn lx-primary" data-act="ex-finish">Сдать</button></div>')
    + (done ? practical() + histCard() : '');
}
function practical(){
  const last = S.pex[S.pex.length-1];
  return '<section class="lx-card">'
    + '<div class="eyebrow">Практика</div><h3 class="lx-h3">Экзамен на стенде</h3>'
    + '<p>По одной случайной задаче из каждого направления, без эталонных решений. Решите их и проверьте одной командой.</p>'
    + code("./ai-lab exam     # выбирает задачи, например: A19 M05 K08 …\n./ai-lab start <ID>   # для каждой\n./ai-lab grade    # проверка всех выбранных")
    + '<label for="lx-grade" class="lx-small lx-muted">Вставьте вывод <code>./ai-lab grade</code>:</label>'
    + '<textarea class="lx-input lx-paste" id="lx-grade" placeholder="RESULT A19 5/5 (failed 0, skipped 0)&#10;RESULT K08 4/6 (failed 1, skipped 1)&#10;…"></textarea>'
    + '<div class="lx-row"><button class="btn lx-primary" data-act="pex-grade">Посчитать</button>'
    +   (last ? '<span class="lx-muted lx-small">последний: '+last.score+'% · '+plural(last.n, ["задача","задачи","задач"])+(last.s ? " · SKIP "+last.s : "")+'</span>' : '')+'</div>'
    + '<p class="lx-src">Балл — доля пройденных проверок без учёта SKIP; SKIP нужно подтвердить вручную.</p>'
    + '</section>';
}
function histCard(){
  if(!S.exams.length && !S.pex.length) return "";
  return '<div class="lx-grid2">'
    + (S.exams.length ? '<section class="lx-card"><h3 class="lx-h3">Теория: история</h3>'+histRows(S.exams.slice(-8).reverse())+'</section>' : '')
    + (S.pex.length ? '<section class="lx-card"><h3 class="lx-h3">Практика: история</h3>'+histRows(S.pex.slice(-8).reverse())+'</section>' : '')
    + '</div>';
}

/* ---------- КАРЬЕРА ---------- */
function vCareer(){
  return '<section class="lx-card">'
  +   '<h3 class="lx-h3">Сертификации</h3>'
  +   '<div class="lx-tablewrap"><table class="lx-table"><thead><tr><th>Сертификат</th><th>Приоритет</th><th class="lx-hide-sm">Трек</th><th>Зачем</th></tr></thead><tbody>'
  +     CERTS.map(function(c){
          return '<tr><td>'+ext(c.url, c.name)+'<br><span class="lx-muted lx-small">'+esc(c.full)+'</span></td>'
            + '<td>'+esc(c.priority)+'</td><td class="lx-hide-sm">'+esc(c.track)+'</td><td>'+inl(c.why)+'</td></tr>';
        }).join("")
  +   '</tbody></table></div>'
  +   '<p class="lx-src">Цены, версии и условия меняются — проверьте на странице сертификата перед регистрацией.</p>'
  + '</section>'
  + '<section class="lx-card">'
  +   '<div class="lx-row lx-between"><h3 class="lx-h3">Портфолио под вакансии</h3><div class="lx-row">'+taskBtns(["P17","P38"])+'</div></div>'
  +   '<div class="lx-prose">'+mdx(D.tracks.replace(/^#\s[^\n]*\n/, ""))+'</div>'
  + '</section>';
}

/* ---------- события ---------- */
function openTask(id){
  S.ui.task = id;
  const f = taskFilter();
  if(f.dom !== "all" && TBY[id].dom !== f.dom) f.dom = "all";
  if(f.st === "new" && !TBY[id].new) f.st = "all";
  S.ui.tf = f; save(); K.go("tasks");
  const el = document.querySelector(".lx-lab"); if(el) el.scrollIntoView({block: "start"});
}
function click(el){
  const d = el.dataset, E = S.ex;
  if(d.go){ K.go(d.go); return; }
  if(d.open){ openTask(d.open); return; }
  if(d.dom){ S.ui.tf = {dom: d.dom, st: "all"}; const t = TASKS.find(function(x){ return x.dom === d.dom; }); if(t) S.ui.task = t.id; save(); K.go("tasks"); return; }
  if(d.tfDom){ const f = taskFilter(); f.dom = d.tfDom; S.ui.tf = f; save(); K.refresh(); return; }
  if(d.tfSt){ const f = taskFilter(); f.st = d.tfSt; S.ui.tf = f; save(); K.refresh(); return; }
  if(d.mark !== undefined){ if(d.mark) S.tasks[d.id] = {st: d.mark, ts: Date.now()}; else delete S.tasks[d.id]; save(); K.refresh(); return; }
  if(d.lab){ S.ui.lab = d.lab; S.ui.pf = "all"; save(); K.go("practice"); const x = document.getElementById("lab-"+d.lab); if(x) x.scrollIntoView({block: "start"}); return; }
  if(d.pf){ S.ui.pf = d.pf; save(); K.refresh(); return; }
  if(d.chk){ const c = S.labs[d.lid] || {}; c[d.chk] = !c[d.chk]; S.labs[d.lid] = c; S.ui.lab = d.lid; save(); K.refresh(); return; }
  if(d.qf){ S.ui.qf = d.qf; save(); quizStart(); K.refresh(); return; }
  if(d.opt !== undefined && QS && !QS.done){ QS.sel = +d.opt; K.refresh(); return; }
  if(d.exopt !== undefined && E && E.start && !E.end){ E.ans[d.qid] = +d.exopt; save(); K.refresh(); return; }
  switch(d.act){
    case "res-paste": {
      const p = parseResult(document.getElementById("lx-res").value);
      const r = p[d.id] || p[Object.keys(p)[0]];
      if(!r){ K.toast("Не нашёл строку RESULT"); break; }
      setTask(d.id, r); save(); K.refresh(); break;
    }
    case "qerr": S.ui.qerr = !S.ui.qerr; save(); quizStart(); K.refresh(); break;
    case "q-check": {
      const q = QBY[QS.list[QS.pos]];
      if(QS.sel == null) break;
      QS.done = true;
      const ok = QS.sel === q.answer; QS.ans++; if(ok) QS.right++;
      const a = S.quiz[q.id] || {c: 0, w: 0}; if(ok) a.c++; else a.w++; a.last = ok ? 1 : 0; S.quiz[q.id] = a;
      save(); K.refresh(); break;
    }
    case "q-next": QS.pos++; QS.sel = null; QS.done = false; QS.ord = null; K.refresh(); break;
    case "q-again": quizStart(); K.refresh(); break;
    case "ex-start": E.start = Date.now(); save(); K.refresh(); break;
    case "ex-new": S.ex = newExam(); save(); K.refresh(); break;
    case "ex-finish": {
      E.end = Date.now();
      const right = E.ids.filter(function(id){ return E.ans[id] === QBY[id].answer; }).length;
      S.exams.push({ts: E.end, score: Math.round(right / E.ids.length * 100), n: E.ids.length});
      E.ids.forEach(function(id){
        const q = QBY[id], ok = E.ans[id] === q.answer, a = S.quiz[id] || {c: 0, w: 0};
        if(ok) a.c++; else a.w++; a.last = ok ? 1 : 0; S.quiz[id] = a;
      });
      save(); K.refresh(); window.scrollTo(0, 0); break;
    }
    case "pex-grade": {
      const p = parseResult(document.getElementById("lx-grade").value), ids = Object.keys(p).filter(function(id){ return TBY[id]; });
      if(!ids.length){ K.toast("В тексте нет строк RESULT"); break; }
      let g = 0, n = 0, s = 0;
      ids.forEach(function(id){ const r = p[id]; g += r.p; n += r.n - r.s; s += r.s; setTask(id, r); });
      S.pex.push({ts: Date.now(), score: n ? Math.round(g / n * 100) : 0, n: ids.length, s: s});
      save(); K.refresh(); break;
    }
  }
}
function keydown(e){
  if(e.key === "Enter" && e.target.id === "lx-res"){ e.preventDefault(); const b = document.querySelector('[data-act="res-paste"]'); if(b) b.click(); }
}

K.register("aidevops", {
  sections: [["home","Обзор"],["tasks","Задачи"],["practice","Практикумы"],["quiz","Вопросы"],["exam","Экзамен"],["career","Сертификации и портфолио"]],
  render: function(sec){
    return ({home: vHome, tasks: vTasks, practice: vPractice, quiz: vQuiz, exam: vExam, career: vCareer}[sec] || vHome)();
  },
  click: click, keydown: keydown
});
})();
