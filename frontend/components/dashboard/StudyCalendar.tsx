"use client";

import {useEffect, useRef, useState} from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import StudyTaskEditor from "./StudyTaskEditor";
import {useStudyTasks} from "./StudyTasksProvider";

function startOfWeek(date: Date) {
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

function sameDay(first: Date, second: Date) {
    return first.toDateString() === second.toDateString();
}

function dateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export default function StudyCalendar() {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const {tasks} = useStudyTasks();

    useEffect(() => {
        setSelectedDate(new Date());
    }, []);

    if (!selectedDate) {
        return (
            <Card>
                <CardContent>Loading calendar…</CardContent>
            </Card>
        );
    }

    const monday = startOfWeek(selectedDate);
    const weekDays = Array.from({length: 7}, (_, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        return date;
    });

    const firstOfMonth = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        1
    );
    const gridStart = startOfWeek(firstOfMonth);
    const monthDays = Array.from({length: 42}, (_, index) => {
        return new Date(
            gridStart.getFullYear(),
            gridStart.getMonth(),
            gridStart.getDate() + index
        );
    });

    function moveWeek(amount: number) {
        setSelectedDate((currentDate) => {
            const nextDate = new Date(currentDate ?? new Date());
            nextDate.setDate(nextDate.getDate() + amount * 7);
            return nextDate;
        });
    }

    function moveMonth(amount: number) {
        setSelectedDate((currentDate) => {
            const date = currentDate ?? new Date();
            const year = date.getFullYear();
            const month = date.getMonth() + amount;
            const lastDay = new Date(year, month + 1, 0).getDate();

            return new Date(year, month, Math.min(date.getDate(), lastDay));
        });
    }

    const controlClass =
        "rounded-md border border-foreground/10 px-3 py-1 text-sm text-foreground hover:bg-muted";

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>
                        {monday.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                        })}
                        {" – "}
                        {weekDays[6].toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        })}
                    </CardTitle>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => moveWeek(-1)}
                            className={controlClass}
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedDate(new Date())}
                            className={controlClass}
                        >
                            Today
                        </button>
                        <button
                            type="button"
                            onClick={() => moveWeek(1)}
                            className={controlClass}
                        >
                            Next
                        </button>
                        <button
                            type="button"
                            onClick={() => dialogRef.current?.showModal()}
                            aria-label="Open full calendar"
                            title="Open full calendar"
                            className="inline-flex size-9 items-center justify-center rounded-md border border-foreground/10 text-foreground hover:bg-muted"
                        >
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                aria-hidden="true"
                            >
                                <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>
                            </svg>
                        </button>
                    </div>
                </CardHeader>

                <CardContent>
                    <div className="grid grid-cols-7 gap-1 text-center">
                        {weekDays.map((date) => {
                            const isSelected = sameDay(date, selectedDate);
                            const dayTasks = tasks.filter(
                                (task) => task.dueDate === dateKey(date)
                            );

                            return (
                                <button
                                    key={date.toDateString()}
                                    type="button"
                                    onClick={() => setSelectedDate(date)}
                                    aria-pressed={isSelected}
                                    className={`flex flex-col items-center rounded-lg p-2 text-xs transition-colors ${
                                        isSelected
                                            ? "bg-secondary text-secondary-foreground hover:bg-secondary"
                                            : "text-foreground hover:bg-muted"
                                    }`}
                                >
                  <span>
                    {date.toLocaleDateString(undefined, {
                        weekday: "short",
                    })}
                  </span>
                                    <span className="mt-1 font-semibold">{date.getDate()}</span>
                                    {dayTasks.length > 0 && (
                                        <span
                                            className="mt-1 min-w-4 rounded-full bg-background px-1 text-[10px] text-foreground"
                                            title={dayTasks.map((task) => task.title).join(", ")}
                                        >
                                             {dayTasks.length}
                                             </span>
                                    )}

                                </button>
                            );
                        })}
                    </div>

                    <p className="mt-5 border-t border-foreground/10 pt-4 text-sm">
                        Selected:{" "}
                        {selectedDate.toLocaleDateString(undefined, {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                        })}
                    </p>
                </CardContent>
            </Card>

            <dialog
                ref={dialogRef}
                aria-label="Full calendar"
                className="fixed left-1/2 top-1/2 m-0 max-h-[90vh] w-[min(96vw,1100px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-foreground/10 bg-card p-5 text-card-foreground shadow-2xl backdrop:bg-black/60 sm:p-8"
            >
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <h2 className="font-heading text-2xl font-semibold">
                        {selectedDate.toLocaleDateString(undefined, {
                            month: "long",
                            year: "numeric",
                        })}
                    </h2>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => moveMonth(-1)}
                            className={controlClass}
                        >
                            Previous month
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedDate(new Date())}
                            className={controlClass}
                        >
                            Today
                        </button>
                        <button
                            type="button"
                            onClick={() => moveMonth(1)}
                            className={controlClass}
                        >
                            Next month
                        </button>
                        <button
                            type="button"
                            onClick={() => dialogRef.current?.close()}
                            className={controlClass}
                        >
                            Close
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                        <span key={day} className="py-2">
              {day}
            </span>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {monthDays.map((date) => {
                        const isSelected = sameDay(date, selectedDate);
                        const isOutsideMonth =
                            date.getMonth() !== selectedDate.getMonth();
                        const dayTasks = tasks.filter(
                            (task) => task.dueDate === dateKey(date)
                        );

                        return (
                            <button
                                key={date.toDateString()}
                                type="button"
                                aria-label={date.toLocaleDateString(undefined, {
                                    weekday: "long",
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                                aria-pressed={isSelected}
                                onClick={() => setSelectedDate(date)}
                                className={`flex h-16 items-start rounded-lg border border-foreground/10 p-2 text-left text-sm transition-colors sm:h-24 ${
                                    isSelected
                                        ? "bg-secondary text-secondary-foreground hover:bg-secondary"
                                        : isOutsideMonth
                                            ? "text-muted-foreground hover:bg-muted"
                                            : "text-foreground hover:bg-muted"
                                }`}
                            >
                                <span className="font-semibold">{date.getDate()}</span>
                                {dayTasks.length > 0 && (
                                    <span
                                        className="mt-1 max-w-full truncate rounded bg-background px-1.5 text-[10px] text-foreground">
                                          {dayTasks.length === 1
                                              ? dayTasks[0].title
                                              : `${dayTasks.length} tasks`}
                                         </span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="mt-6">
                    <StudyTaskEditor date={selectedDate}/>
                </div>
            </dialog>
        </>
    );
}