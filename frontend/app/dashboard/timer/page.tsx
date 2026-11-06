"use client";

import Link from "next/link";
import { formatTime, usePomodoro } from "@/components/dashboard/PomodoroProvider";

export default function TimerPage() {
  const timer = usePomodoro();

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-8 text-foreground md:px-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-12">
        <header className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
              STUDENT WORKSPACE / RESOURCES
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Pomodoro timer
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Focus in 25-minute sessions, then take a 5-minute break. Your
              timer keeps running as you move around StudySync.
            </p>
          </div>
        </header>

        <section
          aria-label="Pomodoro timer controls"
          className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 rounded-3xl border bg-card p-8 text-center shadow-sm md:p-12"
        >
          <div className="flex items-center gap-2 rounded-full bg-muted p-1">
            {(["focus", "break"] as const).map((phase) => (
              <button
                key={phase}
                type="button"
                aria-pressed={timer.phase === phase}
                onClick={() => timer.selectPhase(phase)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                  timer.phase === phase
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {phase === "focus" ? "Focus · 25 min" : "Break · 5 min"}
              </button>
            ))}
          </div>

          <div aria-live="off">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary">
              {timer.phase === "focus" ? "Time to focus" : "Take a breather"}
            </p>
            <p
              role="timer"
              aria-label={`${Math.floor(timer.secondsLeft / 60)} minutes ${timer.secondsLeft % 60} seconds remaining`}
              className="mt-3 font-mono text-7xl font-semibold tabular-nums tracking-tight md:text-8xl"
            >
              {formatTime(timer.secondsLeft)}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={timer.isRunning ? timer.pause : timer.start}
              className="min-w-36 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
            >
              {timer.isRunning ? "Pause" : timer.hasSession ? "Resume" : "Start"}
            </button>
            <button
              type="button"
              onClick={timer.reset}
              className="rounded-lg border px-6 py-3 font-semibold transition hover:bg-muted"
            >
              Reset
            </button>
          </div>

          <div className="min-h-6" aria-live="polite">
            {timer.message ? (
              <p className="font-medium text-secondary">{timer.message}</p>
            ) : timer.isRunning ? (
              <p className="text-sm text-muted-foreground">
                You can visit other pages; the timer will keep running.
              </p>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground">
            Completed focus sessions:{" "}
            <span className="font-semibold text-foreground">
              {timer.completedSessions}
            </span>
          </p>
        </section>
      </div>
    </main>
  );
}
