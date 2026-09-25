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
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

const courses = [
    {code: "BIO 201", name: "Human Biology", progress: 72},
    {
        code: "MATH 240",
        name: "Statistics & Probability",
        progress: 48,
    },
    {code: "HIST 108", name: "World History", progress: 85},
];

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

const tasks = [
    {
        title: "Review cell structure",
        course: "Human Biology",
        due: "Sep 25",
    },
    {
        title: "Practice probability problems",
        course: "Statistics & Probability",
        due: "Sep 27",
    },
    {
        title: "Summarize lecture notes",
        course: "World History",
        due: "Sep 29",
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

const week = [
    {day: "Mon", date: 21, activity: ""},
    {day: "Tue", date: 22, activity: "Notes uploaded"},
    {day: "Wed", date: 23, activity: ""},
    {day: "Thu", date: 24, activity: ""},
    {day: "Fri", date: 25, activity: "Biology review"},
    {day: "Sat", date: 26, activity: ""},
    {day: "Sun", date: 27, activity: "Math practice"},
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
    const averageProgress = Math.round(
        courses.reduce(
            (total, course) => total + course.progress,
            0
        ) / courses.length
    );

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
                                value: String(courses.length),
                                icon: BookOpen01Icon,
                            },
                            {
                                label: "Recent uploads",
                                value: String(uploads.length),
                                icon: FileTextIcon,
                            },
                            {
                                label: "Average progress",
                                value: averageProgress + "%",
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
                                {courses.map((course) => (
                                    <Card
                                        key={course.code}
                                        size="sm"
                                        className="gap-0"
                                    >
                                        <CardHeader>
                                            <p className="text-xs font-semibold text-secondary">
                                                {course.code}
                                            </p>
                                            <CardTitle className="text-sm">
                                                {course.name}
                                            </CardTitle>
                                        </CardHeader>

                                        <CardContent>
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Sample progress</span>
                                                <span>{course.progress}%</span>
                                            </div>

                                            <div
                                                className="mt-2 h-2 overflow-hidden rounded-full bg-background"
                                                role="progressbar"
                                                aria-label={
                                                    course.name + " progress"
                                                }
                                                aria-valuenow={course.progress}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                            >
                                                <div
                                                    className="h-full rounded-full bg-secondary"
                                                    style={{
                                                        width: course.progress + "%",
                                                    }}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
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
                                    {tasks.map((task) => (
                                        <div
                                            key={task.title}
                                            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                                        >
                      <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-secondary">
                        <HugeiconsIcon
                            icon={CheckmarkCircle01Icon}
                            size={18}
                        />
                      </span>

                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium">
                                                    {task.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {task.course}
                                                </p>
                                            </div>

                                            <span className="shrink-0 text-xs font-medium">
                        {task.due}
                      </span>
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

                        <Card>
                            <CardHeader>
                                <CardTitle>Sep 21–27, 2026</CardTitle>
                                <CardDescription>
                                    Sample week
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="overflow-x-auto">
                                <div className="grid min-w-[260px] grid-cols-7 gap-1 text-center">
                                    {week.map((day) => (
                                        <div
                                            key={day.day}
                                            className="flex flex-col items-center gap-2"
                                        >
                      <span className="text-xs text-muted-foreground">
                        {day.day}
                      </span>
                                            <span
                                                className={
                                                    "flex size-8 items-center justify-center rounded-full text-xs font-medium " +
                                                    (day.activity
                                                        ? "bg-secondary text-secondary-foreground"
                                                        : "bg-background")
                                                }
                                            >
                        {day.date}
                      </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-5 space-y-2 border-t border-foreground/10 pt-4">
                                    {week
                                        .filter((day) => day.activity)
                                        .map((day) => (
                                            <p
                                                key={day.date}
                                                className="flex justify-between gap-3 text-xs"
                                            >
                                                <span>{day.activity}</span>
                                                <span className="text-muted-foreground">
                          Sep {day.date}
                        </span>
                                            </p>
                                        ))}
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </div>
        </main>
    );
}