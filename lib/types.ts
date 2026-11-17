export type Confidence = "high" | "low";
export type QuestionType = "mcq" | "gap";

export interface TaxonomyTopic {
  id: string;
  title: string;
  reference: string;
}

export interface TaxonomyUnit {
  id: string;
  title: string;
  topics: TaxonomyTopic[];
}

export interface TaxonomyModule {
  id: string;
  title: string;
  units: TaxonomyUnit[];
}

export interface Taxonomy {
  courseCode: string;
  courseTitle: string;
  modules: TaxonomyModule[];
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  module: string;
  unit: string;
  topic: string;
  confidence: Confidence;
  type: QuestionType;
  question: string;
  options?: QuestionOption[];
  answer?: string;
  acceptedAnswers?: string[];
  explanation?: string;
}

export type TestMode = "standard" | "retry-wrong" | "drill-weak";

export interface GeneratedTest {
  id: string;
  mode: TestMode;
  createdAt: string;
  questions: Question[];
  requestedCount: number;
  actualCount: number;
  smallerBankNotice: boolean;
  unitAllocation: Record<string, number>;
}

export interface InProgressTest {
  testId: string;
  mode: TestMode;
  createdAt: string;
  startedAt: number;
  elapsedSeconds: number;
  durationMinutes: number | null;
  currentIndex: number;
  questions: Question[];
  answers: Record<string, string>;
  flagged: string[];
  smallerBankNotice: boolean;
}

export type TopicRating =
  | "Strong"
  | "Fair"
  | "Weak"
  | "Too few questions to judge";

export interface BreakdownStat {
  id: string;
  title: string;
  reference?: string;
  correct: number;
  attempted: number;
  total: number;
  percentage: number;
  rating: TopicRating;
}

export interface ReviewedQuestion {
  question: Question;
  userAnswer: string;
  correctAnswerDisplay: string;
  isCorrect: boolean;
  isSkipped: boolean;
  isFlagged: boolean;
  topicTitle: string;
  unitTitle: string;
  moduleTitle: string;
}

export interface EvaluationResult {
  testId: string;
  mode: TestMode;
  completedAt: string;
  elapsedSeconds: number;
  score: number;
  total: number;
  percentage: number;
  topicStats: BreakdownStat[];
  unitStats: BreakdownStat[];
  moduleStats: BreakdownStat[];
  readNextTopics: BreakdownStat[];
  strongestTopics: BreakdownStat[];
  reviewedQuestions: ReviewedQuestion[];
}

export interface HistoryTopicSummary {
  id: string;
  title: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface StoredAttempt {
  id: string;
  mode: TestMode;
  completedAt: string;
  elapsedSeconds: number;
  score: number;
  total: number;
  percentage: number;
  topicBreakdown: HistoryTopicSummary[];
}
