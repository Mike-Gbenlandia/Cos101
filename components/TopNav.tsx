"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, History, PlayCircle } from "lucide-react";

export function TopNav() {
  const pathname = usePathname();

  const navLinkClass = (active: boolean) =>
    `inline-flex min-h-[44px] items-center gap-1.5 px-3 text-sm font-medium transition-colors whitespace-nowrap rounded-lg ${
      active
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white"
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2.5 text-slate-900 dark:text-slate-100"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-xs font-bold tracking-tight text-white dark:bg-blue-600">
            101
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-tight sm:text-base">
              COS101 CBT
            </span>
            <span className="hidden text-[11px] text-slate-500 dark:text-slate-400 sm:block">
              Introduction to Computing Science
            </span>
          </div>
        </Link>

        <nav aria-label="Primary navigation" className="flex items-center gap-1">
          <Link href="/" className={navLinkClass(pathname === "/")}>
            <BookOpen className="h-4 w-4 shrink-0" />
            <span>Overview</span>
          </Link>
          <Link href="/test" className={navLinkClass(pathname === "/test")}>
            <PlayCircle className="h-4 w-4 shrink-0" />
            <span>Test</span>
          </Link>
          <Link href="/history" className={navLinkClass(pathname === "/history")}>
            <History className="h-4 w-4 shrink-0" />
            <span>History</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
