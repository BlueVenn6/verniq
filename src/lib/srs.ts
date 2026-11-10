import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card,
  type CardInput,
  type Grade,
  type ReviewLog,
} from "ts-fsrs";
import type { LearningItemStatus, SrsCardState, SrsRating, SrsState } from "@/src/lib/types";

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: false,
});

const RATING_TO_FSRS = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
} satisfies Record<SrsRating, Grade>;

export const SRS_RATINGS: Array<{
  rating: SrsRating;
  label: string;
  helper: string;
}> = [
  { rating: "again", label: "Again", helper: "忘了" },
  { rating: "hard", label: "Hard", helper: "很费劲" },
  { rating: "good", label: "Good", helper: "想起来了" },
  { rating: "easy", label: "Easy", helper: "很轻松" },
];

export function createInitialSrsState(createdAt?: string, now = new Date()): SrsState {
  const createdDate = toValidDate(createdAt, now);
  const card = createEmptyCard(createdDate);

  return cardToSrsState(card, {
    createdAt: createdDate.toISOString(),
    updatedAt: now.toISOString(),
    reviewHistory: [],
  });
}

export function getEffectiveSrsState(item: {
  srs?: SrsState;
  createdAt: string;
  updatedAt: string;
}) {
  return item.srs ?? createInitialSrsState(item.createdAt || item.updatedAt);
}

export function reviewSrsState({
  srs,
  createdAt,
  rating,
  reviewedAt = new Date(),
}: {
  srs?: SrsState;
  createdAt: string;
  rating: SrsRating;
  reviewedAt?: Date;
}): SrsState {
  const previous = srs ?? createInitialSrsState(createdAt, reviewedAt);
  const result = scheduler.next(srsStateToCard(previous), reviewedAt, RATING_TO_FSRS[rating]);

  return cardToSrsState(result.card, {
    createdAt: previous.createdAt,
    updatedAt: reviewedAt.toISOString(),
    reviewHistory: [
      {
        id: createId(),
        rating,
        reviewedAt: result.log.review.toISOString(),
        dueAt: result.log.due.toISOString(),
        state: stateToName(result.log.state),
        stability: roundMetric(result.log.stability),
        difficulty: roundMetric(result.log.difficulty),
        elapsedDays: result.log.elapsed_days,
        scheduledDays: result.log.scheduled_days,
      },
      ...previous.reviewHistory,
    ].slice(0, 200),
    log: result.log,
  });
}

export function previewSrsRatings(srs: SrsState) {
  const preview = scheduler.repeat(srsStateToCard(srs), new Date());

  return SRS_RATINGS.map(({ rating, label, helper }) => {
    const record = preview[RATING_TO_FSRS[rating]];
    const dueAt = record.card.due.toISOString();

    return {
      rating,
      label,
      helper,
      dueAt,
      dueLabel: formatDueDistance(dueAt),
    };
  });
}

export function isSrsDue(srs: SrsState, now = new Date()) {
  return toValidDate(srs.dueAt, now).getTime() <= now.getTime();
}

export function getSrsStage(srs: SrsState) {
  if (srs.state === "New") return 0;
  if (srs.scheduledDays < 1) return 1;
  if (srs.scheduledDays < 4) return 2;
  if (srs.scheduledDays < 15) return 3;
  if (srs.scheduledDays < 45) return 4;
  return 5;
}

export function getLearningStatusAfterSrsRating({
  currentStatus,
  rating,
  srs,
}: {
  currentStatus: LearningItemStatus;
  rating: SrsRating;
  srs: SrsState;
}): LearningItemStatus {
  if (currentStatus === "ignored") return "ignored";
  if (rating === "again" || rating === "hard") return "learning";
  if (rating === "easy" || srs.scheduledDays >= 21) return "known";
  return "learning";
}

export function formatDueDistance(value: string, now = new Date()) {
  const due = toValidDate(value, now);
  const diffMs = due.getTime() - now.getTime();

  if (diffMs <= 0) return "现在到期";

  const minutes = Math.ceil(diffMs / 60000);
  if (minutes < 60) return `${minutes} 分钟后`;

  const hours = Math.ceil(minutes / 60);
  if (hours < 36) return `${hours} 小时后`;

  const days = Math.ceil(hours / 24);
  if (days < 30) return `${days} 天后`;

  const months = Math.ceil(days / 30);
  return `${months} 个月后`;
}

function srsStateToCard(srs: SrsState): CardInput {
  return {
    due: srs.dueAt,
    stability: srs.stability,
    difficulty: srs.difficulty,
    elapsed_days: srs.elapsedDays,
    scheduled_days: srs.scheduledDays,
    learning_steps: srs.learningSteps,
    reps: srs.reps,
    lapses: srs.lapses,
    state: srs.state,
    last_review: srs.lastReviewedAt ?? null,
  };
}

function cardToSrsState(
  card: Card,
  context: {
    createdAt: string;
    updatedAt: string;
    reviewHistory: SrsState["reviewHistory"];
    log?: ReviewLog;
  },
): SrsState {
  return {
    dueAt: card.due.toISOString(),
    stability: roundMetric(card.stability),
    difficulty: roundMetric(card.difficulty),
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: stateToName(card.state),
    createdAt: context.createdAt,
    updatedAt: context.updatedAt,
    lastReviewedAt: card.last_review?.toISOString() ?? context.log?.review.toISOString(),
    reviewHistory: context.reviewHistory,
  };
}

function stateToName(state: State | SrsCardState): SrsCardState {
  if (typeof state === "string") return state;
  return State[state] as SrsCardState;
}

function toValidDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function roundMetric(value: number) {
  return Number(value.toFixed(6));
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `srs_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
