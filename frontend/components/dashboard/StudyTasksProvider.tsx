"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type StudyTask = {
  id: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  course: string;
  completed: boolean;
};

type TasksContextValue = {
  tasks: StudyTask[];
  addTask: (title: string, dueDate: string, course: string) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
};

const STORAGE_KEY = "studysync-study-tasks";
const TasksContext = createContext<TasksContextValue | null>(null);

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

export function StudyTasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load persisted tasks after mount so server and initial client HTML match.
  useEffect(() => {
    let persistedTasks: StudyTask[] = [];

    try {
      const saved = JSON.parse(
        window.localStorage.getItem(STORAGE_KEY) ?? "[]"
      );

      if (Array.isArray(saved)) {
        persistedTasks = saved as StudyTask[];
      }
    } catch {
      persistedTasks = [];
    }

    const timer = window.setTimeout(() => {
      setTasks(persistedTasks);
      setLoaded(true);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }
  }, [tasks, loaded]);

  function addTask(title: string, dueDate: string, course: string) {
    setTasks((current) => [
      ...current,
      {
        id: createTaskId(),
        title: title.trim(),
        dueDate,
        course: course.trim(),
        completed: false,
      },
    ]);
  }

  function toggleTask(id: string) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  function deleteTask(id: string) {
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  return (
    <TasksContext.Provider
      value={{ tasks, addTask, toggleTask, deleteTask }}
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