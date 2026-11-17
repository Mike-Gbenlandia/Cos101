import fs from "node:fs";
import path from "node:path";
import type { Question, Taxonomy } from "../lib/types";

const ROOT = process.cwd();
const TAXONOMY_PATH = path.join(ROOT, "data", "taxonomy.json");
const QUESTIONS_DIR = path.join(ROOT, "data", "questions");

function main() {
  if (!fs.existsSync(TAXONOMY_PATH)) {
    console.error("Validation failed: missing data/taxonomy.json");
    process.exit(1);
  }
  const taxonomy = JSON.parse(
    fs.readFileSync(TAXONOMY_PATH, "utf8")
  ) as Taxonomy;

  const moduleIds = new Set<string>();
  const unitToModule = new Map<string, string>();
  const topicToUnit = new Map<string, string>();

  for (const mod of taxonomy.modules) {
    if (moduleIds.has(mod.id)) {
      console.error(`Validation failed: duplicate module ID "${mod.id}"`);
      process.exit(1);
    }
    moduleIds.add(mod.id);
    for (const unit of mod.units) {
      if (unitToModule.has(unit.id)) {
        console.error(`Validation failed: duplicate unit ID "${unit.id}"`);
        process.exit(1);
      }
      unitToModule.set(unit.id, mod.id);
      for (const topic of unit.topics) {
        if (topicToUnit.has(topic.id)) {
          console.error(`Validation failed: duplicate topic ID "${topic.id}"`);
          process.exit(1);
        }
        topicToUnit.set(topic.id, unit.id);
        if (!topic.reference || !topic.reference.trim()) {
          console.error(
            `Validation failed: topic "${topic.id}" is missing a course reference`
          );
          process.exit(1);
        }
      }
    }
  }

  if (!fs.existsSync(QUESTIONS_DIR)) {
    console.error("Validation failed: missing data/questions directory");
    process.exit(1);
  }

  const files = fs
    .readdirSync(QUESTIONS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (files.length === 0) {
    console.error("Validation failed: no question JSON files in data/questions");
    process.exit(1);
  }

  const seenIds = new Set<string>();
  const errors: string[] = [];
  let totalQuestions = 0;

  for (const file of files) {
    const filePath = path.join(QUESTIONS_DIR, file);
    const unitFromFilename = file.replace(/\.json$/, "");
    let questions: Question[];
    try {
      questions = JSON.parse(fs.readFileSync(filePath, "utf8")) as Question[];
    } catch (err) {
      errors.push(`${file}: invalid JSON (${String(err)})`);
      continue;
    }

    if (!Array.isArray(questions)) {
      errors.push(`${file}: expected top-level array`);
      continue;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      totalQuestions++;
      const loc = `${file}[${i}] (${q.id || "no-id"})`;

      if (!q.id || !q.id.trim()) {
        errors.push(`${loc}: missing question id`);
      } else if (seenIds.has(q.id)) {
        errors.push(`${loc}: duplicate question id "${q.id}"`);
      } else {
        seenIds.add(q.id);
      }

      if (!moduleIds.has(q.module)) {
        errors.push(`${loc}: unknown module "${q.module}"`);
      }

      const expectedMod = unitToModule.get(q.unit);
      if (!expectedMod) {
        errors.push(`${loc}: unknown unit "${q.unit}"`);
      } else if (expectedMod !== q.module) {
        errors.push(
          `${loc}: unit "${q.unit}" belongs to module "${expectedMod}", not "${q.module}"`
        );
      }

      if (q.unit !== unitFromFilename) {
        errors.push(
          `${loc}: question unit "${q.unit}" does not match filename "${file}"`
        );
      }

      const expectedUnit = topicToUnit.get(q.topic);
      if (!expectedUnit) {
        errors.push(`${loc}: unknown topic "${q.topic}"`);
      } else if (expectedUnit !== q.unit) {
        errors.push(
          `${loc}: topic "${q.topic}" belongs to unit "${expectedUnit}", not "${q.unit}"`
        );
      }

      if (!q.question || !q.question.trim()) {
        errors.push(`${loc}: empty question text`);
      }

      if (q.type === "gap" && !q.question.includes("____")) {
        errors.push(`${loc}: gap question does not contain "____"`);
      }

      if (q.options && q.options.length > 0) {
        if (q.options.length < 2) {
          errors.push(`${loc}: options array must have at least 2 options`);
        }
        const optIds = new Set<string>();
        for (const opt of q.options) {
          if (!opt.id || !opt.id.trim()) {
            errors.push(`${loc}: option missing id`);
          } else if (optIds.has(opt.id)) {
            errors.push(`${loc}: duplicate option id "${opt.id}"`);
          } else {
            optIds.add(opt.id);
          }
          if (!opt.text || !opt.text.trim()) {
            errors.push(`${loc}: option "${opt.id}" has empty text`);
          }
        }
        if (!q.answer || !optIds.has(q.answer)) {
          errors.push(
            `${loc}: answer "${q.answer}" does not match any option id`
          );
        }
      } else {
        if (
          !q.acceptedAnswers ||
          q.acceptedAnswers.length === 0 ||
          q.acceptedAnswers.some((a) => !a || !a.trim())
        ) {
          errors.push(
            `${loc}: optionless question must have non-empty acceptedAnswers`
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error(`Validation failed with ${errors.length} error(s):`);
    for (const err of errors.slice(0, 50)) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `Validation passed: ${totalQuestions} questions across ${files.length} unit files verified cleanly.`
  );
}

main();
