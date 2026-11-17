import React from "react";

interface QuestionStemProps {
  text: string;
  filledPreview?: string;
}

/**
 * Renders question text with every `____` blank displayed as a distinct visual underline.
 */
export function QuestionStem({ text, filledPreview }: QuestionStemProps) {
  const parts = text.split("____");
  if (parts.length === 1) {
    return <span>{text}</span>;
  }

  return (
    <span>
      {parts.map((part, idx) => (
        <React.Fragment key={idx}>
          <span>{part}</span>
          {idx < parts.length - 1 && (
            <span
              aria-label="blank"
              className="mx-1 inline-flex min-w-[5.5rem] items-baseline justify-center border-b-2 border-blue-600 px-2 pb-0.5 font-mono text-sm font-semibold text-blue-700 dark:border-blue-400 dark:text-blue-300"
            >
              {filledPreview?.trim() ? filledPreview.trim() : "\u00A0"}
            </span>
          )}
        </React.Fragment>
      ))}
    </span>
  );
}
