"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type TimerPhase = "focus" | "break";

type TimerState = {
  phase: TimerPhase;
  secondsLeft: number;
  isRunning: boolean;
  endsAt: number | null;
  completedSessions: number;
  hasSession: boolean;
  message: string;
};

type PomodoroContextValue = TimerState & {
  start: () => void;
  pause: () => void;
  reset: () => void;
  selectPhase: (phase: TimerPhase) => void;
};

const STORAGE_KEY = "studysync-pomodoro-timer";
const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

const initialState: TimerState = {
  phase: "focus",
  secondsLeft: FOCUS_SECONDS,
  isRunning: false,
  endsAt: null,
  completedSessions: 0,
  hasSession: false,
  message: "",
};

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

function phaseDuration(phase: TimerPhase) {
  return phase === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
}

function restoreTimer(raw: string | null): TimerState {
  if (!raw) return initialState;

  try {
    const saved: unknown = JSON.parse(raw);
    if (
      typeof saved !== "object" ||
      saved === null ||
      !("phase" in saved) ||
      (saved.phase !== "focus" && saved.phase !== "break") ||
      !("secondsLeft" in saved) ||
      typeof saved.secondsLeft !== "number" ||
      !("completedSessions" in saved) ||
      typeof saved.completedSessions !== "number" ||
      !("isRunning" in saved) ||
      typeof saved.isRunning !== "boolean"
    ) {
      return initialState;
    }

    const phase = saved.phase;
    const endsAt =
      "endsAt" in saved && typeof saved.endsAt === "number"
        ? saved.endsAt
        : null;
    const secondsLeft = saved.isRunning && endsAt !== null
      ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      : Math.max(0, Math.floor(saved.secondsLeft));

    if (saved.isRunning && secondsLeft === 0) {
      const completedSessions =
        saved.completedSessions + (phase === "focus" ? 1 : 0);
      const nextPhase = phase === "focus" ? "break" : "focus";
      return {
        ...initialState,
        phase: nextPhase,
        secondsLeft: phaseDuration(nextPhase),
        completedSessions,
        hasSession: true,
        message:
          phase === "focus"
            ? "Focus session complete. Take a short break."
            : "Break complete. Ready for another focus session?",
      };
    }

    return {
      ...initialState,
      phase,
      secondsLeft,
      isRunning: saved.isRunning && endsAt !== null,
      endsAt: saved.isRunning ? endsAt : null,
      completedSessions: Math.max(0, Math.floor(saved.completedSessions)),
      hasSession: "hasSession" in saved && saved.hasSession === true,
      message: "message" in saved && typeof saved.message === "string"
        ? saved.message
        : "",
    };
  } catch {
    return initialState;
  }
}

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const [timer, setTimer] = useState(initialState);
  const [loaded, setLoaded] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setTimer(restoreTimer(window.localStorage.getItem(STORAGE_KEY)));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
    }
  }, [loaded, timer]);

  useEffect(() => {
    if (!timer.isRunning || timer.endsAt === null) return;

    const endTime = timer.endsAt;
    const tick = () => {
      const secondsLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));

      if (secondsLeft === 0) {
        setTimer((current) => {
          if (current.endsAt !== endTime) return current;
          const nextPhase = current.phase === "focus" ? "break" : "focus";
          return {
            ...current,
            phase: nextPhase,
            secondsLeft: phaseDuration(nextPhase),
            isRunning: false,
            endsAt: null,
            completedSessions:
              current.completedSessions + (current.phase === "focus" ? 1 : 0),
            message:
              current.phase === "focus"
                ? "Focus session complete. Take a short break."
                : "Break complete. Ready for another focus session?",
          };
        });
        return;
      }

      setTimer((current) =>
        current.endsAt === endTime ? { ...current, secondsLeft } : current
      );
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [timer.endsAt, timer.isRunning]);

  function start() {
    setTimer((current) => ({
      ...current,
      isRunning: true,
      endsAt: Date.now() + current.secondsLeft * 1000,
      hasSession: true,
      message: "",
    }));
  }

  function pause() {
    setTimer((current) => ({
      ...current,
      secondsLeft:
        current.endsAt === null
          ? current.secondsLeft
          : Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000)),
      isRunning: false,
      endsAt: null,
    }));
  }

  function reset() {
    setTimer({
      ...initialState,
      completedSessions: timer.completedSessions,
    });
  }

  function selectPhase(phase: TimerPhase) {
    setTimer((current) => ({
      ...current,
      phase,
      secondsLeft: phaseDuration(phase),
      isRunning: false,
      endsAt: null,
      hasSession: false,
      message: "",
    }));
  }

  return (
    <PomodoroContext.Provider
      value={{ ...timer, start, pause, reset, selectPhase }}
    >
      {children}
      {loaded && timer.hasSession && pathname !== "/dashboard/timer" && (
        <aside
          aria-label="Active Pomodoro timer"
          className="fixed bottom-24 right-[calc(var(--assistant-width,0px)_+_1.25rem)] z-50 flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-card-foreground shadow-lg"
        >
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {timer.phase === "focus" ? "Focus session" : "Short break"}
            </p>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {formatTime(timer.secondsLeft)}
              {timer.isRunning && (
                <span className="sr-only"> remaining</span>
              )}
            </p>
            {timer.message && (
              <p role="status" className="max-w-56 text-xs text-secondary">
                {timer.message}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={timer.isRunning ? pause : start}
            className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {timer.isRunning ? "Pause" : "Resume"}
          </button>
          <Link
            href="/dashboard/timer"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Timer
          </Link>
        </aside>
      )}
    </PomodoroContext.Provider>
  );
}

export function usePomodoro() {
  const context = useContext(PomodoroContext);
  if (!context) {
    throw new Error("usePomodoro must be used inside PomodoroProvider");
  }
  return context;
}

export function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
