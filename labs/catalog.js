/* ============================================================================
   КАТАЛОГ ЛАБ
   Каждая запись — одна лаба. Теги в tags становятся фильтрами на вкладке
   «Лабы»; если под тегом одна лаба, она открывается сразу.

   Чтобы добавить лабу: создайте labs/<id>/data.js и labs/<id>/lab.js
   (см. labs/kit.js), допишите запись сюда и уберите soon.
   soon: true — карточка-анонс, открыть её нельзя.
   store — ключ localStorage с прогрессом лабы; попадает в «Выгрузить прогресс».
   ============================================================================ */
window.LAB_CATALOG = [
  {
    id: "cka",
    tags: ["Kubernetes"],
    title: { ru: "CKA — Certified Kubernetes Administrator", en: "CKA — Certified Kubernetes Administrator" },
    lede: {
      ru: "Задачи в формате экзамена на локальном кластере kind с автопроверкой, пробный экзамен на 120 минут, вопросы на понимание, тренировка скорости команд и памятка на день экзамена.",
      en: "Exam-style tasks on a local kind cluster with automatic grading, a 120-minute mock exam, comprehension questions, command speed drills and an exam-day checklist."
    },
    stats: { ru: "53 задачи · 63 вопроса · 58 карточек", en: "53 tasks · 63 questions · 58 cards" },
    store: "it-drill-lab-cka-v1"
  },
  { id: "csi",      tags: ["CSI"],       soon: true, title: { ru: "Хранилище и CSI-драйверы", en: "Storage and CSI drivers" } },
  { id: "cni",      tags: ["CNI"],       soon: true, title: { ru: "Сеть кластера и CNI",      en: "Cluster networking and CNI" } },
  { id: "argocd",   tags: ["Argo CD"],   soon: true, title: { ru: "GitOps на Argo CD",        en: "GitOps with Argo CD" } },
  { id: "aidevops", tags: ["AI DevOps"], soon: true, title: { ru: "AI DevOps: агенты, RAG, evals", en: "AI DevOps: agents, RAG, evals" } }
];
