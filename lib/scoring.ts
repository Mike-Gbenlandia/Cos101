import { isGapAnswerCorrect } from "./normalise";
import { taxonomyLookups } from "./taxonomy";
import type {
  BreakdownStat,
  EvaluationResult,
  Question,
  ReviewedQuestion,
  TestMode,
  TopicRating,
} from "./types";

export function getRating(correct: number, total: number): TopicRating {
  if (total < 3) return "Too few questions to judge";
  const pct = Math.round((correct / total) * 100);
  if (pct >= 75) return "Strong";
  if (pct >= 50) return "Fair";
  return "Weak";
}

function buildBreakdownList(
  aggregates: Map<
    string,
    { id: string; title: string; reference?: string; correct: number; attempted: number; total: number }
  >
): BreakdownStat[] {
  return Array.from(aggregates.values()).map((agg) => {
    const percentage =
      agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : 0;
    return {
      ...agg,
      percentage,
      rating: getRating(agg.correct, agg.total),
    };
  });
}

export interface EvaluateTestParams {
  testId: string;
  mode: TestMode;
  elapsedSeconds: number;
  questions: Question[];
  answers: Record<string, string>;
  flagged: string[];
  completedAt?: string;
}

export function evaluateTest(params: EvaluateTestParams): EvaluationResult {
  const {
    testId,
    mode,
    elapsedSeconds,
    questions,
    answers,
    flagged,
    completedAt = new Date().toISOString(),
  } = params;

  const flaggedSet = new Set(flagged);
  const topicAgg = new Map<
    string,
    { id: string; title: string; reference?: string; correct: number; attempted: number; total: number }
  >();
  const unitAgg = new Map<
    string,
    { id: string; title: string; correct: number; attempted: number; total: number }
  >();
  const moduleAgg = new Map<
    string,
    { id: string; title: string; correct: number; attempted: number; total: number }
  >();

  let score = 0;
  const reviewedQuestions: ReviewedQuestion[] = [];

  for (const q of questions) {
    const rawUserAns = (answers[q.id] ?? "").trim();
    const isSkipped = rawUserAns.length === 0;

    let isCorrect = false;
    let userAnswerDisplay = "";
    let correctAnswerDisplay = "";

    if (q.options && q.options.length > 0) {
      isCorrect = !isSkipped && rawUserAns === q.answer;
      const selectedOpt = q.options.find((o) => o.id === rawUserAns);
      const correctOpt = q.options.find((o) => o.id === q.answer);
      userAnswerDisplay = selectedOpt ? selectedOpt.text : "";
      correctAnswerDisplay = correctOpt ? correctOpt.text : q.answer ?? "";
    } else {
      isCorrect = !isSkipped && isGapAnswerCorrect(rawUserAns, q.acceptedAnswers);
      userAnswerDisplay = rawUserAns;
      correctAnswerDisplay = (q.acceptedAnswers ?? [])[0] ?? "";
    }

    if (isCorrect) score++;

    const topicEntry = taxonomyLookups.topicById.get(q.topic);
    const unitEntry = taxonomyLookups.unitById.get(q.unit);
    const modEntry = taxonomyLookups.moduleById.get(q.module);

    const topicTitle = topicEntry?.topic.title ?? q.topic;
    const topicRef = topicEntry?.topic.reference ?? "";
    const unitTitle = unitEntry?.unit.title ?? q.unit;
    const moduleTitle = modEntry?.title ?? q.module;

    const tStat = topicAgg.get(q.topic) ?? {
      id: q.topic,
      title: topicTitle,
      reference: topicRef,
      correct: 0,
      attempted: 0,
      total: 0,
    };
    tStat.total += 1;
    if (!isSkipped) tStat.attempted += 1;
    if (isCorrect) tStat.correct += 1;
    topicAgg.set(q.topic, tStat);

    const uStat = unitAgg.get(q.unit) ?? {
      id: q.unit,
      title: unitTitle,
      correct: 0,
      attempted: 0,
      total: 0,
    };
    uStat.total += 1;
    if (!isSkipped) uStat.attempted += 1;
    if (isCorrect) uStat.correct += 1;
    unitAgg.set(q.unit, uStat);

    const mStat = moduleAgg.get(q.module) ?? {
      id: q.module,
      title: moduleTitle,
      correct: 0,
      attempted: 0,
      total: 0,
    };
    mStat.total += 1;
    if (!isSkipped) mStat.attempted += 1;
    if (isCorrect) mStat.correct += 1;
    moduleAgg.set(q.module, mStat);

    reviewedQuestions.push({
      question: q,
      userAnswer: userAnswerDisplay,
      correctAnswerDisplay,
      isCorrect,
      isSkipped,
      isFlagged: flaggedSet.has(q.id),
      topicTitle,
      unitTitle,
      moduleTitle,
    });
  }

  // Topic table sorted weakest first: judged topics ascending by percentage, then <3 topics
  const topicStats = buildBreakdownList(topicAgg).sort((a, b) => {
    const aLow = a.rating === "Too few questions to judge";
    const bLow = b.rating === "Too few questions to judge";
    if (aLow !== bLow) return aLow ? 1 : -1;
    if (a.percentage !== b.percentage) return a.percentage - b.percentage;
    return b.total - a.total;
  });

  const unitStats = buildBreakdownList(unitAgg).sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  const moduleStats = buildBreakdownList(moduleAgg).sort((a, b) =>
    a.id.localeCompare(b.id)
  );

  const weakTopics = topicStats.filter((t) => t.rating === "Weak");
  const fairTopics = topicStats.filter((t) => t.rating === "Fair");
  const readNextTopics = [...weakTopics, ...fairTopics];
  const strongestTopics = topicStats
    .filter((t) => t.rating === "Strong")
    .sort((a, b) => b.percentage - a.percentage || b.total - a.total);

  const total = questions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  return {
    testId,
    mode,
    completedAt,
    elapsedSeconds,
    score,
    total,
    percentage,
    topicStats,
    unitStats,
    moduleStats,
    readNextTopics,
    strongestTopics,
    reviewedQuestions,
  };
}
