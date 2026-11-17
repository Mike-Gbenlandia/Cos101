"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Dumbbell,
  Flag,
  MinusCircle,
  Play,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { QuestionStem } from "@/components/QuestionStem";
import { QUESTIONS_PER_TEST } from "@/config/test-config";
import { formatDuration, ratingToneClasses } from "@/lib/format";
import { allQuestions } from "@/lib/questions";
import { startAndPersistTest } from "@/lib/start-session";
import { getLastResult } from "@/lib/storage";
import type { BreakdownStat, EvaluationResult } from "@/lib/types";

type ReviewFilter = "all" | "wrong" | "skipped" | "correct" | "flagged";

function BreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: BreakdownStat[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="py-2 pr-3">Name</th>
              <th className="px-2 py-2 text-right">Score</th>
              <th className="px-2 py-2 text-right">%</th>
              <th className="py-2 pl-2 text-right">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="py-2.5 pr-3 font-medium text-slate-800 dark:text-slate-200">
                  {row.title}
                </td>
                <td className="px-2 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {row.correct}/{row.total}
                </td>
                <td className="px-2 py-2.5 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                  {row.percentage}%
                </td>
                <td
                  className={`py-2.5 pl-2 text-right text-xs font-semibold ${ratingToneClasses(
                    row.rating
                  )}`}
                >
                  {row.rating}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>("all");

  useEffect(() => {
    setResult(getLastResult());
    setHydrated(true);
  }, []);

  const counts = useMemo(() => {
    if (!result) {
      return { all: 0, wrong: 0, skipped: 0, correct: 0, flagged: 0 };
    }
    const items = result.reviewedQuestions;
    return {
      all: items.length,
      wrong: items.filter((r) => !r.isCorrect && !r.isSkipped).length,
      skipped: items.filter((r) => r.isSkipped).length,
      correct: items.filter((r) => r.isCorrect).length,
      flagged: items.filter((r) => r.isFlagged).length,
    };
  }, [result]);

  const filteredQuestions = useMemo(() => {
    if (!result) return [];
    return result.reviewedQuestions.filter((r) => {
      if (filter === "wrong") return !r.isCorrect && !r.isSkipped;
      if (filter === "skipped") return r.isSkipped;
      if (filter === "correct") return r.isCorrect;
      if (filter === "flagged") return r.isFlagged;
      return true;
    });
  }, [filter, result]);

  if (!hydrated) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Loading test results...
      </div>
    );
  }

  if (!result) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          No Completed Test Results Yet
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Complete a COS101 practice test to view your score, topic diagnostics,
          reading recommendations, and full question review.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
          >
            Go to Start
          </Link>
        </div>
      </div>
    );
  }

  const wrongQuestionsPool = result.reviewedQuestions
    .filter((r) => !r.isCorrect)
    .map((r) => r.question);

  const weakTopicIds = new Set(result.readNextTopics.map((t) => t.id));
  const weakTopicsPool =
    weakTopicIds.size > 0
      ? allQuestions.filter((q) => weakTopicIds.has(q.topic))
      : [];

  function handleRetryWrong() {
    if (wrongQuestionsPool.length === 0) return;
    startAndPersistTest(wrongQuestionsPool, {
      count: wrongQuestionsPool.length,
      mode: "retry-wrong",
    });
    router.push("/test");
  }

  function handleDrillWeak() {
    if (weakTopicsPool.length === 0) return;
    startAndPersistTest(weakTopicsPool, {
      count: Math.min(QUESTIONS_PER_TEST, weakTopicsPool.length),
      mode: "drill-weak",
    });
    router.push("/test");
  }

  function handleNew70Test() {
    startAndPersistTest(allQuestions, {
      count: QUESTIONS_PER_TEST,
      mode: "standard",
    });
    router.push("/test");
  }

  return (
    <div className="space-y-8">
      {/* 1. Top Summary: Score, %, Time Taken */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <p className="font-mono text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
          Practice Test Summary
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Score
            </p>
            <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
              {result.score} / {result.total}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Percentage
            </p>
            <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
              {result.percentage}%
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Time Taken
            </p>
            <p className="mt-1 flex items-center gap-2 font-mono text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
              <Clock className="h-5 w-5 text-slate-400" />
              <span>{formatDuration(result.elapsedSeconds)}</span>
            </p>
          </div>
        </div>
      </section>

      {/* 2. Performance Tables: Topic (weakest first) + Unit & Module Roll-ups */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Performance Breakdown
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Strong: 75%+ · Fair: 50–74% · Weak: &lt;50% · &lt;3 questions: Too
            few to judge
          </p>
        </div>

        <BreakdownTable
          title="Topic Breakdown (Weakest First)"
          rows={result.topicStats}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownTable title="Unit Roll-up" rows={result.unitStats} />
          <BreakdownTable title="Module Roll-up" rows={result.moduleStats} />
        </div>
      </section>

      {/* 3. What to Read Next */}
      <section className="grid gap-4 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-8">
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              What to Read Next
            </h2>
          </div>

          {result.readNextTopics.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No Weak or Fair topics identified in this session (with at least 3
              questions asked per topic). Keep practicing unseen questions to
              cover any remaining syllabus topics.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {result.readNextTopics.map((topic) => (
                <li key={topic.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {topic.title}
                    </span>
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums ${ratingToneClasses(
                        topic.rating
                      )}`}
                    >
                      {topic.rating}: {topic.correct}/{topic.total} (
                      {topic.percentage}%)
                    </span>
                  </div>
                  {topic.reference && (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      Course material: {topic.reference}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-4">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Strongest Topics
            </h2>
          </div>

          {result.strongestTopics.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Topics scoring 75%+ with at least 3 questions will appear here.
            </p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {result.strongestTopics.map((t) => (
                <li
                  key={t.id}
                  className="flex items-baseline justify-between gap-2"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {t.title}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {t.correct}/{t.total} ({t.percentage}%)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 4. Full Question Review */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Full Question Review
          </h2>

          <div
            role="tablist"
            aria-label="Filter reviewed questions"
            className="flex flex-wrap gap-1.5"
          >
            {(
              [
                ["all", "All", counts.all],
                ["wrong", "Wrong", counts.wrong],
                ["skipped", "Skipped", counts.skipped],
                ["correct", "Correct", counts.correct],
                ["flagged", "Flagged", counts.flagged],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={`min-h-[40px] rounded-lg border px-3 text-xs font-semibold tabular-nums transition-colors ${
                  filter === key
                    ? "border-blue-700 bg-blue-700 text-white dark:border-blue-500 dark:bg-blue-600"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        </div>

        {filteredQuestions.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No questions match this filter.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredQuestions.map((item, idx) => (
              <article
                key={item.question.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-500 dark:text-slate-400">
                    #{idx + 1} · {item.unitTitle} · {item.topicTitle}
                  </span>
                  <div className="flex items-center gap-3 font-semibold">
                    {item.isFlagged && (
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                        <Flag className="h-3.5 w-3.5" />
                        Flagged
                      </span>
                    )}
                    {item.isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Correct
                      </span>
                    ) : item.isSkipped ? (
                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <MinusCircle className="h-4 w-4" />
                        Skipped
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
                        <XCircle className="h-4 w-4" />
                        Wrong
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm font-medium leading-relaxed text-slate-900 dark:text-slate-100 sm:text-base">
                  <QuestionStem text={item.question.question} />
                </p>

                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 sm:text-sm">
                  <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950">
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Your answer
                    </dt>
                    <dd
                      className={`mt-0.5 font-medium ${
                        item.isCorrect
                          ? "text-emerald-700 dark:text-emerald-400"
                          : item.isSkipped
                          ? "text-slate-500 dark:text-slate-400"
                          : "text-red-700 dark:text-red-400"
                      }`}
                    >
                      {item.isSkipped ? "Skipped (no answer)" : item.userAnswer}
                    </dd>
                  </div>

                  <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950">
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Correct answer
                    </dt>
                    <dd className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                      {item.correctAnswerDisplay}
                    </dd>
                  </div>
                </dl>

                {item.question.explanation && (
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {item.question.explanation}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 5. Action Buttons */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
          Next Practice Session
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleRetryWrong}
            disabled={wrongQuestionsPool.length === 0}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <RotateCcw className="h-4 w-4" />
            <span>
              Retry the ones I got wrong ({wrongQuestionsPool.length})
            </span>
          </button>

          <button
            type="button"
            onClick={handleDrillWeak}
            disabled={weakTopicsPool.length === 0}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-900/50"
          >
            <Dumbbell className="h-4 w-4" />
            <span>
              Drill my weak topics ({result.readNextTopics.length})
            </span>
          </button>

          <button
            type="button"
            onClick={handleNew70Test}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>
              New {Math.min(QUESTIONS_PER_TEST, allQuestions.length)}-question
              test
            </span>
          </button>
        </div>
        {weakTopicsPool.length === 0 && (
          <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>
              No Weak or Fair topics were flagged (minimum 3 questions per topic
              required).
            </span>
          </p>
        )}
      </section>
    </div>
  );
}
