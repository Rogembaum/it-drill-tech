import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function loadScript(relativePath, globalName) {
  const source = await read(relativePath);
  const window = {};
  new vm.Script(source, { filename: relativePath }).runInNewContext({ window });
  return window[globalName];
}

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".terraform") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await javascriptFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(fullPath);
  }
  return files;
}

function uniqueKeys(records, label) {
  const keys = new Set();
  for (const [index, record] of records.entries()) {
    const location = `${label}[${index}]`;
    check(record && typeof record === "object" && !Array.isArray(record), `${location} must be an object`);
    if (!record || typeof record !== "object" || Array.isArray(record)) continue;
    check(typeof record.key === "string" && record.key.trim().length > 0, `${location}.key must be a non-empty string`);
    if (typeof record.key === "string") {
      check(!keys.has(record.key), `${location} duplicates key "${record.key}"`);
      keys.add(record.key);
    }
  }
  return keys;
}

function checkFields(record, fields, location) {
  for (const field of fields) {
    check(typeof record[field] === "string" && record[field].trim().length > 0,
      `${location}.${field} must be a non-empty string`);
  }
}

function validateTranslations(translations, sourceKeys, label, arrayFields = []) {
  check(translations && typeof translations === "object" && !Array.isArray(translations),
    `${label} must be an object`);
  if (!translations || typeof translations !== "object" || Array.isArray(translations)) return;
  for (const [key, translation] of Object.entries(translations)) {
    check(sourceKeys.has(key), `${label} contains unknown key "${key}"`);
    check(translation && typeof translation === "object" && !Array.isArray(translation),
      `${label}.${key} must be an object`);
    if (!translation || typeof translation !== "object" || Array.isArray(translation)) continue;
    for (const [field, value] of Object.entries(translation)) {
      if (arrayFields.includes(field)) {
        check(Array.isArray(value) && value.every(item => typeof item === "string"),
          `${label}.${key}.${field} must be an array of strings`);
      } else {
        check(typeof value === "string" && value.trim().length > 0,
          `${label}.${key}.${field} must be a non-empty string`);
      }
    }
  }
}

for (const file of await javascriptFiles(root)) {
  const source = await readFile(file, "utf8");
  try {
    new vm.Script(source, { filename: path.relative(root, file) });
  } catch (error) {
    failures.push(`${path.relative(root, file)}: ${error.message}`);
  }
}

const [topics, levels, questions, cases, questionTranslations, caseTranslations] = await Promise.all([
  loadScript("data/config.js", "TOPICS"),
  loadScript("data/config.js", "LEVELS"),
  loadScript("data/questions.js", "QUESTIONS"),
  loadScript("data/cases.js", "CASES"),
  loadScript("data/en/questions.js", "QUESTIONS_EN"),
  loadScript("data/en/cases.js", "CASES_EN"),
]);

check(Array.isArray(topics) && topics.length > 0, "data/config.js must define topics");
check(Array.isArray(levels) && levels.length > 0, "data/config.js must define levels");
check(Array.isArray(questions) && questions.length > 0, "data/questions.js must define questions");
check(Array.isArray(cases) && cases.length > 0, "data/cases.js must define cases");

const topicCodes = new Set((topics || []).map(topic => topic[0]));
const levelCodes = new Set((levels || []).map(level => level[0]));
const questionKeys = uniqueKeys(questions || [], "questions");
const caseKeys = uniqueKeys(cases || [], "cases");

for (const [index, question] of (questions || []).entries()) {
  if (!question || typeof question !== "object" || Array.isArray(question)) continue;
  const location = `questions[${index}]`;
  checkFields(question, ["q", "a", "t", "lvl", "th"], location);
  check(topicCodes.has(question.t), `${location}.t references unknown topic "${question.t}"`);
  check(levelCodes.has(question.lvl), `${location}.lvl references unknown level "${question.lvl}"`);
  for (const field of ["d", "f"]) {
    if (question[field] !== undefined) {
      check(Array.isArray(question[field]) && question[field].every(item => typeof item === "string"),
        `${location}.${field} must be an array of strings`);
    }
  }
}

for (const [index, incident] of (cases || []).entries()) {
  if (!incident || typeof incident !== "object" || Array.isArray(incident)) continue;
  checkFields(incident, ["sev", "tag", "q", "sym", "out", "diag", "cause", "trap"], `cases[${index}]`);
  for (const field of ["hyp", "fix"]) {
    check(Array.isArray(incident[field]) && incident[field].length > 0
      && incident[field].every(item => typeof item === "string"),
    `cases[${index}].${field} must be a non-empty array of strings`);
  }
}

validateTranslations(questionTranslations, questionKeys, "data/en/questions.js", ["d", "f"]);
validateTranslations(caseTranslations, caseKeys, "data/en/cases.js", ["hyp", "fix"]);

const html = await read("index.html");
for (const [, source] of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
  if (/^(?:[a-z]+:)?\/\//i.test(source) || source.startsWith("/")) continue;
  try {
    await read(source);
  } catch {
    failures.push(`index.html references missing script "${source}"`);
  }
}

if (failures.length) {
  console.error(failures.map(message => `ERROR: ${message}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${questions.length} questions, ${cases.length} incident cases, ${questionKeys.size} question translation keys, ${caseKeys.size} case translation keys, and all JavaScript files.`);
}
