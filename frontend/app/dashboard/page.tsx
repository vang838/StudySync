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
    professor: string;
    is_archived: boolean;
};


type UploadedDocument = {
    document_id: string;
    version_id: string;
    course_id: string;
    title: string;
    original_filename: string;
    file_size_bytes: number;
    created_at: string;
    is_published: boolean;
};

const quickActions = [
    {
        title: "My Courses",
        description: "Continue learning",
        href: "#courses",
        icon: BookOpen01Icon,
    },
    {
        title: "Recent Uploads",
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
        title: "Study Tasks",
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
    const [passwordNeedsUpdate, setPasswordNeedsUpdate] = useState(false);
    const [showPasswordBanner, setShowPasswordBanner] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const upcomingTasks = tasks
        .filter((task) => !task.completed)
        .sort((first, second) => first.dueDate.localeCompare(second.dueDate))
        .slice(0, 5);


    const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
    const [coursesLoading, setCoursesLoading] = useState(true);
    const [coursesError, setCoursesError] = useState("");


    const [uploads, setUploads] = useState<UploadedDocument[]>([]);
    const [uploadsLoading, setUploadsLoading] = useState(true);
    const [uploadsError, setUploadsError] = useState("");

    useEffect(() => {
        async function loadUploads() {
            try {
                const response = await fetch(
                    "/api/documents?published_only=false",
                    {cache: "no-store"}
                );

                if (!response.ok) {
                    throw new Error("Unable to load uploads.");
                }

                const data: UploadedDocument[] = await response.json();

                setUploads(data);

            } catch (error) {
                setUploadsError(
                    error instanceof Error
                        ? error.message
                        : "Something went wrong."
                );
            } finally {
                setUploadsLoading(false);
            }
        }

        loadUploads();
    }, []);


    useEffect(() => {
        async function loadCourses() {
            try {
                const userId = localStorage.getItem("user_id");

                if (!userId) {
                    throw new Error("Please sign in.");
                }

                const response = await fetch(
                    `/api/courses/saved?user_id=${encodeURIComponent(userId)}`,
                    {cache: "no-store"}
                );

                if (!response.ok) {
                    throw new Error("Unable to retrieve saved courses.");
                }

                const data: SavedCourse[] = await response.json();

                setSavedCourses(data);

            } catch (error) {
                setCoursesError(
                    error instanceof Error
                        ? error.message
                        : "Something went wrong."
                );
            } finally {
                setCoursesLoading(false);
            }
        }

        loadCourses();
    }, []);


    useEffect(() => {
        const userId = localStorage.getItem("user_id");
        const isAuthenticated = localStorage.getItem("auth_session") === "authenticated";
        if (!userId || !isAuthenticated) {
            return;
        }
        fetch(`/api/users/${encodeURIComponent(userId)}`, {cache: "no-store"})
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Unable to load account security status.");
                }
                return response.json() as Promise<{ password_needs_update?: boolean }>;
            })
            .then((user) => {
                setCurrentUserId(userId);
                setPasswordNeedsUpdate(user.password_needs_update === true);
            })
            .catch((error) => {
                console.error("Unable to load account security status.", error);
            });
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

                {passwordNeedsUpdate && showPasswordBanner && (
                    <div
                        className="relative rounded-md border border-amber-300 bg-amber-50 px-4 py-3 pr-10 text-sm text-amber-950">
                        <button
                            type="button"
                            onClick={() => setShowPasswordBanner(false)}
                            className="absolute right-3 top-2 text-lg leading-none text-amber-800"
                            aria-label="Dismiss password reminder"
                        >
                            ×
                        </button>
                        <p className="font-semibold">Your password needs an update.</p>
                        <p className="mt-1">
                            Please choose a stronger password with an uppercase letter and special character.{" "}
                            <Link className="font-semibold underline" href={`/users/${currentUserId}/settings`}>
                                Update your password
                            </Link>
                        </p>
                    </div>
                )}

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
                                value: coursesLoading
                                    ? "..."
                                    : coursesError
                                        ? "N/A"
                                        : String(savedCourses.length),
                                icon: BookOpen01Icon,
                            },
                            {
                                label: "Recent uploads",
                                value: uploadsLoading
                                    ? "..."
                                    : uploadsError
                                        ? "N/A"
                                        : String(new Set(uploads.map(upload => upload.document_id)).size),
                                icon: FileTextIcon,
                            },

                            {
                                label: "Average progress",
                                value: "N/A",
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
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <SectionHeading
                                    eyebrow="Learn together"
                                    title="My Courses & Collaboration"
                                />

                                <Link
                                    href="/courses/course_search"
                                    className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:opacity-90"
                                >
                                    Browse Courses
                                </Link>
                            </div>

                            <p className="mb-4 text-sm text-muted-foreground">
                                Access your courses, explore shared materials,
                                and collaborate with classmates.
                            </p>

                            {coursesLoading && (
                                <p>Loading your courses...</p>
                            )}

                            {coursesError && (
                                <p className="text-red-500">{coursesError}</p>
                            )}

                            {!coursesLoading && !coursesError && savedCourses.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    You have not saved any courses yet.
                                    Browse the course catalog to get started.
                                </p>
                            )}

                            <div className="grid gap-4 md:grid-cols-2">
                                {savedCourses.map((course) => {
                                    const courseUrl =
                                        `/courses/${encodeURIComponent(course.course_id)}`;

                                    return (
                                        <Card key={course.course_id} className="gap-3">
                                            <CardHeader>
                                                <p className="text-xs font-semibold text-secondary">
                                                    {course.course_id}
                                                </p>

                                                <CardTitle className="text-base">
                                                    {course.title}
                                                </CardTitle>

                                                <p className="text-xs text-muted-foreground">
                                                    {course.professor || "Professor not listed"}
                                                </p>
                                            </CardHeader>

                                            <CardContent className="space-y-3">
                                                <p className="text-xs text-muted-foreground">
                                                    Connect with classmates, join discussions,
                                                    and explore course materials.
                                                </p>

                                                <div className="flex flex-col gap-2">
                                                    <Link
                                                        href={`${courseUrl}#course-discussions`}
                                                        className="rounded-md bg-secondary px-3 py-2 text-center text-sm font-medium text-secondary-foreground hover:opacity-90"
                                                    >
                                                        Course Discussions
                                                    </Link>

                                                    <div className="grid grid-cols-2 gap-2">
                                                        <Link
                                                            href={`${courseUrl}#course-materials`}
                                                            className="rounded-md border border-foreground/10 px-3 py-2 text-center text-xs hover:bg-muted"
                                                        >
                                                            Materials
                                                        </Link>

                                                        <Link
                                                            href={`${courseUrl}#course-members`}
                                                            className="rounded-md border border-foreground/10 px-3 py-2 text-center text-xs hover:bg-muted"
                                                        >
                                                            Classmates
                                                        </Link>
                                                    </div>

                                                    <Link
                                                        href={courseUrl}
                                                        className="text-center text-xs text-muted-foreground hover:underline"
                                                    >
                                                        View Course Overview
                                                    </Link>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </section>


                        <section id="uploads" className="scroll-mt-5">
                            <SectionHeading
                                eyebrow="Your materials"
                                title="Recent uploads"
                            />

                            <Card className="gap-0">
                                <CardContent className="divide-y divide-foreground/10">

                                    {uploadsLoading && (
                                        <p>Loading uploads...</p>
                                    )}

                                    {uploadsError && (
                                        <p className="text-red-500">{uploadsError}</p>
                                    )}

                                    {!uploadsLoading && !uploadsError && uploads.length === 0 && (
                                        <p className="text-sm text-muted-foreground">
                                            No documents uploaded yet.
                                        </p>
                                    )}

                                    {[...uploads]
                                        .sort((a, b) =>
                                            new Date(b.created_at).getTime() -
                                            new Date(a.created_at).getTime()
                                        )
                                        .filter((upload, index, all) =>
                                            all.findIndex(item =>
                                                item.document_id === upload.document_id
                                            ) === index
                                        )
                                        .slice(0, 5)
                                        .map((upload) => (
                                            <div
                                                key={upload.document_id}
                                                className="flex items-center gap-3 py-3"
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
                                                        {upload.original_filename}
                                                    </p>

                                                    <p className="text-xs text-muted-foreground">
                                                        {upload.course_id}
                                                    </p>
                                                </div>

                                                <time className="text-xs text-muted-foreground">
                                                    {new Date(upload.created_at).toLocaleDateString(undefined, {
                                                        month: "short",
                                                        day: "numeric",
                                                    })}
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
    )
        ;
}
