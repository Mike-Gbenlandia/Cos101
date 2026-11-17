import { MODULE_WEIGHTS, QUESTIONS_PER_TEST } from "@/config/test-config";
import type { GeneratedTest, Question, TestMode } from "./types";

export function shuffleArray<T>(
  items: readonly T[],
  rng: () => number = Math.random
): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface GenerateTestOptions {
  count?: number;
  seenIds?: ReadonlySet<string>;
  moduleWeights?: Record<string, number> | null;
  mode?: TestMode;
  rng?: () => number;
}

/**
 * Computes how many questions each non-empty unit should receive using
 * largest-remainder proportional allocation with a floor of 1 per unit
 * (when total target >= number of non-empty units) and capacity caps.
 */
export function allocateUnitQuotas(
  unitGroups: Map<string, Question[]>,
  targetCount: number,
  moduleWeights: Record<string, number> | null
): Record<string, number> {
  const nonEmptyUnits = Array.from(unitGroups.entries()).filter(
    ([, qs]) => qs.length > 0
  );
  const allocation: Record<string, number> = {};
  if (nonEmptyUnits.length === 0 || targetCount <= 0) return allocation;

  const totalAvailable = nonEmptyUnits.reduce((sum, [, qs]) => sum + qs.length, 0);
  const effectiveTarget = Math.min(targetCount, totalAvailable);

  if (effectiveTarget <= nonEmptyUnits.length) {
    // Fewer slots than units: give 1 to the highest-weighted units
    const sorted = [...nonEmptyUnits].sort((a, b) => {
      const wa = (moduleWeights?.[a[1][0].module] ?? 1) * a[1].length;
      const wb = (moduleWeights?.[b[1][0].module] ?? 1) * b[1].length;
      return wb - wa;
    });
    for (let i = 0; i < effectiveTarget; i++) {
      allocation[sorted[i][0]] = 1;
    }
    return allocation;
  }

  // Baseline floor of 1 for every non-empty unit
  for (const [unitId] of nonEmptyUnits) {
    allocation[unitId] = 1;
  }

  let remaining = effectiveTarget - nonEmptyUnits.length;

  // Iterative largest-remainder redistribution honoring unit capacities
  while (remaining > 0) {
    const expandable = nonEmptyUnits.filter(
      ([unitId, qs]) => (allocation[unitId] ?? 0) < qs.length
    );
    if (expandable.length === 0) break;

    const weights = expandable.map(([unitId, qs]) => {
      const modWeight = moduleWeights?.[qs[0].module] ?? 1;
      const weight = Math.max(0.0001, modWeight * qs.length);
      return {
        unitId,
        capacityLeft: qs.length - (allocation[unitId] ?? 0),
        weight,
      };
    });

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    const quotas = weights.map((w) => {
      const exact = (remaining * w.weight) / totalWeight;
      const whole = Math.min(w.capacityLeft, Math.floor(exact));
      return {
        ...w,
        whole,
        remainder: exact - Math.floor(exact),
      };
    });

    let addedThisPass = 0;
    for (const q of quotas) {
      if (q.whole > 0) {
        allocation[q.unitId] += q.whole;
        remaining -= q.whole;
        addedThisPass += q.whole;
      }
    }

    // Distribute remaining 1-by-1 by largest remainder
    quotas.sort((a, b) => b.remainder - a.remainder);
    for (const q of quotas) {
      if (remaining <= 0) break;
      const capLeft =
        (unitGroups.get(q.unitId)?.length ?? 0) - (allocation[q.unitId] ?? 0);
      if (capLeft > 0) {
        allocation[q.unitId] += 1;
        remaining -= 1;
        addedThisPass += 1;
      }
    }

    if (addedThisPass === 0) break;
  }

  return allocation;
}

/**
 * Selects `quota` questions from a unit by spreading draws evenly across topics
 * and strictly preferring unseen questions before reusing seen ones.
 */
function pickQuestionsForUnit(
  unitQuestions: Question[],
  quota: number,
  seenIds: ReadonlySet<string>,
  rng: () => number
): Question[] {
  if (quota <= 0 || unitQuestions.length === 0) return [];

  const byTopic = new Map<string, { unseen: Question[]; seen: Question[] }>();
  for (const q of unitQuestions) {
    let bucket = byTopic.get(q.topic);
    if (!bucket) {
      bucket = { unseen: [], seen: [] };
      byTopic.set(q.topic, bucket);
    }
    if (seenIds.has(q.id)) bucket.seen.push(q);
    else bucket.unseen.push(q);
  }

  const topicQueues = shuffleArray(Array.from(byTopic.values()), rng).map(
    (b) => ({
      unseen: shuffleArray(b.unseen, rng),
      seen: shuffleArray(b.seen, rng),
    })
  );

  const chosen: Question[] = [];

  // Pass 1: Round-robin across topics pulling unseen questions first
  let drewInPass = true;
  while (chosen.length < quota && drewInPass) {
    drewInPass = false;
    for (const tq of topicQueues) {
      if (chosen.length >= quota) break;
      const nextUnseen = tq.unseen.pop();
      if (nextUnseen) {
        chosen.push(nextUnseen);
        drewInPass = true;
      }
    }
  }

  // Pass 2: If unseen questions are exhausted, round-robin across seen questions
  drewInPass = true;
  while (chosen.length < quota && drewInPass) {
    drewInPass = false;
    for (const tq of topicQueues) {
      if (chosen.length >= quota) break;
      const nextSeen = tq.seen.pop();
      if (nextSeen) {
        chosen.push(nextSeen);
        drewInPass = true;
      }
    }
  }

  return chosen;
}

function cloneWithShuffledOptions(
  q: Question,
  rng: () => number
): Question {
  if (!q.options || q.options.length === 0) {
    return { ...q };
  }
  return {
    ...q,
    options: shuffleArray(q.options, rng).map((o) => ({ ...o })),
  };
}

/**
 * Generates a CBT practice test with proportional unit allocation, even topic
 * coverage inside units, unseen-first prioritization, and shuffled questions & options.
 */
export function generateTest(
  pool: Question[],
  options: GenerateTestOptions = {}
): GeneratedTest {
  const {
    count = QUESTIONS_PER_TEST,
    seenIds = new Set<string>(),
    moduleWeights = MODULE_WEIGHTS,
    mode = "standard",
    rng = Math.random,
  } = options;

  const uniquePool = Array.from(new Map(pool.map((q) => [q.id, q])).values());
  const unitGroups = new Map<string, Question[]>();
  for (const q of uniquePool) {
    const arr = unitGroups.get(q.unit) ?? [];
    arr.push(q);
    unitGroups.set(q.unit, arr);
  }

  const targetCount = Math.min(count, uniquePool.length);
  const unitAllocation = allocateUnitQuotas(
    unitGroups,
    targetCount,
    moduleWeights
  );

  const selected: Question[] = [];
  for (const [unitId, quota] of Object.entries(unitAllocation)) {
    const unitQs = unitGroups.get(unitId) ?? [];
    selected.push(...pickQuestionsForUnit(unitQs, quota, seenIds, rng));
  }

  const shuffledQuestions = shuffleArray(selected, rng).map((q) =>
    cloneWithShuffledOptions(q, rng)
  );

  const id = `test-${Date.now()}-${Math.floor(rng() * 100000)}`;

  return {
    id,
    mode,
    createdAt: new Date().toISOString(),
    questions: shuffledQuestions,
    requestedCount: count,
    actualCount: shuffledQuestions.length,
    smallerBankNotice: uniquePool.length < count,
    unitAllocation,
  };
}
