"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {HugeiconsIcon} from "@hugeicons/react";
import {
    ArrowRight01Icon,
    BookOpen01Icon,
    Calendar03Icon,
    CheckmarkCircle01Icon,
    Clock01Icon,
    FileTextIcon,
    Upload01Icon,
} from "@hugeicons/core-free-icons";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import StudyCalendar from "@/components/dashboard/StudyCalendar";
import {useStudyTasks} from "@/components/dashboard/StudyTasksProvider";

type SavedCourse = {
    course_id: string;
    title: string;
    subject: string;
    year: number;
};

const uploads = [
    {
        name: "Cell Structure Lecture.pdf",
        course: "Human Biology",
        date: "Sep 22",
    },
    {
        name: "Chapter 4 Notes.pdf",
        course: "Statistics & Probability",
        date: "Sep 20",
    },
    {
        name: "Industrial Revolution.docx",
        course: "World History",
        date: "Sep 18",
    },
];

const quickActions = [
    {
        title: "My courses",
        description: "Continue learning",
        href: "#courses",
        icon: BookOpen01Icon,
    },
    {
        title: "Recent uploads",
        description: "Find your materials",
        href: "#uploads",
        icon: Upload01Icon,
    },
    {
        title: "Planner",
        description: "See your week",
        href: "#planner",
        icon: Calendar03Icon,
    },
    {
        title: "Study tasks",
        description: "See what's next",
        href: "#tasks",
        icon: CheckmarkCircle01Icon,
    },
];

function SectionHeading({
                            eyebrow,
                            title,
                        }: {
    eyebrow: string;
    title: string;
}) {
    return (
        <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
                {eyebrow}
            </p>
            <h2 className="font-heading mt-1 text-xl font-semibold">
                {title}
            </h2>
        </div>
    );
}

