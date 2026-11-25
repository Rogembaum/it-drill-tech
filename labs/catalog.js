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
  {
    id: "aidevops",
    tags: ["AI DevOps"],
    title: { ru: "AI DevOps: агенты, RAG, evals", en: "AI DevOps: agents, RAG, evals" },
    lede: {
      ru: "Задачи с автопроверкой на CPU и kind: сервис агента и tool calling, MCP, Kubernetes, CI-гейты, безопасность, RAG, evals, автоматизация и LLM serving, LLM-шлюзы (LiteLLM, OpenRouter, биллинг), AI firewall и PII, безопасный инференс и выбор моделей, OpenWebUI и coding-харнессы. Архитектура агентов: цикл, ReAct и Plan→Execute, память, остановка и мультиагентный разбор GitLab. Практикумы с чек-листами, вопросы, экзамен, сертификации и портфолио.",
      en: "Auto-graded tasks on CPU and kind: agent service and tool calling, MCP, Kubernetes, CI gates, security, RAG, evals, automation and LLM serving, LLM gateways (LiteLLM, OpenRouter, billing), AI firewall and PII, secure inference and model selection, OpenWebUI and coding harnesses. Agent architecture: the loop, ReAct and Plan-and-Execute, memory, stop conditions and a multi-agent GitLab review. Checklist workshops, questions, an exam, certifications and portfolio tracks."
    },
    stats: { ru: "74 задачи · 172 вопроса · 46 практикумов", en: "74 tasks · 172 questions · 46 workshops" },
    store: "it-drill-lab-aidevops-v1"
  }
];
