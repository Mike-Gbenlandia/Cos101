import fs from "node:fs";
import path from "node:path";
import type { Question, Taxonomy } from "../lib/types";

const ROOT = process.cwd();
const TAXONOMY_PATH = path.join(ROOT, "data", "taxonomy.json");
const QUESTIONS_DIR = path.join(ROOT, "data", "questions");

function main() {
  const taxonomy = JSON.parse(
    fs.readFileSync(TAXONOMY_PATH, "utf8")
  ) as Taxonomy;

  const allQuestions: Question[] = [];
  for (const file of fs.readdirSync(QUESTIONS_DIR).sort()) {
    if (!file.endsWith(".json")) continue;
    const list = JSON.parse(
      fs.readFileSync(path.join(QUESTIONS_DIR, file), "utf8")
    ) as Question[];
    allQuestions.push(...list);
  }

  const byModule = new Map<string, number>();
  const byUnit = new Map<string, number>();
  const byTopic = new Map<string, number>();
  const byType = { gap: 0, mcq: 0 };

  for (const q of allQuestions) {
    byModule.set(q.module, (byModule.get(q.module) ?? 0) + 1);
    byUnit.set(q.unit, (byUnit.get(q.unit) ?? 0) + 1);
    byTopic.set(q.topic, (byTopic.get(q.topic) ?? 0) + 1);
    if (q.type === "gap") byType.gap++;
    else byType.mcq++;
  }

  console.log(`=== ${taxonomy.courseCode}: ${taxonomy.courseTitle} ===`);
  console.log(
    `Total questions: ${allQuestions.length} (gap: ${byType.gap}, mcq: ${byType.mcq})\n`
  );

  const sparseTopics: Array<{ id: string; title: string; unit: string; count: number }> = [];

  for (const mod of taxonomy.modules) {
    console.log(`[${mod.id}] ${mod.title}: ${byModule.get(mod.id) ?? 0}`);
    for (const unit of mod.units) {
      console.log(`  [${unit.id}] ${unit.title}: ${byUnit.get(unit.id) ?? 0}`);
      for (const topic of unit.topics) {
        const count = byTopic.get(topic.id) ?? 0;
        const flag = count < 8 ? "  <-- LOW (< 8)" : "";
        console.log(`    - ${topic.id} (${topic.title}): ${count}${flag}`);
        if (count < 8) {
          sparseTopics.push({
            id: topic.id,
            title: topic.title,
            unit: unit.id,
            count,
          });
        }
      }
    }
    console.log("");
  }

  console.log(`Topics with fewer than 8 questions (${sparseTopics.length}):`);
  for (const t of sparseTopics) {
    console.log(`  - ${t.unit} / ${t.id}: ${t.count} (${t.title})`);
  }
}

main();
