"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type TaskImportance = "high" | "medium" | "low";
export type TaskKind = "academic" | "administrative" | "optional";
export type TaskQuadrant = "do-first" | "schedule" | "delegate" | "eliminate";
export type TaskRecurrence = "none" | "weekly";

export type StudyTask = {
  id: string;
  title: string;
  dueDate: string;
  course: string;
  completed: boolean;
  importance: TaskImportance;
  kind: TaskKind;
  quadrant: TaskQuadrant;
  quadrantOverride: TaskQuadrant | null;
  estimatedHours: number;
  estimatedPomodoros: number;
  completedPomodoros: number;
  dependsOn: string[];
  recurrence: TaskRecurrence;
  lastPomodoroSessionId: string | null;
  updatedAt: string;
};

export type NewStudyTask = Pick<StudyTask, "title" | "dueDate" | "course"> &
  Partial<
    Pick<
      StudyTask,
      | "importance"
      | "kind"
      | "estimatedHours"
      | "estimatedPomodoros"
      | "dependsOn"
      | "recurrence"
    >
  >;

type TasksContextValue = {
  tasks: StudyTask[];
  loaded: boolean;
  syncError: string;
  autoPrioritizationEnabled: boolean;
  setAutoPrioritizationEnabled: (enabled: boolean) => void;
  addTask: (task: NewStudyTask) => void;
  updateTask: (
    id: string,
    changes: Partial<
      Pick<
        StudyTask,
        | "title"
        | "dueDate"
        | "course"
        | "importance"
        | "kind"
        | "estimatedHours"
        | "estimatedPomodoros"
        | "dependsOn"
        | "recurrence"
      >
    >,
  ) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, quadrant: TaskQuadrant) => void;
  returnToAutomatic: (id: string) => void;
  recordPomodoroSession: (taskId: string, sessionId: string) => void;
};

const STORAGE_KEY = "studysync-study-tasks";
const AUTO_PRIORITY_KEY = "studysync-auto-prioritization";
const TasksContext = createContext<TasksContextValue | null>(null);

const quadrants: TaskQuadrant[] = [
  "do-first",
  "schedule",
  "delegate",
  "eliminate",
];

function isTaskQuadrant(value: unknown): value is TaskQuadrant {
  return typeof value === "string" && quadrants.some((quadrant) => quadrant === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createTaskId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    const values = new Uint32Array(2);
    globalThis.crypto.getRandomValues(values);
    return `${values[0].toString(16)}-${values[1].toString(16)}`;
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTaskDaysRemaining(dueDate: string, today = getLocalDateKey()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;

  const due = new Date(`${dueDate}T00:00:00`);
  const todayDate = new Date(`${today}T00:00:00`);
  if (Number.isNaN(due.getTime()) || Number.isNaN(todayDate.getTime())) return null;
  if (
    getLocalDateKey(due) !== dueDate ||
    getLocalDateKey(todayDate) !== today
  ) {
    return null;
  }

  const dueDay = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const currentDay = Date.UTC(
    todayDate.getFullYear(),
    todayDate.getMonth(),
    todayDate.getDate(),
  );
  return Math.round((dueDay - currentDay) / 86_400_000);
}

export function getAutomaticQuadrant(
  task: Pick<StudyTask, "dueDate" | "importance">,
  today = getLocalDateKey(),
): TaskQuadrant {
  const daysRemaining = getTaskDaysRemaining(task.dueDate, today);
  if (daysRemaining !== null && daysRemaining < 0) return "do-first";
  if (daysRemaining !== null && daysRemaining <= 3) {
    return task.importance === "low" ? "delegate" : "do-first";
  }
  return task.importance === "low" ? "eliminate" : "schedule";
}

function normalizeTask(value: unknown): StudyTask | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") {
    return null;
  }

  const importance: TaskImportance =
    value.importance === "high" || value.importance === "low"
      ? value.importance
      : "medium";
  const kind: TaskKind =
    value.kind === "administrative" || value.kind === "optional"
      ? value.kind
      : "academic";
  const savedQuadrant = isTaskQuadrant(value.quadrant) ? value.quadrant : null;
  const savedOverride = isTaskQuadrant(value.quadrantOverride)
    ? value.quadrantOverride
    : null;
  const quadrant = savedQuadrant
    ? savedQuadrant
    : getAutomaticQuadrant({
        dueDate: typeof value.dueDate === "string" ? value.dueDate : "",
        importance,
      });

  return {
    id: value.id,
    title: value.title,
    dueDate: typeof value.dueDate === "string" ? value.dueDate : "",
    course: typeof value.course === "string" ? value.course : "",
    completed: value.completed === true,
    importance,
    kind,
    quadrant,
    quadrantOverride: savedOverride,
    estimatedHours:
      typeof value.estimatedHours === "number" &&
      Number.isFinite(value.estimatedHours) &&
      value.estimatedHours >= 0
        ? value.estimatedHours
        : 1,
    estimatedPomodoros:
      typeof value.estimatedPomodoros === "number" &&
      Number.isFinite(value.estimatedPomodoros) &&
      value.estimatedPomodoros >= 0
        ? Math.floor(value.estimatedPomodoros)
        : 1,
    completedPomodoros:
      typeof value.completedPomodoros === "number" &&
      Number.isFinite(value.completedPomodoros) &&
      value.completedPomodoros >= 0
        ? Math.floor(value.completedPomodoros)
        : 0,
    dependsOn: Array.isArray(value.dependsOn)
      ? value.dependsOn.filter((id): id is string => typeof id === "string")
      : [],
    recurrence: value.recurrence === "weekly" ? "weekly" : "none",
    lastPomodoroSessionId:
      typeof value.lastPomodoroSessionId === "string"
        ? value.lastPomodoroSessionId
        : null,
    updatedAt:
      typeof value.updatedAt === "string" &&
      !Number.isNaN(Date.parse(value.updatedAt))
        ? value.updatedAt
        : new Date(0).toISOString(),
  };
}

