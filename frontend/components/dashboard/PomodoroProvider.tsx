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
import { useStudyTasks } from "./StudyTasksProvider";

type TimerPhase = "focus" | "break";
type CompletedTaskSession = { id: string; taskId: string };

type TimerState = {
  phase: TimerPhase;
  secondsLeft: number;
  isRunning: boolean;
  endsAt: number | null;
  completedSessions: number;
  hasSession: boolean;
  message: string;
  focusDurationMinutes: number;
  breakDurationMinutes: number;
  activeTaskId: string | null;
  lastCompletedTaskSession: CompletedTaskSession | null;
};

type PomodoroContextValue = TimerState & {
  activeTaskTitle: string | null;
  start: (taskId?: string) => void;
  pause: () => void;
  reset: () => void;
  selectPhase: (phase: TimerPhase) => void;
  configureDurations: (focusMinutes: number, breakMinutes: number) => void;
};

const STORAGE_KEY = "studysync-pomodoro-timer";
const PROCESSED_TASK_SESSION_KEY = "studysync-processed-pomodoro-session";

const initialState: TimerState = {
  phase: "focus",
  secondsLeft: 30 * 60,
  isRunning: false,
  endsAt: null,
  completedSessions: 0,
  hasSession: false,
  message: "",
  focusDurationMinutes: 30,
  breakDurationMinutes: 10,
  activeTaskId: null,
  lastCompletedTaskSession: null,
};

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

function phaseDuration(
  phase: TimerPhase,
  focusDurationMinutes: number,
  breakDurationMinutes: number,
) {
  return (phase === "focus" ? focusDurationMinutes : breakDurationMinutes) * 60;
}

