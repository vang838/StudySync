"use client";

import Link from "next/link";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { formatTime, usePomodoro } from "./PomodoroProvider";
import {
  getLocalDateKey,
  getTaskDaysRemaining,
  useStudyTasks,
  type StudyTask,
  type TaskImportance,
  type TaskKind,
  type TaskQuadrant,
  type TaskRecurrence,
} from "./StudyTasksProvider";
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

const quadrantDetails: {
  id: TaskQuadrant;
  title: string;
  subtitle: string;
  label: string;
  color: string;
  indicator: string;
}[] = [
  {
    id: "do-first",
    title: "Do First",
    subtitle: "Urgent + important",
    label: "Focus now",
    color: "border-primary/30 bg-primary/5",
    indicator: "bg-primary",
  },
  {
    id: "schedule",
    title: "Schedule",
    subtitle: "Important, not urgent",
    label: "Plan ahead",
    color: "border-secondary/30 bg-secondary/5",
    indicator: "bg-secondary",
  },
  {
    id: "delegate",
    title: "Delegate / Quick Tasks",
    subtitle: "Urgent, lower importance",
    label: "Quick wins",
    color: "border-sky-300 bg-sky-50",
    indicator: "bg-sky-600",
  },
  {
    id: "eliminate",
    title: "Eliminate / Low Priority",
    subtitle: "Not urgent + not important",
    label: "Consider postponing",
    color: "border-foreground/10 bg-muted/60",
    indicator: "bg-muted-foreground",
  },
];

const importanceOrder: Record<TaskImportance, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const keyboardQuadrantMoves: Record<
  TaskQuadrant,
  Partial<Record<"ArrowDown" | "ArrowLeft" | "ArrowRight" | "ArrowUp", TaskQuadrant>>
> = {
  "do-first": { ArrowRight: "schedule", ArrowDown: "delegate" },
  schedule: { ArrowLeft: "do-first", ArrowDown: "eliminate" },
  delegate: { ArrowUp: "do-first", ArrowRight: "eliminate" },
  eliminate: { ArrowUp: "schedule", ArrowLeft: "delegate" },
};

function isPrerequisite(task: StudyTask, activeTasks: StudyTask[]) {
  return activeTasks.some((candidate) => candidate.dependsOn.includes(task.id));
}

function sortQuadrantTasks(
  tasks: StudyTask[],
  quadrant: TaskQuadrant,
  allTasks: StudyTask[],
): StudyTask[] {
  return [...tasks].sort((first, second) => {
    const firstDays = getTaskDaysRemaining(first.dueDate);
    const secondDays = getTaskDaysRemaining(second.dueDate);
    const prerequisiteDifference =
      Number(isPrerequisite(second, allTasks)) -
      Number(isPrerequisite(first, allTasks));
    const deadlineValue = (days: number | null) => days ?? Number.POSITIVE_INFINITY;
    const importanceDifference =
      importanceOrder[second.importance] - importanceOrder[first.importance];
    const workloadDifference = second.estimatedHours - first.estimatedHours;

    if (quadrant === "do-first") {
      const firstGroup =
        firstDays !== null && firstDays < 0
          ? 0
          : firstDays === 0
            ? 1
            : firstDays === 1
              ? 2
              : 3;
      const secondGroup =
        secondDays !== null && secondDays < 0
          ? 0
          : secondDays === 0
            ? 1
            : secondDays === 1
              ? 2
              : 3;
      return (
        firstGroup - secondGroup ||
        deadlineValue(firstDays) - deadlineValue(secondDays) ||
        importanceDifference ||
        workloadDifference ||
        prerequisiteDifference ||
        first.title.localeCompare(second.title)
      );
    }

    if (quadrant === "schedule") {
      return (
        deadlineValue(firstDays) - deadlineValue(secondDays) ||
        importanceDifference ||
        prerequisiteDifference ||
        workloadDifference ||
        first.title.localeCompare(second.title)
      );
    }

    if (quadrant === "delegate") {
      return (
        deadlineValue(firstDays) - deadlineValue(secondDays) ||
        first.estimatedHours - second.estimatedHours ||
        prerequisiteDifference ||
        first.title.localeCompare(second.title)
      );
    }

    return (
      Number(firstDays === null) - Number(secondDays === null) ||
      deadlineValue(firstDays) - deadlineValue(secondDays) ||
      first.title.localeCompare(second.title)
    );
  });
}

