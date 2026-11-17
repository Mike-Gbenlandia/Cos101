import fs from "node:fs";
import path from "node:path";
import type { Taxonomy } from "../lib/types";

const ROOT = process.cwd();
const TAXONOMY_PATH = path.join(ROOT, "data", "taxonomy.json");

function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function main() {
  const input = process.argv.slice(2).join(" ").trim();
  if (!input) {
    console.error('Usage: npx tsx scripts/suggest-topic.ts "<question text>"');
    process.exit(1);
  }

  const taxonomy = JSON.parse(
    fs.readFileSync(TAXONOMY_PATH, "utf8")
  ) as Taxonomy;
  const inputTokens = tokenise(input);

  const scored: Array<{
    moduleId: string;
    unitId: string;
    topicId: string;
    title: string;
    reference: string;
    score: number;
  }> = [];

  for (const mod of taxonomy.modules) {
    for (const unit of mod.units) {
      for (const topic of unit.topics) {
        const refTokens = tokenise(
          `${mod.title} ${unit.title} ${topic.title} ${topic.id.replace(/-/g, " ")} ${topic.reference}`
        );
        let overlap = 0;
        for (const t of inputTokens) {
          if (refTokens.has(t)) overlap++;
        }
        scored.push({
          moduleId: mod.id,
          unitId: unit.id,
          topicId: topic.id,
          title: topic.title,
          reference: topic.reference,
          score: overlap,
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const top3 = scored.slice(0, 3);

  console.log(`Question: "${input}"\nTop 3 suggested topics:`);
  top3.forEach((item, idx) => {
    console.log(
      `${idx + 1}. [${item.moduleId} > ${item.unitId} > ${item.topicId}] ${item.title} (score: ${item.score})`
    );
    console.log(`   Reference: ${item.reference}`);
  });
}

main();
