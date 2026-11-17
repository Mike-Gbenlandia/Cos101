import { MAX_HISTORY_ATTEMPTS } from "@/config/test-config";
import type { EvaluationResult, InProgressTest, StoredAttempt } from "./types";

const KEYS = {
  SEEN_IDS: "cos101_seen_ids_v1",
  ACTIVE_TEST: "cos101_active_test_v1",
  LAST_RESULT: "cos101_last_result_v1",
  HISTORY: "cos101_history_v1",
} as const;

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota / private-browsing errors cleanly
  }
}

export function getSeenIds(): string[] {
  return readJson<string[]>(KEYS.SEEN_IDS, []);
}

export function addSeenIds(ids: string[]): string[] {
  const merged = Array.from(new Set([...getSeenIds(), ...ids]));
  writeJson(KEYS.SEEN_IDS, merged);
  return merged;
}

export function resetSeenIds(): void {
  if (!hasStorage()) return;
  window.localStorage.removeItem(KEYS.SEEN_IDS);
}

export function getActiveTest(): InProgressTest | null {
  return readJson<InProgressTest | null>(KEYS.ACTIVE_TEST, null);
}

export function saveActiveTest(test: InProgressTest): void {
  writeJson(KEYS.ACTIVE_TEST, test);
}

export function clearActiveTest(): void {
  if (!hasStorage()) return;
  window.localStorage.removeItem(KEYS.ACTIVE_TEST);
}

export function getLastResult(): EvaluationResult | null {
  return readJson<EvaluationResult | null>(KEYS.LAST_RESULT, null);
}

export function saveLastResult(result: EvaluationResult): void {
  writeJson(KEYS.LAST_RESULT, result);
}

export function getHistory(): StoredAttempt[] {
  return readJson<StoredAttempt[]>(KEYS.HISTORY, []);
}

export function appendHistory(result: EvaluationResult): StoredAttempt[] {
  const attempt: StoredAttempt = {
    id: result.testId,
    mode: result.mode,
    completedAt: result.completedAt,
    elapsedSeconds: result.elapsedSeconds,
    score: result.score,
    total: result.total,
    percentage: result.percentage,
    topicBreakdown: result.topicStats.map((t) => ({
      id: t.id,
      title: t.title,
      correct: t.correct,
      total: t.total,
      percentage: t.percentage,
    })),
  };

  const existing = getHistory().filter((h) => h.id !== attempt.id);
  const updated = [attempt, ...existing].slice(0, MAX_HISTORY_ATTEMPTS);
  writeJson(KEYS.HISTORY, updated);
  return updated;
}

export function clearHistory(): void {
  if (!hasStorage()) return;
  window.localStorage.removeItem(KEYS.HISTORY);
}