function deadlineLabel(task: StudyTask) {
  const days = getTaskDaysRemaining(task.dueDate);
  if (days === null) return "No due date";
  if (days < 0) return `Overdue by ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 3) return `Due in ${days} days`;
  return `Due ${new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function assignmentReason(task: StudyTask, automatic: boolean) {
  const days = getTaskDaysRemaining(task.dueDate);
  if (task.quadrantOverride) return "You manually prioritized this task.";
  if (!automatic) return "Automatic prioritization is off; this task stays in its current quadrant.";
  if (days !== null && days < 0) return "Overdue work stays in Do First until completed or rescheduled.";
  if (days !== null && days <= 3 && task.importance !== "low") {
    return "Important work due within 3 days is moved to Do First.";
  }
  if (days !== null && days <= 3) return "Its near deadline makes this a quick or delegate task.";
  if (task.importance === "low") return "Low-importance work without an approaching deadline stays low priority.";
  return "Important work with more than 3 days remaining is scheduled for later.";
}

function TaskEditForm({
  task,
  tasks,
  onSave,
}: {
  task: StudyTask;
  tasks: StudyTask[];
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSave} className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-medium">
        Task title
        <Input
          name="title"
          defaultValue={task.title}
          required
          maxLength={200}
          className="mt-1 w-full bg-background"
        />
      </label>
      <label className="text-xs font-medium">
        Course or context
        <Input
          name="course"
          defaultValue={task.course}
          className="mt-1 w-full bg-background"
        />
      </label>
      <label className="text-xs font-medium">
        Due date
        <Input
          name="dueDate"
          type="date"
          defaultValue={task.dueDate}
          className="mt-1 w-full bg-background"
        />
      </label>
      <label className="text-xs font-medium">
        Importance
        <select
          name="importance"
          defaultValue={task.importance}
          className="mt-1 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm"
        >
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label className="text-xs font-medium">
        Task type
        <select
          name="kind"
          defaultValue={task.kind}
          className="mt-1 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm"
        >
          <option value="academic">Academic assignment</option>
          <option value="administrative">Administrative / quick task</option>
          <option value="optional">Optional / personal</option>
        </select>
      </label>
      <label className="text-xs font-medium">
        Estimated workload (hours)
        <Input
          name="estimatedHours"
          type="number"
          min="0"
          max="500"
          step="0.5"
          defaultValue={task.estimatedHours}
          className="mt-1 w-full bg-background"
        />
      </label>
      <label className="text-xs font-medium">
        Estimated Pomodoro sessions
        <Input
          name="estimatedPomodoros"
          type="number"
          min="0"
          max="1000"
          defaultValue={task.estimatedPomodoros}
          className="mt-1 w-full bg-background"
        />
      </label>
      <label className="text-xs font-medium">
        Prerequisite task
        <select
          name="dependsOn"
          defaultValue={task.dependsOn[0] ?? ""}
          className="mt-1 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm"
        >
          <option value="">No prerequisite</option>
          {tasks
            .filter((candidate) => candidate.id !== task.id && !candidate.completed)
            .map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title}
              </option>
            ))}
        </select>
      </label>
      <label className="text-xs font-medium">
        Repeat
        <select
          name="recurrence"
          defaultValue={task.recurrence}
          className="mt-1 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm"
        >
          <option value="none">Does not repeat</option>
          <option value="weekly">Weekly</option>
        </select>
      </label>
      <Button
        type="submit"
        className="self-end"
      >
        Save changes
      </Button>
    </form>
  );
}

