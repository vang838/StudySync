"use client";

import {Card, CardContent} from "@/components/ui/card";
import {useStudyTasks} from "./StudyTasksProvider";

function formatDueDate(value: string) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
}

export default function UpcomingStudyTasks() {
    const {tasks, toggleTask} = useStudyTasks();

    const upcoming = tasks
        .filter((task) => !task.completed)
        .sort((first, second) => first.dueDate.localeCompare(second.dueDate))
        .slice(0, 5);

    return (
        <Card className="gap-0">
            <CardContent>
                {upcoming.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No study tasks yet. Open the calendar to add one.
                    </p>
                ) : (
                    <ul className="divide-y divide-foreground/10">
                        {upcoming.map((task) => (
                            <li key={task.id} className="flex items-center gap-3 py-3">
                                <input
                                    type="checkbox"
                                    checked={task.completed}
                                    onChange={() => toggleTask(task.id)}
                                    aria-label={`Complete ${task.title}`}
                                />

                                <div className="min-w-0 flex-1">
                                    <p className="font-medium">{task.title}</p>
                                    {task.course && (
                                        <p className="text-xs text-muted-foreground">
                                            {task.course}
                                        </p>
                                    )}
                                </div>

                                <time
                                    dateTime={task.dueDate}
                                    className="shrink-0 text-xs font-medium"
                                >
                                    {formatDueDate(task.dueDate)}
                                </time>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}