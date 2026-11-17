/**
 * Normalises a user-typed or reference answer for comparison and deduplication:
 * - trims leading/trailing whitespace
 * - converts to lowercase
 * - collapses consecutive whitespace to single spaces
 * - strips trailing punctuation (.,;:!?)
 */
export function normaliseAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

/**
 * Normalises question stem text for deduplication and blank consistency.
 */
export function normaliseQuestionText(value: string): string {
  return value
    .trim()
    .replace(/_{2,}/g, "____")
    .replace(/\s+/g, " ");
}

/**
 * Checks whether a user-entered string matches any accepted fill-in-the-gap answer.
 */
export function isGapAnswerCorrect(
  userAnswer: string | undefined,
  acceptedAnswers: string[] | undefined
): boolean {
  if (!userAnswer || !acceptedAnswers || acceptedAnswers.length === 0) {
    return false;
  }
  const normalisedInput = normaliseAnswer(userAnswer);
  if (!normalisedInput) return false;
  return acceptedAnswers.some(
    (accepted) => normaliseAnswer(accepted) === normalisedInput
  );
}
