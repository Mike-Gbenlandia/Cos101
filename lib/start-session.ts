import { TEST_DURATION_MINUTES } from "@/config/test-config";
import { generateTest, type GenerateTestOptions } from "./generate-test";
import { addSeenIds, getSeenIds, saveActiveTest } from "./storage";
import type { InProgressTest, Question } from "./types";

export function startAndPersistTest(
  pool: Question[],
  options: Omit<GenerateTestOptions, "seenIds"> = {}
): InProgressTest {
  const seenSet = new Set(getSeenIds());
  const generated = generateTest(pool, {
    ...options,
    seenIds: seenSet,
  });

  // Mark selected questions as seen for future test prioritization
  addSeenIds(generated.questions.map((q) => q.id));

  const session: InProgressTest = {
    testId: generated.id,
    mode: generated.mode,
    createdAt: generated.createdAt,
    startedAt: Date.now(),
    elapsedSeconds: 0,
    durationMinutes: TEST_DURATION_MINUTES,
    currentIndex: 0,
    questions: generated.questions,
    answers: {},
    flagged: [],
    smallerBankNotice: generated.smallerBankNotice,
  };

  saveActiveTest(session);
  return session;
}
