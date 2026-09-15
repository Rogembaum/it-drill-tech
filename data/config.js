/* ============================================================================
   НАСТРОЙКИ САЙТА
   Название, список тем и уровней, план на главной.
   Строки интерфейса — в data/i18n.js, содержание — в data/questions.js
   и data/cases.js.

   Везде, где текст зависит от языка, он записан объектом { ru: "…", en: "…" }.
   Если для языка строки нет, берётся русская.
   ============================================================================ */

window.SITE = {
  brand: "it-drill.tech",

  /* Язык по умолчанию для нового посетителя: "ru", "en" или "auto".
     "auto" — брать язык браузера. Пока переведена малая часть содержания,
     осмысленнее держать "ru": иначе иностранец увидит список
     с пометками RU почти на каждом вопросе. */
  defaultLang: "ru",

  title: {
    ru: "Тренажёр IT-инженера",
    en: "Drills for infrastructure engineers"
  },

  lede: {
    ru: "Вопросы по Linux, сетям, базам данных, протоколам, криптографии и файловым системам плюс разборы реальных инцидентов. Каждая тема выстроена лесенкой: базовый вопрос → тот же сюжет на уровне middle → то, что спрашивают у senior. Внутри ответа есть переход на соседнюю ступень, поэтому можно начать с простого и углубляться ровно там, где чувствуете пробел.",
    en: "Questions on Linux, networking, databases, protocols, cryptography and filesystems, plus walkthroughs of real incidents. Every topic is built as a ladder: a basic question, then the same subject at middle level, then what senior candidates get asked. Each answer links to the neighbouring step, so you can start simple and go deeper exactly where you feel a gap."
  },

  caseLede: {
    ru: "Разборы реальных отказов. Правило одно: сначала прочитать симптом и вывод команд и вслух назвать три гипотезы и то, чем каждую можно опровергнуть за одну команду. Только потом раскрывать разбор. Порядок гипотез — по убыванию вероятности, и это ровно то, что проверяют на секции по траблшутингу.",
    en: "Walkthroughs of real outages. One rule: read the symptom and the command output first, then say out loud three hypotheses and the single command that would rule each one out. Only then open the walkthrough. Hypotheses are ordered by likelihood, and that ordering is exactly what a troubleshooting interview measures."
  },

  footer: {
    ru: "Опорные книги: Таненбаум («Современные операционные системы», «Архитектура компьютера», «Компьютерные сети»), Kleppmann «Designing Data-Intensive Applications». Подборка материалов: <a href=\"https://github.com/mxssl/sre-interview-prep-guide\">mxssl/sre-interview-prep-guide</a>.",
    en: "Reference books: Tanenbaum (<i>Modern Operating Systems</i>, <i>Structured Computer Organization</i>, <i>Computer Networks</i>), Kleppmann <i>Designing Data-Intensive Applications</i>. Curated material: <a href=\"https://github.com/mxssl/sre-interview-prep-guide\">mxssl/sre-interview-prep-guide</a>."
  }
};

/* Уровни сложности. Порядок задаёт сортировку вопросов внутри темы.
   Код уровня (первый элемент) используется в поле lvl у вопроса. */
window.LEVELS = [
  ["jun", { ru: "Junior", en: "Junior" }],
  ["mid", { ru: "Middle", en: "Middle" }],
  ["sen", { ru: "Senior", en: "Senior" }]
];

/* Темы. Формат: [код, название, префикс для номера вопроса].
   Код используется в поле t у вопроса. Порядок задаёт порядок на странице.
   Чтобы добавить тему — допишите строку сюда и ставьте её код в новых вопросах. */
window.TOPICS = [
  ["linux",  { ru: "Linux",             en: "Linux" },        "LIN"],
  ["net",    { ru: "Сети",              en: "Networking" },   "NET"],
  ["db",     { ru: "Базы данных",       en: "Databases" },    "DB"],
  ["proto",  { ru: "Протоколы",         en: "Protocols" },    "PRO"],
  ["crypto", { ru: "Криптография",      en: "Cryptography" }, "CRY"],
  ["fs",     { ru: "Файловые системы",  en: "Filesystems" },  "FS"],
  ["cs",     { ru: "База CS",           en: "CS basics" },    "CS"],
  ["sd",     { ru: "System design",     en: "System design" }, "SD"],
  ["tls",    { ru: "TLS",               en: "TLS" },          "TLS"]
];

/* Блоки плана в шапке: [когда, что, как]. Можно менять свободно. */
window.PLAN = [
  [
    { ru: "Шаг 1 · калибровка", en: "Step 1 · calibrate" },
    { ru: "Фильтр Junior, все темы", en: "Junior filter, every topic" },
    { ru: "Быстро прогнать базу. Всё, что идёт без запинки, — отметить «+» и больше не трогать. Здесь ищут не знания, а дыры.",
      en: "Run through the basics fast. Anything you answer without hesitating gets a plus and you never look at it again. This pass is for finding holes, not for learning." }
  ],
  [
    { ru: "Шаг 2 · основной объём", en: "Step 2 · the bulk" },
    { ru: "Фильтр Middle, тема за темой", en: "Middle filter, topic by topic" },
    { ru: "Читать ответ и сразу переходить по ссылке «та же тема глубже», если сюжет знаком. Тут проходит граница между «слышал» и «понимаю».",
      en: "Read the answer and follow the «same topic, deeper» link whenever the subject is familiar. This is where «heard of it» and «understand it» part ways." }
  ],
  [
    { ru: "Шаг 3 · глубина", en: "Step 3 · depth" },
    { ru: "Фильтр Senior + «каверзные»", en: "Senior filter plus the tricky ones" },
    { ru: "То, на чём проваливаются: изоляция, MVCC, TIME_WAIT, throttling, nonce reuse. Отвечать вслух на таймере 90 секунд.",
      en: "Where candidates actually fail: isolation levels, MVCC, TIME_WAIT, CPU throttling, nonce reuse. Answer out loud on a 90-second timer." }
  ],
  [
    { ru: "Шаг 4 · практика", en: "Step 4 · practice" },
    { ru: "Вкладка «Кейсы» + «Только пробелы»", en: "Incidents tab, then «Gaps only»" },
    { ru: "Двадцать инцидентов вслух, потом добить всё, что осталось с «−» и «~».",
      en: "Twenty incidents out loud, then clear whatever is still marked minus or tilde." }
  ]
];
