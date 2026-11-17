"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, History, Play, Trash2 } from "lucide-react";
import { formatDateShort, formatDuration } from "@/lib/format";
import { clearHistory, getHistory } from "@/lib/storage";
import type { StoredAttempt } from "@/lib/types";

function ScoreTrendChart({ attempts }: { attempts: StoredAttempt[] }) {
  // Reverse so chronological left -> right
  const chronological = [...attempts].reverse();
  const width = 640;
  const height = 180;
  const padX = 36;
  const padY = 20;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const points = chronological.map((att, idx) => {
    const x =
      chronological.length === 1
        ? padX + plotW / 2
        : padX + (idx / (chronological.length - 1)) * plotW;
    const y = padY + plotH - (att.percentage / 100) * plotH;
    return { x, y, att };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-44 w-full min-w-[320px]"
        role="img"
        aria-label="Score percentage trend across recent practice attempts"
      >
        {[0, 25, 50, 75, 100].map((pct) => {
          const y = padY + plotH - (pct / 100) * plotH;
          return (
            <g key={pct}>
              <line
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeDasharray="3 3"
              />
              <text
                x={padX - 6}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 font-mono text-[10px]"
              >
                {pct}%
              </text>
            </g>
          );
        })}

        {points.length > 1 && (
          <polyline
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polyline}
            className="stroke-blue-700 dark:stroke-blue-400"
          />
        )}

        {points.map((p, idx) => (
          <g key={p.att.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r="4.5"
              className="fill-blue-700 stroke-white dark:fill-blue-400 dark:stroke-slate-900"
              strokeWidth="2"
            />
            <text
              x={p.x}
              y={p.y - 9}
              textAnchor="middle"
              className="fill-slate-700 font-mono text-[10px] font-semibold dark:fill-slate-200"
            >
              {p.att.percentage}%
            </text>
            <text
              x={p.x}
              y={height - 4}
              textAnchor="middle"
              className="fill-slate-400 font-mono text-[10px]"
            >
              #{idx + 1}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function HistoryPage() {
  const [attempts, setAttempts] = useState<StoredAttempt[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setAttempts(getHistory());
    setHydrated(true);
  }, []);

  const averagePerTopic = useMemo(() => {
    const map = new Map<
      string,
      { id: string; title: string; correct: number; total: number }
    >();
    for (const att of attempts) {
      for (const t of att.topicBreakdown) {
        const cur = map.get(t.id) ?? {
          id: t.id,
          title: t.title,
          correct: 0,
          total: 0,
        };
        cur.correct += t.correct;
        cur.total += t.total;
        map.set(t.id, cur);
      }
    }
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentage:
          item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0,
      }))
      .sort((a, b) => a.percentage - b.percentage);
  }, [attempts]);

  function handleClear() {
    clearHistory();
    setAttempts([]);
    setConfirmClear(false);
  }

  if (!hydrated) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Loading practice history...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
            Practice History
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Last {attempts.length} of up to 20 saved local attempts
          </p>
        </div>

        {attempts.length > 0 && !confirmClear && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear history</span>
          </button>
        )}

        {confirmClear && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
            >
              Confirm clear history
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {attempts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <History className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
            No Completed Attempts Saved
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Your last 20 test scores, duration, and per-topic averages are
            stored privately in your browser.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Start a practice test</span>
          </Link>
        </div>
      ) : (
        <>
          {/* Score Trend */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
              Score Trend
            </h2>
            <ScoreTrendChart attempts={attempts} />
          </section>

          {/* Attempts List */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
              Completed Attempts
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {attempts.map((att) => {
                const isExpanded = expandedId === att.id;
                return (
                  <div key={att.id} className="py-3 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : att.id)}
                      className="flex min-h-[44px] w-full flex-wrap items-center justify-between gap-2 text-left"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {formatDateShort(att.completedAt)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {att.mode === "standard"
                            ? "Full Practice"
                            : att.mode === "retry-wrong"
                            ? "Retry Missed"
                            : "Drill Weak Topics"}
                          {" · "}
                          {formatDuration(att.elapsedSeconds)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                          {att.score}/{att.total} ({att.percentage}%)
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Per-topic breakdown
                        </p>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {att.topicBreakdown.map((t) => (
                            <div
                              key={t.id}
                              className="flex items-baseline justify-between gap-2 text-xs"
                            >
                              <span className="text-slate-700 dark:text-slate-300">
                                {t.title}
                              </span>
                              <span className="shrink-0 font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                                {t.correct}/{t.total} ({t.percentage}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Average per Topic Across Attempts */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
              Cumulative Topic Averages Across Attempts
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="py-2 pr-4">Topic</th>
                    <th className="px-3 py-2 text-right">Correct</th>
                    <th className="py-2 pl-3 text-right">Average %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {averagePerTopic.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-200">
                        {t.title}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {t.correct}/{t.total}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                        {t.percentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
