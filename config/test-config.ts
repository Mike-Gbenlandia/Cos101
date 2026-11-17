/**
 * Global CBT practice configuration.
 * Adjust these constants to change test size, optional countdown timer, or module weights.
 */
export const QUESTIONS_PER_TEST = 70;

/**
 * Set to a positive number of minutes (e.g. 45) to enable a countdown timer with auto-submit,
 * or null for an untimed practice session (elapsed timer still shown).
 */
export const TEST_DURATION_MINUTES: number | null = null;

/**
 * Optional module weight overrides (e.g. { m1: 1, m2: 1, m3: 2, m4: 1, m5: 1, m6: 1 }).
 * When null, test generation allocates questions proportionally to each unit's bank size.
 */
export const MODULE_WEIGHTS: Record<string, number> | null = null;

/**
 * Maximum number of completed attempts kept in localStorage history.
 */
export const MAX_HISTORY_ATTEMPTS = 20;
