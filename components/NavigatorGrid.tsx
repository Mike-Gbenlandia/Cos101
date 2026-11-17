"use client";

import { Flag } from "lucide-react";
import type { Question } from "@/lib/types";

interface NavigatorGridProps {
  questions: Question[];
  currentIndex: number;
  answers: Record<string, string>;
  flagged: Set<string>;
  onSelect: (index: number) => void;
}

export function NavigatorGrid({
  questions,
  currentIndex,
  answers,
  flagged,
  onSelect,
}: NavigatorGridProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-xs border border-blue-700 bg-blue-700 dark:border-blue-500 dark:bg-blue-500" />
          Current
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-xs border border-emerald-600 bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-950" />
          Answered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-xs border border-amber-500 bg-amber-50 dark:bg-amber-950/60" />
          Flagged
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-xs border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900" />
          Unanswered
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10 lg:grid-cols-7">
        {questions.map((q, idx) => {
          const isCurrent = idx === currentIndex;
          const isAnswered = (answers[q.id] ?? "").trim().length > 0;
          const isFlagged = flagged.has(q.id);

          let cellClass =
            "border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";

          if (isCurrent) {
            cellClass =
              "border-blue-700 bg-blue-700 text-white ring-2 ring-blue-300 dark:border-blue-500 dark:bg-blue-600 dark:ring-blue-800";
          } else if (isAnswered && isFlagged) {
            cellClass =
              "border-amber-500 bg-emerald-50 text-emerald-900 dark:border-amber-500 dark:bg-emerald-950/70 dark:text-emerald-200";
          } else if (isFlagged) {
            cellClass =
              "border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950/50 dark:text-amber-200";
          } else if (isAnswered) {
            cellClass =
              "border-emerald-600/60 bg-emerald-50 text-emerald-900 dark:border-emerald-600/60 dark:bg-emerald-950/50 dark:text-emerald-200";
          }

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelect(idx)}
              aria-label={`Question ${idx + 1}${isAnswered ? ", answered" : ", unanswered"}${isFlagged ? ", flagged" : ""}`}
              className={`relative flex min-h-[44px] items-center justify-center rounded-lg border font-mono text-xs font-semibold tabular-nums transition-colors ${cellClass}`}
            >
              <span>{idx + 1}</span>
              {isFlagged && (
                <Flag
                  className={`absolute top-1 right-1 h-2.5 w-2.5 ${
                    isCurrent
                      ? "text-amber-200"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