function withAutomaticQuadrant(task: StudyTask, today: string): StudyTask {
  const quadrant = task.quadrantOverride ?? getAutomaticQuadrant(task, today);
  if (quadrant === task.quadrant) return task;
  if (task.quadrantOverride) {
    return { ...task, quadrant, updatedAt: new Date().toISOString() };
  }
  return { ...task, quadrant, updatedAt: new Date().toISOString() };
}

function nextWeekDate(dueDate: string) {
  const next = dueDate
    ? new Date(`${dueDate}T00:00:00`)
    : new Date(`${getLocalDateKey()}T00:00:00`);
  next.setDate(next.getDate() + 7);
  return getLocalDateKey(next);
}

async function responseError(response: Response, operation: string) {
  let detail = "";
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body.detail === "string") {
      detail = body.detail;
    }
  } catch {
    detail = "";
  }
  if (response.status === 401) {
    return `Sign in to sync planner tasks. ${detail}`.trim();
  }
  return detail || `${operation} failed with status ${response.status}.`;
}

export function StudyTasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [autoPrioritizationEnabled, setAutoPrioritizationEnabledState] =
    useState(true);
  const [today, setToday] = useState(getLocalDateKey);
  const backendReady = useRef(false);
  const syncedTasks = useRef(new Map<string, string>());
  const syncQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      let cachedTasks: StudyTask[] = [];
      let cachedAutomatic = true;

      try {
        const saved: unknown = JSON.parse(
          window.localStorage.getItem(STORAGE_KEY) ?? "[]",
        );
        if (Array.isArray(saved)) {
          cachedTasks = saved
            .map(normalizeTask)
            .filter((task): task is StudyTask => task !== null);
        }
        cachedAutomatic =
          window.localStorage.getItem(AUTO_PRIORITY_KEY) !== "false";
      } catch (error) {
        console.error("Unable to load the local StudySync task cache.", error);
      }

      try {
        let response = await fetch("/api/study-tasks", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(await responseError(response, "Loading planner tasks"));
        }

        let data: unknown = await response.json();
        if (
          !isRecord(data) ||
          !Array.isArray(data.tasks) ||
          typeof data.autoPrioritizationEnabled !== "boolean"
        ) {
          throw new Error("The study tasks service returned invalid planner data.");
        }

        let remoteTasks = data.tasks
          .map(normalizeTask)
          .filter((task): task is StudyTask => task !== null);
        const remoteById = new Map(remoteTasks.map((task) => [task.id, task]));
        const localUpserts = cachedTasks.filter((task) => {
          const remoteTask = remoteById.get(task.id);
          return (
            !remoteTask ||
            Date.parse(task.updatedAt) > Date.parse(remoteTask.updatedAt)
          );
        });

        for (const task of localUpserts) {
          if (remoteById.has(task.id)) continue;
          response = await fetch("/api/study-tasks", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...task, dependsOn: [] }),
          });
          if (!response.ok) {
            throw new Error(await responseError(response, "Migrating planner tasks"));
          }
        }

        for (const task of localUpserts) {
          if (task.dependsOn.length === 0) continue;
          response = await fetch(
            `/api/study-tasks/${encodeURIComponent(task.id)}`,
            {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(task),
            },
          );
          if (!response.ok) {
            throw new Error(await responseError(response, "Migrating task dependencies"));
          }
        }

        if (localUpserts.length > 0) {
          response = await fetch("/api/study-tasks", { cache: "no-store" });
          if (!response.ok) {
            throw new Error(await responseError(response, "Reloading planner tasks"));
          }
          data = await response.json();
          if (!isRecord(data) || !Array.isArray(data.tasks)) {
            throw new Error("The study tasks service returned invalid planner data.");
          }
          remoteTasks = data.tasks
            .map(normalizeTask)
            .filter((task): task is StudyTask => task !== null);
        }

        if (cancelled) return;
        backendReady.current = true;
        syncedTasks.current = new Map(
          remoteTasks.map((task) => [task.id, JSON.stringify(task)]),
        );
        setTasks(remoteTasks);
        setAutoPrioritizationEnabledState(
          typeof data.autoPrioritizationEnabled === "boolean"
            ? data.autoPrioritizationEnabled
            : cachedAutomatic,
        );
        setSyncError("");
      } catch (error) {
        if (cancelled) return;
        backendReady.current = false;
        setTasks(cachedTasks);
        setAutoPrioritizationEnabledState(cachedAutomatic);
        setSyncError(
          error instanceof Error
            ? `${error.message} Your changes are currently saved only on this device.`
            : "Planner tasks could not be synced. Your changes are currently saved only on this device.",
        );
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    const timer = window.setTimeout(() => void loadTasks(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      window.localStorage.setItem(
        AUTO_PRIORITY_KEY,
        String(autoPrioritizationEnabled),
      );
    } catch (error) {
      console.error("Unable to save StudySync study tasks.", error);
    }
  }, [tasks, loaded, autoPrioritizationEnabled]);

  useEffect(() => {
    if (!loaded || !backendReady.current) return;

    const changedTasks = tasks.filter(
      (task) => syncedTasks.current.get(task.id) !== JSON.stringify(task),
    );
    if (changedTasks.length === 0) return;

    syncQueue.current = syncQueue.current
      .then(async () => {
        for (const task of changedTasks) {
          if (syncedTasks.current.get(task.id) === JSON.stringify(task)) continue;
          const response = await fetch(
            `/api/study-tasks/${encodeURIComponent(task.id)}`,
            {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(task),
            },
          );
          if (!response.ok) {
            throw new Error(await responseError(response, "Saving planner tasks"));
          }
          syncedTasks.current.set(task.id, JSON.stringify(task));
        }
        setSyncError("");
      })
      .catch((error: unknown) => {
        setSyncError(
          error instanceof Error
            ? `${error.message} Your changes are still saved on this device.`
            : "Planner tasks could not be synced. Your changes are still saved on this device.",
        );
      });
  }, [tasks, loaded]);

  useEffect(() => {
    if (!loaded || !backendReady.current) return;
    void fetch("/api/study-tasks/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        autoPrioritizationEnabled,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await responseError(response, "Saving planner settings"),
          );
        }
        setSyncError("");
      })
      .catch((error: unknown) => {
        setSyncError(
          error instanceof Error
            ? `${error.message} Your changes are still saved on this device.`
            : "Planner settings could not be synced. Your changes are still saved on this device.",
        );
      });
  }, [loaded, autoPrioritizationEnabled]);

  useEffect(() => {
    const refreshDate = () => setToday(getLocalDateKey());
    const interval = window.setInterval(refreshDate, 60_000);
    document.addEventListener("visibilitychange", refreshDate);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshDate);
    };
  }, []);

  useEffect(() => {
    if (!loaded || !autoPrioritizationEnabled) return;
    const timeout = window.setTimeout(() => {
      setTasks((current) => {
        let changed = false;
        const next = current.map((task) => {
          const evaluated = withAutomaticQuadrant(task, today);
          if (evaluated.quadrant !== task.quadrant) changed = true;
          return evaluated;
        });
        return changed ? next : current;
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [today, loaded, autoPrioritizationEnabled]);

  function setAutoPrioritizationEnabled(enabled: boolean) {
    setAutoPrioritizationEnabledState(enabled);
    if (enabled) {
      setTasks((current) =>
        current.map((task) => withAutomaticQuadrant(task, today)),
      );
    }
  }

  function addTask(input: NewStudyTask) {
    const task: StudyTask = {
      id: createTaskId(),
      title: input.title.trim(),
      dueDate: input.dueDate,
      course: input.course.trim(),
      completed: false,
      importance: input.importance ?? "medium",
      kind: input.kind ?? "academic",
      quadrant: "schedule",
      quadrantOverride: null,
      estimatedHours: input.estimatedHours ?? 1,
      estimatedPomodoros: input.estimatedPomodoros ?? 1,
      completedPomodoros: 0,
      dependsOn: input.dependsOn ?? [],
      recurrence: input.recurrence ?? "none",
      lastPomodoroSessionId: null,
      updatedAt: new Date().toISOString(),
    };
    const nextTask = autoPrioritizationEnabled
      ? withAutomaticQuadrant(task, today)
      : task;
    setTasks((current) => [...current, nextTask]);
  }

  function updateTask(
    id: string,
    changes: Parameters<TasksContextValue["updateTask"]>[1],
  ) {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== id) return task;
        const updated = {
          ...task,
          ...changes,
          updatedAt: new Date().toISOString(),
        };
        return autoPrioritizationEnabled
          ? withAutomaticQuadrant(updated, today)
          : updated;
      }),
    );
  }

  function toggleTask(id: string) {
    setTasks((current) => {
      const next: StudyTask[] = [];
      for (const task of current) {
        if (task.id !== id) {
          next.push(task);
          continue;
        }

        const completedTask = {
          ...task,
          completed: !task.completed,
          updatedAt: new Date().toISOString(),
        };
        next.push(completedTask);
        if (!completedTask.completed || task.recurrence !== "weekly") continue;

        const recurringTask: StudyTask = {
          ...task,
          id: createTaskId(),
          dueDate: nextWeekDate(task.dueDate),
          completed: false,
          quadrantOverride: null,
          completedPomodoros: 0,
          lastPomodoroSessionId: null,
          updatedAt: new Date().toISOString(),
        };
        next.push(
          autoPrioritizationEnabled
            ? withAutomaticQuadrant(recurringTask, today)
            : recurringTask,
        );
      }
      return next;
    });
  }

  function deleteTask(id: string) {
    if (backendReady.current) {
      syncQueue.current = syncQueue.current
        .then(async () => {
          const response = await fetch(
            `/api/study-tasks/${encodeURIComponent(id)}`,
            { method: "DELETE" },
          );
          if (!response.ok && response.status !== 404) {
            throw new Error(
              await responseError(response, "Deleting planner task"),
            );
          }
          syncedTasks.current.delete(id);
        })
        .catch((error: unknown) => {
          console.error("Unable to sync planner task deletion.", error);
          setSyncError(
            "The task was removed from this device, but its deletion could not be synced. It may reappear after reconnecting.",
          );
        });
    }
    setTasks((current) =>
      current
        .filter((task) => task.id !== id)
        .map((task) => ({
          ...task,
          dependsOn: task.dependsOn.filter((dependency) => dependency !== id),
          updatedAt: task.dependsOn.includes(id)
            ? new Date().toISOString()
            : task.updatedAt,
        })),
    );
  }

  function moveTask(id: string, quadrant: TaskQuadrant) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              quadrant,
              quadrantOverride: quadrant,
              updatedAt: new Date().toISOString(),
            }
          : task,
      ),
    );
  }

  function returnToAutomatic(id: string) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              quadrantOverride: null,
              quadrant: autoPrioritizationEnabled
                ? getAutomaticQuadrant(task, today)
                : task.quadrant,
              updatedAt: new Date().toISOString(),
            }
          : task,
      ),
    );
  }

  function recordPomodoroSession(taskId: string, sessionId: string) {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId && task.lastPomodoroSessionId !== sessionId
          ? {
              ...task,
              completedPomodoros: task.completedPomodoros + 1,
              lastPomodoroSessionId: sessionId,
              updatedAt: new Date().toISOString(),
            }
          : task,
      ),
    );
  }

  return (
    <TasksContext.Provider
      value={{
        tasks,
        loaded,
        syncError,
        autoPrioritizationEnabled,
        setAutoPrioritizationEnabled,
        addTask,
        updateTask,
        toggleTask,
        deleteTask,
        moveTask,
        returnToAutomatic,
        recordPomodoroSession,
      }}
    >
      {children}
    </TasksContext.Provider>
  );
}

export function useStudyTasks() {
  const context = useContext(TasksContext);

  if (!context) {
    throw new Error("useStudyTasks must be used inside StudyTasksProvider");
  }

  return context;
}
