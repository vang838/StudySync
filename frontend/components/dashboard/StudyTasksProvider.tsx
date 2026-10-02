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

export function StudyTasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(STORAGE_KEY) ?? "[]"
      );

      if (Array.isArray(saved)) {
        setTasks(saved);
      }
    } catch {
      setTasks([]);
    }

    setLoaded(true);
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
        id: crypto.randomUUID(),
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