export default function StudentDashboardPage() {
    const {tasks, toggleTask} = useStudyTasks();
    const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
    const [coursesLoading, setCoursesLoading] = useState(true);
    const [coursesError, setCoursesError] = useState("");
    const upcomingTasks = tasks
        .filter((task) => !task.completed)
        .sort((first, second) => first.dueDate.localeCompare(second.dueDate))
        .slice(0, 5);

    useEffect(() => {
        const controller = new AbortController();

        async function loadSavedCourses() {
            try {
                const userId = Number(window.localStorage.getItem("user_id"));
                if (!Number.isInteger(userId) || userId <= 0) {
                    throw new Error("Sign in to view your saved courses.");
                }

                const response = await fetch(`/api/courses/saved?user_id=${userId}`, {
                    signal: controller.signal,
                    cache: "no-store",
                });
                if (!response.ok) {
                    throw new Error("Unable to load your saved courses. Please refresh to try again.");
                }

                const data: unknown = await response.json();
                if (!Array.isArray(data) || !data.every((course) =>
                    typeof course?.course_id === "string" && typeof course?.title === "string" &&
                    typeof course?.subject === "string" && Number.isInteger(course?.year)
                )) {
                    throw new Error("Unable to load your saved courses. Please refresh to try again.");
                }

                if (!controller.signal.aborted) {
                    setSavedCourses(data);
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    setCoursesError(error instanceof Error ? error.message : "Unable to load your saved courses.");
                }
            } finally {
                if (!controller.signal.aborted) {
                    setCoursesLoading(false);
                }
            }
        }

        void loadSavedCourses();

        return () => controller.abort();
    }, []);

    return (
        <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-9 pb-10">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">
                        Student workspace
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-3">
                        <h1 className="font-heading text-3xl font-bold">
                            Student Dashboard
                        </h1>
                        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Sample data
            </span>
                    </div>

                    <p className="mt-2 text-sm text-muted-foreground">
                        Your courses, materials, and next study steps in one
                        place.
                    </p>
                </div>

                <section id="quick-actions">
                    <SectionHeading
                        eyebrow="Get started"
                        title="Quick actions"
                    />

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {quickActions.map((action) => (
                            <a
                                key={action.href}
                                href={action.href}
                                className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-card p-4 text-card-foreground transition hover:border-secondary hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                            >
                <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-secondary">
                  <HugeiconsIcon
                      icon={action.icon}
                      size={20}
                  />
                </span>

                                <span className="min-w-0 flex-1">
                  <strong className="block text-sm">
                    {action.title}
                  </strong>
                  <small className="text-xs text-muted-foreground">
                    {action.description}
                  </small>
                </span>

                                <HugeiconsIcon
                                    icon={ArrowRight01Icon}
                                    size={16}
                                    aria-hidden="true"
                                />
                            </a>
                        ))}
                    </div>
                </section>

                <section aria-label="Study statistics">
                    <SectionHeading
                        eyebrow="At a glance"
                        title="Study statistics"
                    />

                    <div className="grid gap-4 sm:grid-cols-3">
                        {[
                            {
                                label: "Saved courses",
                                value: coursesLoading || coursesError ? "—" : String(savedCourses.length),
                                icon: BookOpen01Icon,
                            },
                            {
                                label: "Recent uploads",
                                value: String(uploads.length),
                                icon: FileTextIcon,
                            },
                            {
                                label: "Average progress",
                                value: "—",
                                icon: Clock01Icon,
                            },
                        ].map((stat) => (
                            <Card key={stat.label} className="gap-0">
                                <CardContent className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            {stat.label}
                                        </p>
                                        <p className="mt-2 text-3xl font-bold">
                                            {stat.value}
                                        </p>
                                    </div>

                                    <HugeiconsIcon
                                        icon={stat.icon}
                                        size={26}
                                        className="text-secondary"
                                    />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="flex min-w-0 flex-col gap-8">
                        <section id="courses" className="scroll-mt-5">
                            <SectionHeading
                                eyebrow="Keep learning"
                                title="Saved & recent courses"
                            />

                            <div className="grid gap-4 md:grid-cols-3">
                                {coursesLoading && (
                                    <p role="status" className="text-sm text-muted-foreground">Loading saved courses...</p>
                                )}
                                {coursesError && (
                                    <p role="alert" className="text-sm text-destructive">{coursesError}</p>
                                )}
                                {!coursesLoading && !coursesError && savedCourses.length === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        No saved courses yet. <Link href="/courses/course_search" className="underline">Browse courses</Link> to save one.
                                    </p>
                                )}
                                {savedCourses.map((course) => (
                                    <Link
                                        key={course.course_id}
                                        href={`/courses/${encodeURIComponent(course.course_id)}`}
                                        className="block"
                                    >
                                        <Card
                                            size="sm"
                                            className="gap-0"
                                        >
                                            <CardHeader>
                                                <p className="text-xs font-semibold text-secondary">
                                                    {course.course_id}
                                                </p>
                                                <CardTitle className="text-sm">
                                                    {course.title}
                                                </CardTitle>
                                            </CardHeader>

                                            <CardContent>
                                                <p className="text-xs text-muted-foreground">
                                                    {course.subject} · {course.year}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        </section>

                        <section id="uploads" className="scroll-mt-5">
                            <SectionHeading
                                eyebrow="Your materials"
                                title="Recent uploads"
                            />

                            <Card className="gap-0">
                                <CardContent className="divide-y divide-foreground/10">
                                    {uploads.map((upload) => (
                                        <div
                                            key={upload.name}
                                            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                                        >
                      <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-secondary">
                        <HugeiconsIcon
                            icon={FileTextIcon}
                            size={18}
                        />
                      </span>

                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-medium">
                                                    {upload.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {upload.course}
                                                </p>
                                            </div>

                                            <time className="shrink-0 text-xs text-muted-foreground">
                                                {upload.date}
                                            </time>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </section>

                        <section id="tasks" className="scroll-mt-5">
                            <SectionHeading
                                eyebrow="Coming up"
                                title="Upcoming study tasks"
                            />

                            <Card className="gap-0">
                                <CardContent className="divide-y divide-foreground/10">
                                    {upcomingTasks.length === 0 && (
                                        <p className="text-sm text-muted-foreground">
                                            No upcoming tasks yet. Open the calendar to add one.
                                        </p>
                                    )}
                                    {upcomingTasks.map((task) => (
                                        <div
                                            key={task.id}
                                            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleTask(task.id)}
                                                aria-label={`Mark ${task.title} complete`}
                                                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-secondary hover:bg-muted focus-visible:outline-2 focus-visible:outline-secondary"
                                            >
                                                <HugeiconsIcon
                                                    icon={CheckmarkCircle01Icon}
                                                    size={18}
                                                />
                                            </button>

                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium">
                                                    {task.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {task.course}
                                                </p>
                                            </div>

                                            <time
                                                dateTime={task.dueDate}
                                                className="shrink-0 text-xs font-medium"
                                            >
                                                {new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(undefined, {
                                                    month: "short",
                                                    day: "numeric",
                                                })}
                                            </time>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </section>
                    </div>

                    <section
                        id="planner"
                        className="min-w-0 scroll-mt-5"
                    >
                        <SectionHeading
                            eyebrow="Your schedule"
                            title="Planner / calendar"
                        />

                        <StudyCalendar/>
                    </section>
                </div>
            </div>
        </main>
    );
}