function createSessionId() {
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
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
    const focusDurationMinutes =
      "focusDurationMinutes" in saved &&
      typeof saved.focusDurationMinutes === "number" &&
      saved.focusDurationMinutes >= 1 &&
      saved.focusDurationMinutes <= 120
        ? Math.floor(saved.focusDurationMinutes)
        : initialState.focusDurationMinutes;
    const breakDurationMinutes =
      "breakDurationMinutes" in saved &&
      typeof saved.breakDurationMinutes === "number" &&
      saved.breakDurationMinutes >= 1 &&
      saved.breakDurationMinutes <= 30
        ? Math.floor(saved.breakDurationMinutes)
        : initialState.breakDurationMinutes;
    const activeTaskId =
      "activeTaskId" in saved && typeof saved.activeTaskId === "string"
        ? saved.activeTaskId
        : null;
    const lastCompletedTaskSession =
      "lastCompletedTaskSession" in saved &&
      typeof saved.lastCompletedTaskSession === "object" &&
      saved.lastCompletedTaskSession !== null &&
      "id" in saved.lastCompletedTaskSession &&
      typeof saved.lastCompletedTaskSession.id === "string" &&
      "taskId" in saved.lastCompletedTaskSession &&
      typeof saved.lastCompletedTaskSession.taskId === "string"
        ? {
            id: saved.lastCompletedTaskSession.id,
            taskId: saved.lastCompletedTaskSession.taskId,
          }
        : null;
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
        secondsLeft: phaseDuration(
          nextPhase,
          focusDurationMinutes,
          breakDurationMinutes,
        ),
        completedSessions,
        hasSession: true,
        focusDurationMinutes,
        breakDurationMinutes,
        activeTaskId,
        lastCompletedTaskSession:
          phase === "focus" && activeTaskId
            ? { id: createSessionId(), taskId: activeTaskId }
            : lastCompletedTaskSession,
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
      focusDurationMinutes,
      breakDurationMinutes,
      activeTaskId,
      lastCompletedTaskSession,
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
  const { tasks, loaded: tasksLoaded, recordPomodoroSession } = useStudyTasks();
  const [timer, setTimer] = useState(initialState);
  const [loaded, setLoaded] = useState(false);
  const pathname = usePathname();
  const activeTaskTitle =
    tasks.find((task) => task.id === timer.activeTaskId)?.title ?? null;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setTimer(restoreTimer(window.localStorage.getItem(STORAGE_KEY)));
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
    }
  }, [loaded, timer]);

  useEffect(() => {
    const completedSession = timer.lastCompletedTaskSession;
    if (!loaded || !tasksLoaded || !completedSession) return;

    try {
      if (
        window.localStorage.getItem(PROCESSED_TASK_SESSION_KEY) ===
        completedSession.id
      ) {
        return;
      }

      recordPomodoroSession(completedSession.taskId, completedSession.id);
      window.localStorage.setItem(
        PROCESSED_TASK_SESSION_KEY,
        completedSession.id,
      );
    } catch (error) {
      console.error("Unable to record the completed task study session.", error);
    }
  }, [loaded, tasksLoaded, timer.lastCompletedTaskSession, recordPomodoroSession]);

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
            secondsLeft: phaseDuration(
              nextPhase,
              current.focusDurationMinutes,
              current.breakDurationMinutes,
            ),
            isRunning: false,
            endsAt: null,
            completedSessions:
              current.completedSessions + (current.phase === "focus" ? 1 : 0),
            lastCompletedTaskSession:
              current.phase === "focus" && current.activeTaskId
                ? {
                    id: createSessionId(),
                    taskId: current.activeTaskId,
                  }
                : current.lastCompletedTaskSession,
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

  function start(taskId?: string) {
    setTimer((current) => {
      const startFocus = Boolean(taskId) && current.phase !== "focus";
      const phase = startFocus ? "focus" : current.phase;
      const secondsLeft = startFocus
        ? phaseDuration(
            "focus",
            current.focusDurationMinutes,
            current.breakDurationMinutes,
          )
        : current.secondsLeft;
      return {
        ...current,
        phase,
        secondsLeft,
        isRunning: true,
        endsAt: Date.now() + secondsLeft * 1000,
        hasSession: true,
        activeTaskId: taskId ?? current.activeTaskId,
        message: "",
      };
    });
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
      focusDurationMinutes: timer.focusDurationMinutes,
      breakDurationMinutes: timer.breakDurationMinutes,
      activeTaskId: timer.activeTaskId,
      lastCompletedTaskSession: timer.lastCompletedTaskSession,
      secondsLeft: phaseDuration(
        "focus",
        timer.focusDurationMinutes,
        timer.breakDurationMinutes,
      ),
    });
  }

  function selectPhase(phase: TimerPhase) {
    setTimer((current) => ({
      ...current,
      phase,
      secondsLeft: phaseDuration(
        phase,
        current.focusDurationMinutes,
        current.breakDurationMinutes,
      ),
      isRunning: false,
      endsAt: null,
      hasSession: false,
      message: "",
    }));
  }

  function configureDurations(focusMinutes: number, breakMinutes: number) {
    if (
      !Number.isInteger(focusMinutes) ||
      focusMinutes < 1 ||
      focusMinutes > 120 ||
      !Number.isInteger(breakMinutes) ||
      breakMinutes < 1 ||
      breakMinutes > 30
    ) {
      throw new Error("Focus and break durations are outside the allowed range.");
    }

    setTimer((current) => {
      if (current.isRunning) return current;
      return {
        ...current,
        focusDurationMinutes: focusMinutes,
        breakDurationMinutes: breakMinutes,
        secondsLeft: phaseDuration(
          current.phase,
          focusMinutes,
          breakMinutes,
        ),
      };
    });
  }

  return (
    <PomodoroContext.Provider
      value={{
        ...timer,
        activeTaskTitle,
        start,
        pause,
        reset,
        selectPhase,
        configureDurations,
      }}
    >
      {children}
      {loaded && timer.hasSession && pathname !== "/dashboard/timer" && (
        <aside
          aria-label="Active Pomodoro timer"
          className="fixed bottom-24 right-[calc(var(--assistant-width,0px)_+_1.25rem)] z-50 flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-card-foreground shadow-lg"
        >
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {activeTaskTitle ?? (timer.phase === "focus" ? "Focus session" : "Short break")}
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
            onClick={() =>
              timer.isRunning ? pause() : start()
            }
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
