import { describe, expect, it } from "vitest";
import { generateTest } from "@/lib/generate-test";
import { allQuestions } from "@/lib/questions";

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe("generateTest", () => {
  it("generates 70 unique questions with no duplicates", () => {
    const test = generateTest(allQuestions, {
      count: 70,
      rng: createSeededRng(42),
    });

    expect(test.questions).toHaveLength(70);
    expect(test.actualCount).toBe(70);
    expect(test.smallerBankNotice).toBe(false);

    const uniqueIds = new Set(test.questions.map((q) => q.id));
    expect(uniqueIds.size).toBe(70);
  });

  it("represents every non-empty unit and unit spread sums to 70", () => {
    const test = generateTest(allQuestions, {
      count: 70,
      rng: createSeededRng(101),
    });

    const nonEmptyUnits = new Set(allQuestions.map((q) => q.unit));
    const representedUnits = new Set(test.questions.map((q) => q.unit));

    for (const unitId of nonEmptyUnits) {
      expect(representedUnits.has(unitId)).toBe(true);
    }

    const allocatedSum = Object.values(test.unitAllocation).reduce(
      (sum, n) => sum + n,
      0
    );
    expect(allocatedSum).toBe(70);

    const actualUnitCounts = new Map<string, number>();
    for (const q of test.questions) {
      actualUnitCounts.set(q.unit, (actualUnitCounts.get(q.unit) ?? 0) + 1);
    }
    for (const [unitId, quota] of Object.entries(test.unitAllocation)) {
      expect(actualUnitCounts.get(unitId) ?? 0).toBe(quota);
    }
  });

  it("shifts unit counts proportionally when module weights override is supplied", () => {
    const baseline = generateTest(allQuestions, {
      count: 70,
      moduleWeights: null,
      rng: createSeededRng(7),
    });
    const weighted = generateTest(allQuestions, {
      count: 70,
      moduleWeights: { m1: 4, m2: 1, m3: 1, m4: 1, m5: 1, m6: 1 },
      rng: createSeededRng(7),
    });

    const countModule = (qs: typeof baseline.questions, modId: string) =>
      qs.filter((q) => q.module === modId).length;

    expect(countModule(weighted.questions, "m1")).toBeGreaterThan(
      countModule(baseline.questions, "m1")
    );
    expect(weighted.questions).toHaveLength(70);
  });

  it("prefers unseen questions before reusing seen ones", () => {
    const subset = allQuestions.slice(0, 80);
    const seenIds = new Set(subset.slice(0, 40).map((q) => q.id));

    const test = generateTest(subset, {
      count: 40,
      seenIds,
      rng: createSeededRng(99),
    });

    // At least almost all slots should come from unseen pool (subject to min-1 per unit)
    const unseenSelected = test.questions.filter((q) => !seenIds.has(q.id));
    expect(unseenSelected.length).toBeGreaterThanOrEqual(35);
  });

  it("shuffles question order across different RNG seeds", () => {
    const run1 = generateTest(allQuestions, {
      count: 70,
      rng: createSeededRng(1),
    });
    const run2 = generateTest(allQuestions, {
      count: 70,
      rng: createSeededRng(2),
    });

    const ids1 = run1.questions.map((q) => q.id);
    const ids2 = run2.questions.map((q) => q.id);
    expect(ids1).not.toEqual(ids2);
  });

  it("shuffles question options while preserving the correct option by stable id", () => {
    const bankById = new Map(allQuestions.map((q) => [q.id, q]));
    const test = generateTest(allQuestions, {
      count: 70,
      rng: createSeededRng(55),
    });

    let sawReorderedOptions = false;
    for (const q of test.questions) {
      if (!q.options || q.options.length === 0) continue;
      const original = bankById.get(q.id)!;
      const origCorrectText = original.options!.find(
        (o) => o.id === original.answer
      )?.text;
      const shuffledCorrectText = q.options.find(
        (o) => o.id === q.answer
      )?.text;

      expect(shuffledCorrectText).toBe(origCorrectText);
      expect(q.options.map((o) => o.id).sort()).toEqual(
        original.options!.map((o) => o.id).sort()
      );

      if (
        q.options.map((o) => o.id).join(",") !==
        original.options!.map((o) => o.id).join(",")
      ) {
        sawReorderedOptions = true;
      }
    }

    expect(sawReorderedOptions).toBe(true);
  });

  it("falls back cleanly with smallerBankNotice when fewer than 70 questions exist", () => {
    const smallPool = allQuestions.slice(0, 12);
    const test = generateTest(smallPool, {
      count: 70,
      rng: createSeededRng(12),
    });

    expect(test.actualCount).toBe(12);
    expect(test.questions).toHaveLength(12);
    expect(test.smallerBankNotice).toBe(true);
  });
});
