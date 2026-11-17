import type { TopicRating } from "./types";

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  if (hrs > 0) {
    return `${hrs}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function formatDateShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ratingToneClasses(rating: TopicRating): string {
  switch (rating) {
    case "Strong":
      return "text-emerald-700 dark:text-emerald-400";
    case "Fair":
      return "text-amber-700 dark:text-amber-400";
    case "Weak":
      return "text-red-700 dark:text-red-400";
    default:
      return "text-slate-500 dark:text-slate-400";
  }
}
