"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Grid2X2,
  Play,
  Send,
  X,
} from "lucide-react";
import { NavigatorGrid } from "@/components/NavigatorGrid";
import { QuestionStem } from "@/components/QuestionStem";
import { QUESTIONS_PER_TEST } from "@/config/test-config";
import { formatDuration } from "@/lib/format";
import { allQuestions } from "@/lib/questions";
import { evaluateTest } from "@/lib/scoring";
import { startAndPersistTest } from "@/lib/start-session";
import {
  appendHistory,
  clearActiveTest,
  getActiveTest,
  saveActiveTest,
  saveLastResult,
} from "@/lib/storage";
import { taxonomyLookups } from "@/lib/taxonomy";
import type { InProgressTest } from "@/lib/types";

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

export default function TestPage() {
  const router = useRouter();
  const [session, setSession] = useState<InProgressTest | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    const existing = getActiveTest();
    setSession(existing);
    setHydrated(true);
  }, []);

  const persist = useCallback((next: InProgressTest) => {
    setSession(next);
    saveActiveTest(next);
  }, []);

  const handleConfirmSubmit = useCallback(
    (latestSession?: InProgressTest) => {
      const target = latestSession ?? session;
      if (!target || submittedRef.current) return;
      submittedRef.current = true;

      const result = evaluateTest({
        testId: target.testId,
        mode: target.mode,
        elapsedSeconds: target.elapsedSeconds,
        questions: target.questions,
        answers: target.answers,
        flagged: target.flagged,
      });

      saveLastResult(result);
      appendHistory(result);
      clearActiveTest();
      router.push("/results");
    },
    [router, session]
  );

  // Elapsed timer + optional countdown auto-submit
  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      setSession((prev) => {
        if (!prev || submittedRef.current) return prev;
        const nextElapsed = prev.elapsedSeconds + 1;
        const next: InProgressTest = {
          ...prev,
          elapsedSeconds: nextElapsed,
        };
        saveActiveTest(next);

        if (
          prev.durationMinutes !== null &&
          prev.durationMinutes > 0 &&
          nextElapsed >= prev.durationMinutes * 60
        ) {
          window.setTimeout(() => handleConfirmSubmit(next), 0);
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [Boolean(session), handleConfirmSubmit]);

  const currentQuestion = session
    ? session.questions[session.currentIndex]
    : undefined;

  const flaggedSet = useMemo(
    () => new Set(session?.flagged ?? []),
    [session?.flagged]
  );

  const selectAnswer = useCallback(
    (value: string) => {
      if (!session || !currentQuestion) return;
      persist({
        ...session,
        answers: {
          ...session.answers,
          [currentQuestion.id]: value,
        },
      });
    },
    [currentQuestion, persist, session]
  );

  const toggleFlag = useCallback(() => {
    if (!session || !currentQuestion) return;
    const exists = session.flagged.includes(currentQuestion.id);
    const nextFlagged = exists
      ? session.flagged.filter((id) => id !== currentQuestion.id)
      : [...session.flagged, currentQuestion.id];
    persist({
      ...session,
      flagged: nextFlagged,
    });
  }, [currentQuestion, persist, session]);

  const goToIndex = useCallback(
    (idx: number) => {
      if (!session) return;
      const clamped = Math.max(0, Math.min(session.questions.length - 1, idx));
      persist({
        ...session,
        currentIndex: clamped,
      });
    },
    [persist, session]
  );

  // Keyboard shortcuts: A-D, ArrowLeft, ArrowRight, F
  useEffect(() => {
    if (!session || !currentQuestion || showSubmitModal) return;
    const activeSession = session;
    const activeQuestion = currentQuestion;

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" || tag === "textarea" || target?.isContentEditable;
      if (isTyping) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToIndex(activeSession.currentIndex - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToIndex(activeSession.currentIndex + 1);
      } else if (key === "f") {
        e.preventDefault();
        toggleFlag();
      } else if (
        activeQuestion.options &&
        activeQuestion.options.length > 0 &&
        ["a", "b", "c", "d"].includes(key)
      ) {
        const optIdx = ["a", "b", "c", "d"].indexOf(key);
        const opt = activeQuestion.options[optIdx];
        if (opt) {
          e.preventDefault();
          selectAnswer(opt.id);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    currentQuestion,
    goToIndex,
    selectAnswer,
    session,
    showSubmitModal,
    toggleFlag,
  ]);

  if (!hydrated) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Loading practice session...
      </div>
    );
  }

  if (!session || session.questions.length === 0 || !currentQuestion) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          No Active Practice Test
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Start a new {Math.min(QUESTIONS_PER_TEST, allQuestions.length)}
          -question COS101 CBT practice test sampled proportionally across all
          16 units.
        </p>
        <button
          type="button"
          onClick={() => {
            const started = startAndPersistTest(allQuestions, {
              count: QUESTIONS_PER_TEST,
              mode: "standard",
            });
            setSession(started);
          }}
          className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>
            Start new test ({Math.min(QUESTIONS_PER_TEST, allQuestions.length)}{" "}
            questions)
          </span>
        </button>
      </div>
    );
  }

  const totalQuestions = session.questions.length;
  const answeredCount = session.questions.filter(
    (q) => (session.answers[q.id] ?? "").trim().length > 0
  ).length;
  const unansweredCount = totalQuestions - answeredCount;
  const currentAnswer = session.answers[currentQuestion.id] ?? "";
  const isCurrentFlagged = flaggedSet.has(currentQuestion.id);

  const unitMeta = taxonomyLookups.unitById.get(currentQuestion.unit);
  const topicMeta = taxonomyLookups.topicById.get(currentQuestion.topic);

  const hasTimerCountdown =
    session.durationMinutes !== null && session.durationMinutes > 0;
  const remainingSeconds = hasTimerCountdown
    ? Math.max(0, session.durationMinutes! * 60 - session.elapsedSeconds)
    : session.elapsedSeconds;

  return (
    <div className="space-y-4 pb-24 lg:pb-6">
      {/* Top Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm">
          <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
            Question {session.currentIndex + 1} / {totalQuestions}
          </span>
          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {answeredCount} answered · {unansweredCount} left
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
            <Clock className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            <span>
              {hasTimerCountdown
                ? `Left ${formatDuration(remainingSeconds)}`
                : formatDuration(remainingSeconds)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 sm:text-sm"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Submit</span>
          </button>
        </div>
      </div>

      {session.smallerBankNotice && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 sm:text-sm">
          This focused session includes {totalQuestions} available question
          {totalQuestions === 1 ? "" : "s"} (fewer than {QUESTIONS_PER_TEST}).
        </p>
      )}

      {/* Main Split Grid */}
      <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
        {/* Question Stage */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-7 lg:col-span-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono font-semibold uppercase text-blue-700 dark:text-blue-400">
                {currentQuestion.unit}
              </span>
              <span className="mx-1.5">·</span>
              <span>{unitMeta?.unit.title ?? currentQuestion.unit}</span>
              <span className="mx-1.5 hidden sm:inline">·</span>
              <span className="hidden sm:inline">
                {topicMeta?.topic.title ?? currentQuestion.topic}
              </span>
            </div>

            <button
              type="button"
              onClick={toggleFlag}
              aria-pressed={isCurrentFlagged}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
                isCurrentFlagged
                  ? "border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-500 dark:bg-amber-950/50 dark:text-amber-200"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/70"
              }`}
            >
              <Flag className="h-3.5 w-3.5" />
              <span>{isCurrentFlagged ? "Flagged" : "Flag for review"}</span>
            </button>
          </div>

          {/* Question Stem */}
          <h2 className="text-base font-medium leading-relaxed text-slate-900 dark:text-slate-100 sm:text-lg">
            <QuestionStem
              text={currentQuestion.question}
              filledPreview={
                !currentQuestion.options ? currentAnswer : undefined
              }
            />
          </h2>

          {/* Answer Input */}
          <div className="mt-6">
            {currentQuestion.options && currentQuestion.options.length > 0 ? (
              <div
                role="radiogroup"
                aria-label="Answer choices"
                className="space-y-2.5"
              >
                {currentQuestion.options.map((opt, idx) => {
                  const letter = OPTION_LETTERS[idx] ?? String(idx + 1);
                  const isSelected = currentAnswer === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => selectAnswer(opt.id)}
                      className={`flex min-h-[52px] w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? "border-blue-700 bg-blue-50/90 text-slate-900 dark:border-blue-500 dark:bg-blue-950/60 dark:text-white"
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-bold ${
                          isSelected
                            ? "border-blue-700 bg-blue-700 text-white dark:border-blue-500 dark:bg-blue-500"
                            : "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="flex-1 text-sm leading-snug sm:text-base">
                        {opt.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <label
                  htmlFor="gap-answer-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Type the missing word or term
                </label>
                <input
                  id="gap-answer-input"
                  type="text"
                  value={currentAnswer}
                  onChange={(e) => selectAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (session.currentIndex < totalQuestions - 1) {
                        goToIndex(session.currentIndex + 1);
                      } else {
                        setShowSubmitModal(true);
                      }
                    }
                  }}
                  placeholder="Type your answer here..."
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Case-insensitive; extra spaces and trailing punctuation are
                  ignored. Press Enter for next question.
                </p>
              </div>
            )}
          </div>

          {/* Desktop Prev/Next Footer */}
          <div className="mt-7 hidden items-center justify-between border-t border-slate-100 pt-5 dark:border-slate-800 lg:flex">
            <button
              type="button"
              onClick={() => goToIndex(session.currentIndex - 1)}
              disabled={session.currentIndex === 0}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            <span className="text-xs text-slate-500 dark:text-slate-400">
              Shortcuts: A–D select · ←/→ move · F flag
            </span>

            {session.currentIndex < totalQuestions - 1 ? (
              <button
                type="button"
                onClick={() => goToIndex(session.currentIndex + 1)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Review & Submit</span>
              </button>
            )}
          </div>
        </section>

        {/* Desktop Navigator Sidebar */}
        <aside className="hidden rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-4 lg:block">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Question Navigator
            </h3>
            <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {session.flagged.length} flagged
            </span>
          </div>
          <NavigatorGrid
            questions={session.questions}
            currentIndex={session.currentIndex}
            answers={session.answers}
            flagged={flaggedSet}
            onSelect={goToIndex}
          />
        </aside>
      </div>

      {/* Mobile Sticky Bottom Bar (Compact <= 15% viewport height) */}
      <div className="fixed right-0 bottom-0 left-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => goToIndex(session.currentIndex - 1)}
            disabled={session.currentIndex === 0}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Prev</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMobileNav(true)}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 font-mono text-xs font-semibold tabular-nums text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <Grid2X2 className="h-4 w-4" />
            <span>
              {session.currentIndex + 1}/{totalQuestions}
            </span>
          </button>

          {session.currentIndex < totalQuestions - 1 ? (
            <button
              type="button"
              onClick={() => goToIndex(session.currentIndex + 1)}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl bg-blue-700 px-3 text-sm font-semibold text-white dark:bg-blue-600"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-700 px-3 text-sm font-semibold text-white dark:bg-emerald-600"
            >
              <span>Submit</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Navigator Drawer */}
      {showMobileNav && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-xs lg:hidden">
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Question Navigator ({answeredCount}/{totalQuestions})
              </h3>
              <button
                type="button"
                onClick={() => setShowMobileNav(false)}
                aria-label="Close navigator"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavigatorGrid
              questions={session.questions}
              currentIndex={session.currentIndex}
              answers={session.answers}
              flagged={flaggedSet}
              onSelect={(idx) => {
                goToIndex(idx);
                setShowMobileNav(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h2
              id="submit-modal-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              Submit practice test?
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
              Review your progress before finishing this session.
            </p>

            <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950">
              <div>
                <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Answered
                </dt>
                <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {answeredCount}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Unanswered
                </dt>
                <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                  {unansweredCount}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Flagged
                </dt>
                <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums text-amber-700 dark:text-amber-400">
                  {session.flagged.length}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Keep practising
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSubmit()}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm & Submit</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
