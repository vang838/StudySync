"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { formatTime, usePomodoro } from "@/components/dashboard/PomodoroProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default function TimerPage() {
  const timer = usePomodoro();
  const [settingsError, setSettingsError] = useState("");

  function saveDurations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      timer.configureDurations(
        Number(data.get("focusMinutes")),
        Number(data.get("breakMinutes")),
      );
      setSettingsError("");
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : "Unable to update timer settings.",
      );
    }
  }

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">StudySync Resourses</p>
            <h1 className="font-heading text-3xl font-bold tracking-tight">
              Pomodoro Timer
            </h1>
            {timer.activeTaskTitle && (
              <p className="mt-2 text-sm font-medium text-secondary">
                Current task: {timer.activeTaskTitle}
              </p>
            )}
          </div>
          <Link href="/dashboard/planner">
            <Button variant="secondary" size="s">
                Go to Planner
            </Button>
          </Link>
        </header>

        <Separator />

         <p className="mt-1 max-w-2xl text-sm text-muted-foreground md:text-base">
              Focus in {timer.focusDurationMinutes}-minute sessions, then take a{" "}
              {timer.breakDurationMinutes}-minute break. Your
              timer keeps running as you move around StudySync.
          </p>

        <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader className="items-center text-center">
              <CardTitle>Pomodoro Timer</CardTitle>
              <CardDescription>
                Choose a session and focus at your own pace.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-8 text-center">
              <div
                role="group"
                aria-label="Timer phase"
                className="relative isolate flex w-full max-w-sm items-center rounded-full bg-muted p-1"
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-primary transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
                    timer.phase === "break" ? "translate-x-full" : ""
                  }`}
                />
                {(["focus", "break"] as const).map((phase) => (
                  <Button
                    key={phase}
                    type="button"
                    variant="ghost"
                    size="s"
                    aria-pressed={timer.phase === phase}
                    onClick={() => timer.selectPhase(phase)}
                    className={`relative z-10 h-10 w-auto flex-1 rounded-full transition-colors duration-300 hover:bg-transparent ${
                      timer.phase === phase
                        ? "text-primary-foreground hover:text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {phase === "focus"
                      ? `Focus · ${timer.focusDurationMinutes} min`
                      : `Break · ${timer.breakDurationMinutes} min`}
                  </Button>
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
                <Button
                  type="button"
                  onClick={() =>
                    timer.isRunning ? timer.pause() : timer.start()
                  }
                >
                  {timer.isRunning
                    ? "Pause"
                    : timer.hasSession
                      ? "Resume"
                      : "Start"}
                </Button>
                <Button type="button" variant="outline" onClick={timer.reset}>
                  Reset
                </Button>
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
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Session lengths</CardTitle>
              <CardDescription>
                The default is 30 minutes focused and 10 minutes resting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveDurations} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <label className="space-y-2 text-sm font-medium">
                    Focus minutes
                    <Input
                      type="number"
                      name="focusMinutes"
                      min="1"
                      max="120"
                      key={`focus-${timer.focusDurationMinutes}`}
                      defaultValue={timer.focusDurationMinutes}
                      disabled={timer.isRunning}
                      className="w-full disabled:opacity-60"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Break minutes
                    <Input
                      type="number"
                      name="breakMinutes"
                      min="1"
                      max="30"
                      key={`break-${timer.breakDurationMinutes}`}
                      defaultValue={timer.breakDurationMinutes}
                      disabled={timer.isRunning}
                      className="w-full disabled:opacity-60"
                    />
                  </label>
                </div>
                <div className="flex justify-center">
                  <Button type="submit" disabled={timer.isRunning}>
                    Save durations
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Focus: 1–120 min · Break: 1–30 min
                </p>
                {settingsError && (
                  <p role="alert" className="text-sm text-destructive">
                    {settingsError}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
