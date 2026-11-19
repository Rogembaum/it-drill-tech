/* ============================================================================
   Каркас лаб: реестр модулей и общие помощники разметки.

   Лаба — это каталог labs/<id>/ с файлами data.js (данные) и lab.js (интерфейс)
   плюс запись в labs/catalog.js. lab.js регистрирует модуль:

     LabKit.register("<id>", {
       sections: [[ключ, название], …],   вкладки внутри лабы
       initial(sec)  — необязательно: какой раздел открыть (sec — из адреса)
       tab(key)      — необязательно: доп. разметка во вкладке, например таймер
       render(sec)   — HTML раздела
       click(el, e)  — клик по button/a внутри лабы
       keydown(e), input(e) — необязательно
     });

   Навигацию подставляет app.js: LabKit.go(раздел) и LabKit.refresh().
   ============================================================================ */
(function(){
"use strict";

const mods = {};

function esc(s){
  return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; });
}
function inl(s){
  return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
}
function codeHtml(c){
  return esc(c).split("\n").map(function(l){
    if(/^\s*#/.test(l)) return '<span class="c">' + l + '</span>';
    const m = l.match(/^(.*?)(\s+#\s.*)$/);
    if(m && !/['"]/.test(m[2])) return m[1] + '<span class="c">' + m[2] + '</span>';
    return l;
  }).join("\n");
}
function code(c){
  return '<div class="lx-code"><pre>' + codeHtml(c) + '</pre><button class="lx-copy" data-copy>копировать</button></div>';
}
function cmd(c){
  return '<div class="lx-cmd"><code><span class="lx-pr">$</span> ' + esc(c) + '</code>'
       + '<button class="lx-copy" data-copytext="' + esc(c) + '">копировать</button></div>';
}

/* абзацы, списки «- » и «1. » с одним уровнем вложенности, блоки ``` */
function md(src){
  const L = String(src).split("\n");
  let out = "", i = 0, para = [];
  const flush = function(){ if(para.length){ out += "<p>" + inl(para.join(" ")) + "</p>"; para = []; } };
  const item = /^(\s*)(\d+\.|-)\s+(.*)$/;
  while(i < L.length){
    const l = L[i];
    if(/^```/.test(l)){
      flush(); const buf = []; i++;
      while(i < L.length && !/^```/.test(L[i])) buf.push(L[i++]);
      i++; out += code(buf.join("\n")); continue;
    }
    const li = l.match(item);
    if(li){
      flush();
      const tag = /\d/.test(li[2]) ? "ol" : "ul", items = [];
      while(i < L.length){
        const m = L[i].match(item);
        if(m && !m[1].length){ items.push({t: m[3], sub: [], ord: false}); i++; continue; }
        if(m && items.length){ const it = items[items.length-1]; it.sub.push(m[3]); it.ord = /\d/.test(m[2]); i++; continue; }
        if(/^\s+\S/.test(L[i]) && items.length){ items[items.length-1].t += " " + L[i].trim(); i++; continue; }
        break;
      }
      out += "<" + tag + ">" + items.map(function(it){
        const st = it.ord ? "ol" : "ul";
        return "<li>" + inl(it.t)
          + (it.sub.length ? "<" + st + ">" + it.sub.map(function(s){ return "<li>" + inl(s) + "</li>"; }).join("") + "</" + st + ">" : "")
          + "</li>";
      }).join("") + "</" + tag + ">";
      continue;
    }
    if(/^\s*$/.test(l)){ flush(); i++; continue; }
    para.push(l.trim()); i++;
  }
  flush();
  return out;
}

function fmt(sec){
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec/3600), m = Math.floor(sec%3600/60), s = sec%60;
  return (h ? h + ":" + String(m).padStart(2,"0") : String(m).padStart(2,"0")) + ":" + String(s).padStart(2,"0");
}
function dateStr(ts){
  const d = new Date(ts);
  return d.toLocaleDateString("ru-RU", {day:"2-digit", month:"2-digit"}) + " "
       + d.toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"});
}
/* число со словом: plural(5, ["задача","задачи","задач"]) → "5 задач" */
function plural(n, f){
  const m10 = n % 10, m100 = n % 100;
  return n + " " + (m10 === 1 && m100 !== 11 ? f[0] : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? f[1] : f[2]);
}
function hash(s){ let h = 5381; for(let i = 0; i < s.length; i++) h = ((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); }
function rng(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffle(a, r){
  a = a.slice(); r = r || Math.random;
  for(let i = a.length-1; i > 0; i--){ const j = Math.floor(r()*(i+1)); const x = a[i]; a[i] = a[j]; a[j] = x; }
  return a;
}

let toastT;
function toast(msg){
  let el = document.querySelector(".lx-toast");
  if(!el){ el = document.createElement("div"); el.className = "lx-toast"; el.setAttribute("role","status"); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(function(){ el.hidden = true; }, 1800);
}
function copy(text, btn){
  const done = function(){
    if(!btn) return;
    const o = btn.textContent; btn.textContent = "скопировано";
    setTimeout(function(){ btn.textContent = o; }, 1200);
  };
  const fallback = function(){
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch(e){ toast("Выделите текст и скопируйте вручную"); }
    ta.remove();
  };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch(e){ fallback(); }
}
document.addEventListener("click", function(e){
  const b = e.target.closest(".lx-copy"); if(!b) return;
  if(b.dataset.copytext !== undefined) copy(b.dataset.copytext, b);
  else copy(b.previousElementSibling.textContent, b);
});

/* состояние лабы в localStorage под ключом из каталога */
function store(key, empty){
  let s = null;
  try { s = JSON.parse(localStorage.getItem(key) || "null"); } catch(e){}
  return {
    data: s && typeof s === "object" ? s : empty(),
    save: function(){ try { localStorage.setItem(key, JSON.stringify(this.data)); } catch(e){} }
  };
}

window.LabKit = {
  register: function(id, mod){ mods[id] = mod; },
  get: function(id){ return mods[id]; },
  go: function(){}, refresh: function(){},
  esc: esc, inl: inl, md: md, code: code, cmd: cmd, fmt: fmt, dateStr: dateStr,
  plural: plural, hash: hash, rng: rng, shuffle: shuffle, toast: toast, copy: copy, store: store
};
})();
