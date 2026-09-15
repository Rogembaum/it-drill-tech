/* ============================================================================
   СТРОКИ ИНТЕРФЕЙСА
   Всё, что видно на странице и не является содержанием вопросов.
   Чтобы добавить язык: допишите блок с его кодом и добавьте код
   в window.LANGS ниже. Недостающие строки берутся из русского.
   ============================================================================ */

/* Языки в порядке отображения в переключателе: [код, подпись, html lang] */
window.LANGS = [
  ["ru", "RU", "ru"],
  ["en", "EN", "en"]
];

window.I18N = {

  ru: {
    /* шапка */
    metaQuestions: ["вопрос", "вопроса", "вопросов"],
    metaCases:     ["разбор инцидента", "разбора инцидентов", "разборов инцидентов"],
    metaStorage:   "Оценка себя сохраняется <b>в браузере</b>",

    /* панель */
    viewQuestions: "Вопросы",
    viewCases:     "Кейсы",
    levelLabel:    "Уровень",
    searchPlaceholder: "Поиск: TIME_WAIT, vacuum, inode, GCM…",
    btnGaps:       "Только пробелы",
    btnUnseen:     "Неотмеченные",
    btnRandom:     "Случайный",
    btnExpand:     "Раскрыть все",
    btnCollapse:   "Свернуть все",
    btnReset:      "Сброс оценок",
    btnExport:     "Выгрузить прогресс",
    btnImport:     "Загрузить",
    exportTitle:   "Скачать прогресс файлом",
    importTitle:   "Перенести прогресс из другого браузера",
    shown:         "Показано {n} из {total}",
    emptyFilter:   "Под фильтр ничего не попало — снимите часть условий.",

    /* вопрос */
    tagHard:       "каверзный",
    markKnow:      "Знаю",
    markShaky:     "Плаваю",
    markUnknown:   "Не знаю",
    paneShort:     "Как отвечать",
    paneDeep:      "Детали, если копают",
    paneFollow:    "Куда уведут дальше",
    ladderDeeper:  "Та же тема глубже",
    ladderOther:   "Та же тема на другом уровне",

    /* кейс */
    caseSolve:     "Показать разбор",
    caseHide:      "Свернуть разбор",
    caseMarkOk:    "Разобрал сам",
    caseMarkNo:    "Не смог",
    paneHyp:       "Гипотезы по убыванию вероятности",
    paneDiag:      "Как проверяем",
    paneCause:     "Корневая причина",
    paneFix:       "Что делаем",
    paneTrap:      "Ловушка, в которую тут попадают",

    /* перевод */
    untranslated:      "RU",
    untranslatedTitle: "Перевод на английский пока не готов — показан оригинал",
    /* {n} — сколько записей без перевода, {total} — сколько всего */
    langNoteAll:       "Перевод этого раздела пока не готов: все {total} записи показаны на русском.",
    langNotePart:      "Переведено не всё: {n} из {total} записей показаны на русском и помечены RU.",

    /* сообщения */
    confirmReset:  "Сбросить все оценки? Это нельзя отменить.",
    importedN:     "Перенесено оценок: {n}",
    importFailed:  "Не удалось прочитать файл: {err}",
    importNoMarks: "нет поля marks"
  },

  en: {
    metaQuestions: ["question", "questions", "questions"],
    metaCases:     ["incident walkthrough", "incident walkthroughs", "incident walkthroughs"],
    metaStorage:   "Progress is kept <b>in your browser</b>",

    viewQuestions: "Questions",
    viewCases:     "Incidents",
    levelLabel:    "Level",
    searchPlaceholder: "Search: TIME_WAIT, vacuum, inode, GCM…",
    btnGaps:       "Gaps only",
    btnUnseen:     "Unmarked",
    btnRandom:     "Random",
    btnExpand:     "Expand all",
    btnCollapse:   "Collapse all",
    btnReset:      "Reset marks",
    btnExport:     "Export progress",
    btnImport:     "Import",
    exportTitle:   "Download your progress as a file",
    importTitle:   "Bring progress over from another browser",
    shown:         "Showing {n} of {total}",
    emptyFilter:   "Nothing matches these filters — try removing some.",

    tagHard:       "tricky",
    markKnow:      "I know this",
    markShaky:     "Shaky",
    markUnknown:   "No idea",
    paneShort:     "What to say",
    paneDeep:      "Detail, if they dig",
    paneFollow:    "Where it goes next",
    ladderDeeper:  "Same topic, deeper",
    ladderOther:   "Same topic, another level",

    caseSolve:     "Show the walkthrough",
    caseHide:      "Hide the walkthrough",
    caseMarkOk:    "Solved it myself",
    caseMarkNo:    "Could not",
    paneHyp:       "Hypotheses, most likely first",
    paneDiag:      "How we check",
    paneCause:     "Root cause",
    paneFix:       "What we do",
    paneTrap:      "The trap people fall into here",

    untranslated:      "RU",
    untranslatedTitle: "Not translated yet — showing the Russian original",
    langNoteAll:       "This section is not translated yet: all {total} entries are shown in Russian.",
    langNotePart:      "Partly translated: {n} of {total} entries are shown in Russian and marked RU.",

    confirmReset:  "Reset all marks? This cannot be undone.",
    importedN:     "Marks imported: {n}",
    importFailed:  "Could not read the file: {err}",
    importNoMarks: "no marks field"
  }
};
