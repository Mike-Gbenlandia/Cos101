import { describe, expect, it } from "vitest";
import { isGapAnswerCorrect, normaliseAnswer } from "@/lib/normalise";
import { evaluateTest, getRating } from "@/lib/scoring";
import type { Question } from "@/lib/types";

describe("normaliseAnswer & gap checking", () => {
  it("trims, lowercases, collapses multiple spaces, and strips trailing punctuation", () => {
    expect(normaliseAnswer("  Random   Access   Memory.  ")).toBe(
      "random access memory"
    );
    expect(normaliseAnswer("CPU;")).toBe("cpu");
    expect(normaliseAnswer("1642!")).toBe("1642");
  });

  it("accepts normalised gap answers including case, whitespace, and trailing punctuation", () => {
    expect(isGapAnswerCorrect("  john   napier. ", ["Napier"])).toBe(false);
    expect(isGapAnswerCorrect("  napier. ", ["Napier"])).toBe(true);
    expect(isGapAnswerCorrect("hz", ["Hertz (Hz)", "Hertz", "Hz"])).toBe(true);
    expect(isGapAnswerCorrect("   ", ["Napier"])).toBe(false);
  });
});

describe("evaluateTest", () => {
  const sampleQuestions: Question[] = [
    // Topic A (4 questions: 4/4 -> Strong 100%)
    {
      id: "t-a1",
      module: "m1",
      unit: "m1-u1",
      topic: "pre-mechanical-era-abacus",
      confidence: "high",
      type: "gap",
      question: "Q1 ____",
      acceptedAnswers: ["1450"],
    },
    {
      id: "t-a2",
      module: "m1",
      unit: "m1-u1",
      topic: "pre-mechanical-era-abacus",
      confidence: "high",
      type: "gap",
      question: "Q2 ____",
      acceptedAnswers: ["counting"],
    },
    {
      id: "t-a3",
      module: "m1",
      unit: "m1-u1",
      topic: "pre-mechanical-era-abacus",
      confidence: "high",
      type: "mcq",
      question: "Q3",
      options: [
        { id: "a", text: "Abacus" },
        { id: "b", text: "ENIAC" },
      ],
      answer: "a",
    },
    {
      id: "t-a4",
      module: "m1",
      unit: "m1-u1",
      topic: "pre-mechanical-era-abacus",
      confidence: "high",
      type: "gap",
      question: "Q4 ____",
      acceptedAnswers: ["beads"],
    },
    // Topic B (3 questions: 1/3 -> Weak 33%)
    {
      id: "t-b1",
      module: "m1",
      unit: "m1-u2",
      topic: "classification-by-purpose",
      confidence: "high",
      type: "mcq",
      question: "Q5",
      options: [
        { id: "a", text: "Special" },
        { id: "b", text: "General" },
      ],
      answer: "b",
    },
    {
      id: "t-b2",
      module: "m1",
      unit: "m1-u2",
      topic: "classification-by-purpose",
      confidence: "high",
      type: "gap",
      question: "Q6 ____",
      acceptedAnswers: ["dedicated"],
    },
    {
      id: "t-b3",
      module: "m1",
      unit: "m1-u2",
      topic: "classification-by-purpose",
      confidence: "high",
      type: "gap",
      question: "Q7 ____",
      acceptedAnswers: ["versatility"],
    },
    // Topic C (2 questions: < 3 -> "Too few questions to judge")
    {
      id: "t-c1",
      module: "m2",
      unit: "m2-u1",
      topic: "definitions-computer-computing",
      confidence: "high",
      type: "gap",
      question: "Q8 ____",
      acceptedAnswers: ["CPU"],
    },
    {
      id: "t-c2",
      module: "m2",
      unit: "m2-u1",
      topic: "definitions-computer-computing",
      confidence: "high",
      type: "gap",
      question: "Q9 ____",
      acceptedAnswers: ["program"],
    },
  ];

  it("computes accurate total score, skips, roll-ups, weak-first sorting, and <3 guard", () => {
    const result = evaluateTest({
      testId: "test-1",
      mode: "standard",
      elapsedSeconds: 320,
      questions: sampleQuestions,
      answers: {
        "t-a1": " 1450. ",
        "t-a2": "COUNTING",
        "t-a3": "a",
        "t-a4": "beads",
        "t-b1": "b",
        "t-b2": "wrong",
        // t-b3 skipped
        "t-c1": "cpu",
        "t-c2": "wrong",
      },
      flagged: ["t-b2"],
    });

    // 4 (Topic A) + 1 (Topic B) + 1 (Topic C) = 6 / 9
    expect(result.score).toBe(6);
    expect(result.total).toBe(9);
    expect(result.percentage).toBe(67);

    // Topic breakdown: Weakest judged first (33%), then Strong (100%), then <3 ("Too few questions to judge")
    expect(result.topicStats.map((t) => t.id)).toEqual([
      "classification-by-purpose",
      "pre-mechanical-era-abacus",
      "definitions-computer-computing",
    ]);
    expect(result.topicStats[0].rating).toBe("Weak");
    expect(result.topicStats[1].rating).toBe("Strong");
    expect(result.topicStats[2].rating).toBe("Too few questions to judge");

    // Unit roll-ups
    const u1 = result.unitStats.find((u) => u.id === "m1-u1")!;
    expect(u1.correct).toBe(4);
    expect(u1.total).toBe(4);
    expect(u1.rating).toBe("Strong");

    const u2 = result.unitStats.find((u) => u.id === "m1-u2")!;
    expect(u2.correct).toBe(1);
    expect(u2.total).toBe(3);
    expect(u2.attempted).toBe(2);
    expect(u2.rating).toBe("Weak");

    // Module roll-ups
    const m1 = result.moduleStats.find((m) => m.id === "m1")!;
    expect(m1.correct).toBe(5);
    expect(m1.total).toBe(7);
    expect(m1.percentage).toBe(71);
    expect(m1.rating).toBe("Fair");

    // Read next lists Weak then Fair topics with non-empty course reference
    expect(result.readNextTopics).toHaveLength(1);
    expect(result.readNextTopics[0].id).toBe("classification-by-purpose");
    expect(result.readNextTopics[0].reference).toContain("Module 1, Unit 2");

    // Skipped & flagged tracking
    const skippedItem = result.reviewedQuestions.find(
      (r) => r.question.id === "t-b3"
    )!;
    expect(skippedItem.isSkipped).toBe(true);
    expect(skippedItem.isCorrect).toBe(false);

    const flaggedItem = result.reviewedQuestions.find(
      (r) => r.question.id === "t-b2"
    )!;
    expect(flaggedItem.isFlagged).toBe(true);
  });

  it("applies exact rating thresholds", () => {
    expect(getRating(2, 2)).toBe("Too few questions to judge");
    expect(getRating(3, 4)).toBe("Strong"); // 75%
    expect(getRating(2, 4)).toBe("Fair"); // 50%
    expect(getRating(2, 5)).toBe("Weak"); // 40%
  });
});