export default function EisenhowerMatrix() {
  const {
    tasks,
    loaded,
    autoPrioritizationEnabled,
    syncError,
    setAutoPrioritizationEnabled,
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
    moveTask,
    returnToAutomatic,
  } = useStudyTasks();
  const timer = usePomodoro();
  const [expandedQuadrants, setExpandedQuadrants] = useState<
    Partial<Record<TaskQuadrant, boolean>>
  >({});
  const [completedVisible, setCompletedVisible] = useState(false);
  const [dragOverQuadrant, setDragOverQuadrant] =
    useState<TaskQuadrant | null>(null);
  const manageTasksDialogRef = useRef<HTMLDialogElement>(null);

  const activeTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);

  function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    addTask({
      title: String(data.get("title") ?? ""),
      dueDate: String(data.get("dueDate") ?? ""),
      course: String(data.get("course") ?? ""),
      importance: String(data.get("importance") ?? "medium") as TaskImportance,
      kind: String(data.get("kind") ?? "academic") as TaskKind,
      estimatedHours: Number(data.get("estimatedHours") ?? 1),
      estimatedPomodoros: Number(data.get("estimatedPomodoros") ?? 1),
      recurrence: String(data.get("recurrence") ?? "none") as TaskRecurrence,
    });
    form.reset();
  }

  function saveTask(taskId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    updateTask(taskId, {
      title: String(data.get("title") ?? "").trim(),
      course: String(data.get("course") ?? "").trim(),
      dueDate: String(data.get("dueDate") ?? ""),
      importance: String(data.get("importance") ?? "medium") as TaskImportance,
      kind: String(data.get("kind") ?? "academic") as TaskKind,
      estimatedHours: Number(data.get("estimatedHours") ?? 0),
      estimatedPomodoros: Number(data.get("estimatedPomodoros") ?? 0),
      dependsOn: data.get("dependsOn")
        ? [String(data.get("dependsOn"))]
        : [],
      recurrence: String(data.get("recurrence") ?? "none") as TaskRecurrence,
    });
  }

  function removeTask(task: StudyTask) {
    if (window.confirm(`Delete "${task.title}"? This cannot be undone.`)) {
      deleteTask(task.id);
    }
  }

  function handleTaskDrop(event: DragEvent<HTMLElement>, quadrant: TaskQuadrant) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    if (taskId && activeTasks.some((task) => task.id === taskId)) {
      moveTask(taskId, quadrant);
    }
    setDragOverQuadrant(null);
  }

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-5 py-7 text-foreground md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-7 pb-12">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">StudySync Resourses</p>
            <h1 className="font-heading mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Task Navigator
            </h1>
          </div>
          <Link  href="/dashboard"className="text-sm font-medium text-muted-foreground transition hover:text-secondary">
            <Button variant="secondary" size="s">
                Back to dashboard
            </Button>
          </Link>
        </header>
        <Separator />
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
          Make your next study step clear. Tasks are organized by urgency
          and importance, and you stay in control of every priority.
        </p>
          <label className="flex items-center gap-3 self-end rounded-xl border border-foreground/10 bg-card px-4 py-3 text-sm shadow-sm">
            <input
              type="checkbox"
              checked={autoPrioritizationEnabled}
              onChange={(event) =>
                setAutoPrioritizationEnabled(event.currentTarget.checked)
              }
              className="size-4 accent-secondary"
            />
            <span>
              <span className="block font-semibold">Automatic prioritization</span>
              <span className="text-xs text-muted-foreground">
                {autoPrioritizationEnabled ? "On" : "Off"}
              </span>
            </span>
          </label>

        {syncError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {syncError} Reload the page after signing in or reconnecting to retry sync.
          </p>
        )}

        <Card aria-label="Add study task">
          <CardHeader>
            <CardTitle>Add a task</CardTitle>
            <CardDescription>
              No four-task cap on what you can create. The matrix shows the
              highest-priority four in each quadrant.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={createTask}
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              <label className="text-xs font-medium">
                Task
                <Input
                  name="title"
                  required
                  maxLength={200}
                  placeholder="e.g. Prepare for biology exam"
                  className="mt-1 w-full bg-background"
                />
              </label>
              <label className="text-xs font-medium">
                Course or context
                <Input
                  name="course"
                  placeholder="e.g. BIO 201"
                  className="mt-1 w-full bg-background"
                />
              </label>
              <label className="text-xs font-medium">
                Due date (optional)
                <Input
                  name="dueDate"
                  type="date"
                  className="mt-1 w-full bg-background"
                />
              </label>
              <label className="text-xs font-medium">
                Importance
                <select
                  name="importance"
                  defaultValue="medium"
                  className="mt-1 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="text-xs font-medium">
                Task type
                <select
                  name="kind"
                  defaultValue="academic"
                  className="mt-1 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm"
                >
                  <option value="academic">Academic assignment</option>
                  <option value="administrative">
                    Administrative / quick task
                  </option>
                  <option value="optional">Optional / personal</option>
                </select>
              </label>
              <label className="text-xs font-medium">
                Workload (hours)
                <Input
                  name="estimatedHours"
                  type="number"
                  min="0"
                  max="500"
                  step="0.5"
                  defaultValue="1"
                  className="mt-1 w-full bg-background"
                />
              </label>
              <label className="text-xs font-medium">
                Estimated Pomodoros
                <Input
                  name="estimatedPomodoros"
                  type="number"
                  min="0"
                  max="1000"
                  defaultValue="1"
                  className="mt-1 w-full bg-background"
                />
              </label>
              <label className="text-xs font-medium">
                Repeat
                <select
                  name="recurrence"
                  defaultValue="none"
                  className="mt-1 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm"
                >
                  <option value="none">Does not repeat</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
              <Button type="submit" className="self-end">
                Add to planner
              </Button>
            </form>
          </CardContent>
        </Card>

        {!autoPrioritizationEnabled && (
          <p className="rounded-lg border border-secondary/20 bg-secondary/5 px-4 py-3 text-sm text-foreground">
            Automatic moves are paused. Existing priorities stay in place until
            you drag a task or turn automatic prioritization back on.
          </p>
        )}

        {!loaded ? (
          <p role="status" className="py-8 text-center text-sm text-muted-foreground">
            Loading your planner…
          </p>
        ) : (
          <section aria-label="Eisenhower Matrix">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
                  YOUR PRIORITIES
                </p>
                <h2 className="font-heading mt-1 text-2xl font-semibold">
                  Eisenhower Matrix
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Drag cards between quadrants, or focus a drag handle and use arrow keys.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  {activeTasks.length} active · {completedTasks.length} completed
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="s"
                  onClick={() => manageTasksDialogRef.current?.showModal()}
                >
                  Manage tasks
                </Button>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {quadrantDetails.map((quadrant) => {
                const quadrantTasks = sortQuadrantTasks(
                  activeTasks.filter((task) => task.quadrant === quadrant.id),
                  quadrant.id,
                  activeTasks,
                );
                const expanded = expandedQuadrants[quadrant.id] === true;
                const visibleTasks = expanded
                  ? quadrantTasks
                  : quadrantTasks.slice(0, 4);

                return (
                  <Card
                    key={quadrant.id}
                    aria-label={`${quadrant.title} quadrant`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDragOverQuadrant(quadrant.id);
                    }}
                    onDragLeave={(event) => {
                      const nextTarget = event.relatedTarget;
                      if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                        setDragOverQuadrant(null);
                      }
                    }}
                    onDrop={(event) => handleTaskDrop(event, quadrant.id)}
                    className={`p-4 shadow-sm transition-colors md:p-5 ${quadrant.color} ${dragOverQuadrant === quadrant.id ? "ring-2 ring-secondary ring-offset-2" : ""}`}
                  >
                    <CardHeader className="flex flex-row items-start justify-between gap-3 px-0 pt-0">
                      <div className="flex items-start gap-3">
                        <span className={`mt-1.5 size-3 shrink-0 rounded-full ${quadrant.indicator}`} />
                        <div>
                          <CardTitle className="text-lg">
                            {quadrant.title}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {quadrant.subtitle}
                          </CardDescription>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-background/80 px-2.5 py-1 text-xs font-semibold">
                        {quadrantTasks.length} {quadrantTasks.length === 1 ? "task" : "tasks"}
                      </span>
                    </CardHeader>

                    <div className="space-y-2">
                      {visibleTasks.length === 0 && (
                        <p className="rounded-xl border border-dashed border-foreground/15 bg-background/60 px-4 py-4 text-center text-sm text-muted-foreground">
                          Nothing here right now. {quadrant.label}.
                        </p>
                      )}
                      {visibleTasks.map((task) => {
                        const days = getTaskDaysRemaining(task.dueDate);
                        const progress =
                          task.estimatedPomodoros > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (task.completedPomodoros /
                                    task.estimatedPomodoros) *
                                    100,
                                ),
                              )
                            : 0;
                        const largeEarlyTask =
                          task.estimatedHours >= 6 && days !== null && days > 3;

                        return (
                          <article
                            key={task.id}
                            className="rounded-lg border border-foreground/10 bg-background px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md"
                          >
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                draggable
                                onDragStart={(event) => {
                                  event.dataTransfer.setData("text/plain", task.id);
                                  event.dataTransfer.effectAllowed = "move";
                                }}
                                onDragEnd={() => setDragOverQuadrant(null)}
                                onKeyDown={(event) => {
                                  const destination =
                                    keyboardQuadrantMoves[task.quadrant][event.key as keyof typeof keyboardQuadrantMoves[TaskQuadrant]];
                                  if (destination) {
                                    event.preventDefault();
                                    moveTask(task.id, destination);
                                  }
                                }}
                                title="Drag to move this task to another quadrant"
                                aria-label={`Drag ${task.title} to another quadrant`}
                                className="cursor-grab touch-none select-none rounded text-sm leading-none text-muted-foreground active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary"
                              >
                                ⋮⋮
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleTask(task.id)}
                                aria-label={`Mark ${task.title} complete`}
                                className="flex size-5 shrink-0 items-center justify-center rounded-full border border-secondary text-[10px] text-secondary hover:bg-secondary hover:text-secondary-foreground"
                              >
                                ✓
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <h4 className="truncate text-sm font-semibold leading-snug">{task.title}</h4>
                                  {days !== null && days < 0 && (
                                    <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                                      Overdue
                                    </span>
                                  )}
                                  {task.quadrantOverride && (
                                    <span className="rounded-full bg-secondary/10 px-1.5 py-0.5 text-[10px] font-medium text-secondary">
                                      Manual
                                    </span>
                                  )}
                                </div>
                                <p className={`mt-0.5 truncate text-xs ${days !== null && days < 0 ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                                  {deadlineLabel(task)}
                                  {task.course ? ` · ${task.course}` : ""}
                                </p>
                              </div>
                              <Button
                                type="button"
                                onClick={() => removeTask(task)}
                                aria-label={`Delete ${task.title}`}
                                variant="ghost"
                                size="xs"
                                className="h-7 w-auto shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground"
                              >
                                Delete
                              </Button>
                            </div>

                            <div className="mt-2 flex items-center gap-2 pl-7">
                              <Button
                                type="button"
                                onClick={() => timer.start(task.id)}
                                aria-label={`Start focus session for ${task.title}`}
                                size="xs"
                                className="h-7 w-auto px-2.5 text-[11px]"
                              >
                                {timer.isRunning && timer.activeTaskId === task.id
                                  ? "Studying"
                                  : "Focus"}
                              </Button>
                              <span
                                className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-muted"
                                role="progressbar"
                                aria-label={`${task.title} Pomodoro progress`}
                                aria-valuenow={progress}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              >
                                <span
                                  className="block h-full rounded-full bg-secondary transition-[width]"
                                  style={{ width: `${progress}%` }}
                                />
                              </span>
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {task.completedPomodoros}/{task.estimatedPomodoros}
                              </span>
                              {largeEarlyTask && (
                                <span
                                  title={`${task.estimatedHours} hour workload; consider starting early`}
                                  aria-label={`Large workload, ${task.estimatedHours} hours; start early`}
                                  className="shrink-0 rounded bg-primary/10 px-1 py-0.5 text-[10px] font-semibold text-primary"
                                >
                                  Early
                                </span>
                              )}
                              {autoPrioritizationEnabled && (
                                <span className="sr-only">
                                  {assignmentReason(task, autoPrioritizationEnabled)}
                                  {task.quadrantOverride &&
                                    days !== null &&
                                    days <= 3 &&
                                    ". Deadline approaching; review this manually prioritized task."}
                                </span>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {quadrantTasks.length > 4 && (
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-foreground/10 pt-3 text-sm">
                        <span className="font-medium text-muted-foreground">
                          {expanded
                            ? `Showing all ${quadrantTasks.length} tasks`
                            : `+${quadrantTasks.length - 4} More Tasks`}
                        </span>
                        <Button
                          type="button"
                          onClick={() =>
                            setExpandedQuadrants((current) => ({
                              ...current,
                              [quadrant.id]: !expanded,
                            }))
                          }
                          variant="link"
                          size="s"
                          className="h-auto w-auto px-1 font-semibold"
                        >
                          {expanded ? "Show top 4" : "View All"}
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        <dialog
          ref={manageTasksDialogRef}
          aria-label="Manage planner tasks"
          className="fixed left-1/2 top-1/2 m-0 max-h-[90vh] w-[min(96vw,900px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-foreground/10 bg-card p-5 text-card-foreground shadow-2xl backdrop:bg-black/60 sm:p-8"
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
                YOUR TASK LIST
              </p>
              <h2 className="font-heading mt-1 text-2xl font-semibold">
                Manage tasks
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Edit details, update priorities, and review study progress.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="s"
              onClick={() => manageTasksDialogRef.current?.close()}
            >
              Close
            </Button>
          </div>
          <div className="divide-y divide-foreground/10">
            {[...activeTasks, ...completedTasks].map((task) => (
              <details key={`${task.id}-${task.updatedAt}`} className="py-3">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {task.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {task.completed ? "Completed" : quadrantDetails.find((quadrant) => quadrant.id === task.quadrant)?.title}
                      {" · "}
                      {deadlineLabel(task)}
                      {task.course ? ` · ${task.course}` : ""}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-secondary">
                    Edit
                  </span>
                </summary>
                <div className="mt-3 rounded-lg bg-background p-4">
                  <TaskEditForm
                    task={task}
                    tasks={activeTasks}
                    onSave={(event) => saveTask(task.id, event)}
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 pt-3">
                    <p className="text-xs text-muted-foreground">
                      {autoPrioritizationEnabled
                        ? assignmentReason(task, autoPrioritizationEnabled)
                        : "Automatic prioritization is off."}
                      {task.quadrantOverride &&
                        getTaskDaysRemaining(task.dueDate) !== null &&
                        (getTaskDaysRemaining(task.dueDate) ?? 99) <= 3 && (
                          <span className="ml-1 font-semibold text-destructive">
                            Deadline approaching — review this manually prioritized task.
                          </span>
                        )}
                    </p>
                    <div className="flex items-center gap-2">
                      {task.quadrantOverride && (
                        <Button
                          type="button"
                          onClick={() => returnToAutomatic(task.id)}
                          variant="outline"
                          size="xs"
                          className="h-8 w-auto px-3 text-xs font-semibold text-secondary"
                        >
                          Return to automatic
                        </Button>
                      )}
                      <Button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        variant="outline"
                        size="xs"
                        className="h-8 w-auto px-3 text-xs font-semibold"
                      >
                        {task.completed ? "Restore task" : "Complete task"}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => removeTask(task)}
                        variant="ghost"
                        size="xs"
                        className="h-8 w-auto px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </details>
            ))}
            {tasks.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No tasks yet. Add one to get started.
              </p>
            )}
          </div>
        </dialog>

        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Completed tasks</CardTitle>
              <CardDescription>
                Completed tasks leave the active matrix; their study progress stays saved.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="s"
              onClick={() => setCompletedVisible((visible) => !visible)}
            >
              {completedVisible ? "Hide completed" : `View completed (${completedTasks.length})`}
            </Button>
          </CardHeader>
          {completedVisible && (
            <CardContent className="divide-y divide-foreground/10">
              {completedTasks.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">
                  No completed tasks yet.
                </p>
              )}
              {completedTasks.map((task) => (
                <div key={task.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="flex size-6 items-center justify-center rounded-full bg-secondary/10 text-xs font-bold text-secondary">
                    ✓
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium line-through opacity-70">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.completedPomodoros} Pomodoro sessions completed
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    variant="outline"
                    size="xs"
                    className="h-8 w-auto px-3 text-xs"
                  >
                    Restore
                  </Button>
                  <Button
                    type="button"
                    onClick={() => removeTask(task)}
                    variant="ghost"
                    size="xs"
                    className="h-8 w-auto px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </CardContent>
          )}
        </Card>

        <Card className="flex-row flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-semibold">
              {timer.activeTaskTitle
                ? `Current focus: ${timer.activeTaskTitle}`
                : "Ready for a focused study session?"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {timer.phase === "focus" ? "Focus" : "Break"} · {formatTime(timer.secondsLeft)}
              {timer.isRunning ? " · Timer running" : ""}
            </p>
          </div>
          <Link href="/dashboard/timer">
            <Button variant="secondary" size="s">
              Pomodoro settings
            </Button>
          </Link>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Priorities use your local calendar date ({getLocalDateKey()}). Large
          workloads are flagged for early preparation without changing quadrants.
        </p>
      </div>
    </main>
  );
}
