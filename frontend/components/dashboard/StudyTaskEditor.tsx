"use client";

import {useState, type FormEvent} from "react";
import {useStudyTasks} from "./StudyTasksProvider";

function dateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export default function StudyTaskEditor({date}: { date: Date }) {
    const {tasks, addTask, toggleTask, deleteTask} = useStudyTasks();
    const [title, setTitle] = useState("");
    const [course, setCourse] = useState("");

    const tasksForDay = tasks.filter(
        (task) => task.dueDate === dateKey(date)
    );

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!title.trim()) return;

        addTask(title, dateKey(date), course);
        setTitle("");
        setCourse("");
    }

    return (
        <section className="rounded-lg border border-foreground/10 p-4">
            <h3 className="font-heading text-lg font-semibold">
                Tasks for{" "}
                {date.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                })}
            </h3>

            <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap gap-3">
                <label className="min-w-48 flex-1 text-sm">
                    Task
                    <input
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="e.g. Review biology notes"
                        required
                        className="mt-1 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-foreground"
                    />
                </label>

                <label className="min-w-40 flex-1 text-sm">
                    Course (optional)
                    <input
                        type="text"
                        value={course}
                        onChange={(event) => setCourse(event.target.value)}
                        placeholder="e.g. BIO 201"
                        className="mt-1 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-foreground"
                    />
                </label>

                <button
                    type="submit"
                    className="self-end rounded-md bg-secondary px-4 py-2 font-medium text-secondary-foreground hover:opacity-90"
                >
                    Add task
                </button>
            </form>

            {tasksForDay.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                    No tasks planned for this day.
                </p>
            ) : (
                <ul className="mt-4 space-y-2">
                    {tasksForDay.map((task) => (
                        <li
                            key={task.id}
                            className="flex items-center gap-3 rounded-md border border-foreground/10 p-3"
                        >
                            <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={() => toggleTask(task.id)}
                                aria-label={`Complete ${task.title}`}
                            />

                            <div className="min-w-0 flex-1">
                                <p className={task.completed ? "line-through opacity-60" : ""}>
                                    {task.title}
                                </p>
                                {task.course && (
                                    <p className="text-xs text-muted-foreground">
                                        {task.course}
                                    </p>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => deleteTask(task.id)}
                                className="text-sm text-muted-foreground hover:text-foreground"
                                aria-label={`Delete ${task.title}`}
                            >
                                Delete
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}