"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  History,
  Play,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { QUESTIONS_PER_TEST, TEST_DURATION_MINUTES } from "@/config/test-config";
import { formatDuration } from "@/lib/format";
import { allQuestions } from "@/lib/questions";
import { startAndPersistTest } from "@/lib/start-session";
import {
  clearActiveTest,
  getActiveTest,
  getHistory,
  getSeenIds,
  resetSeenIds,
} from "@/lib/storage";
import { taxonomy } from "@/lib/taxonomy";
import type { InProgressTest } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [activeTest, setActiveTest] = useState<InProgressTest | null>(null);
  const [seenCount, setSeenCount] = useState<number>(0);
  const [historyCount, setHistoryCount] = useState<number>(0);
  const [confirmResetSeen, setConfirmResetSeen] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    setActiveTest(getActiveTest());
    setSeenCount(getSeenIds().length);
    setHistoryCount(getHistory().length);
    setHydrated(true);
  }, []);

  const moduleBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of allQuestions) {
      counts.set(q.module, (counts.get(q.module) ?? 0) + 1);
    }
    return taxonomy.modules.map((m) => ({
      id: m.id,
      title: m.title,
      unitCount: m.units.length,
      questionCount: counts.get(m.id) ?? 0,
    }));
  }, []);

  const totalBank = allQuestions.length;
  const targetCount = Math.min(QUESTIONS_PER_TEST, totalBank);
  const isSmallBank = totalBank < QUESTIONS_PER_TEST;

  function handleStartNewTest() {
    startAndPersistTest(allQuestions, {
      count: QUESTIONS_PER_TEST,
      mode: "standard",
    });
    router.push("/test");
  }

  function handleDiscardActive() {
    clearActiveTest();
    setActiveTest(null);
  }

  function handleResetSeen() {
    resetSeenIds();
    setSeenCount(0);
    setConfirmResetSeen(false);
  }

  const activeAnsweredCount = activeTest
    ? Object.values(activeTest.answers).filter((v) => v.trim().length > 0)
        .length
    : 0;

  return (
    <div className="space-y-8">
      {/* Hero / Start Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
          <div className="space-y-4 lg:col-span-8">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              {taxonomy.courseCode} Computer-Based Practice
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {taxonomy.courseTitle}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
              Practise full{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {targetCount}-question
              </span>{" "}
              mock exams sampled proportionally across all{" "}
              {taxonomy.modules.length} course modules and{" "}
              {moduleBreakdown.reduce((s, m) => s + m.unitCount, 0)} study
              units, with instant topic diagnostics and course reading
              references.
            </p>

            {isSmallBank && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                Note: The current question bank contains {totalBank} questions,
                fewer than the {QUESTIONS_PER_TEST}-question target. A full
                practice session will use all {totalBank} available questions.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleStartNewTest}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-800 active:scale-[0.99] dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Start new test ({targetCount} questions)</span>
              </button>

              <Link
                href="/history"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/70"
              >
                <History className="h-4 w-4" />
                <span>
                  History{hydrated ? ` (${historyCount})` : ""}
                </span>
              </Link>
            </div>
          </div>

          {/* Bank & Seen Stats */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60 lg:col-span-4">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Question Bank
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {totalBank}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                16 units covered
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Seen Questions
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {hydrated ? seenCount : "—"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {hydrated
                  ? `${Math.max(0, totalBank - seenCount)} unseen left`
                  : "Unseen prioritised"}
              </p>
            </div>

            <div className="col-span-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {TEST_DURATION_MINUTES
                    ? `Timed: ${TEST_DURATION_MINUTES} mins`
                    : "Untimed (elapsed tracked)"}
                </span>

                {hydrated && seenCount > 0 && !confirmResetSeen && (
                  <button
                    type="button"
                    onClick={() => setConfirmResetSeen(true)}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset seen</span>
                  </button>
                )}

                {confirmResetSeen && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetSeen}
                      className="inline-flex min-h-[36px] items-center rounded-md bg-red-600 px-2.5 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Confirm reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmResetSeen(false)}
                      className="inline-flex min-h-[36px] items-center rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Resume Unfinished Test */}
      {hydrated && activeTest && activeTest.questions.length > 0 && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/30 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-blue-950 dark:text-blue-100">
                Unfinished test saved in progress
              </p>
              <p className="font-mono text-xs tabular-nums text-blue-800 dark:text-blue-300">
                {activeAnsweredCount} / {activeTest.questions.length} answered
                {" · "}
                {activeTest.flagged.length} flagged
                {" · "}
                Elapsed {formatDuration(activeTest.elapsedSeconds)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/test")}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <span>Resume test</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleDiscardActive}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Trash2 className="h-4 w-4" />
                <span>Discard</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Module Breakdown Overview */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Course Modules & Bank Coverage
            </h2>
          </div>
          <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
            6 modules · {totalBank} items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2.5 pr-4">Module</th>
                <th className="px-3 py-2.5 text-right">Units</th>
                <th className="py-2.5 pl-3 text-right">Questions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {moduleBreakdown.map((mod) => (
                <tr key={mod.id}>
                  <td className="py-3 pr-4">
                    <span className="mr-2 font-mono text-xs font-semibold uppercase text-blue-700 dark:text-blue-400">
                      {mod.id}
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {mod.title}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {mod.unitCount}
                  </td>
                  <td className="py-3 pl-3 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                    {mod.questionCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
