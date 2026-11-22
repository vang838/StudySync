"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

type SavedCourse = {
    course_id: string;
    title: string;
};

type StudyDeadline = {
    id: string;
    courseId: string;
    title: string;
    type: "assignment" | "exam";
    dueDate: string;
};

type StudySession = {
    id: string;
    date: string;
    day: string;
    courseId: string;
    courseTitle: string;
    hours: number;
    task: string;
};

const STUDY_PLANNER_STORAGE_KEY = "studysync_study_planner";

export default function StudyPlannerPage() {
    const [courses, setCourses] = useState<SavedCourse[]>([]);
    const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
    const [coursesLoading, setCoursesLoading] = useState(true);
    const [coursesError, setCoursesError] = useState("");
    const [deadlines, setDeadlines] = useState<StudyDeadline[]>([]);
    const [deadlineCourseId, setDeadlineCourseId] = useState("");
    const [deadlineTitle, setDeadlineTitle] = useState("");
    const [deadlineType, setDeadlineType] = useState<"assignment" | "exam">("assignment");
    const [deadlineDate, setDeadlineDate] = useState("");
    const [deadlineError, setDeadlineError] = useState("");
    const [studyDays, setStudyDays] = useState<string[]>([]);
    const [studyHoursPerDay, setStudyHoursPerDay] = useState(2);
    const [studyGoal, setStudyGoal] = useState("");
    const [coursePriorities, setCoursePriorities] = useState<
        Record<string, "low" | "medium" | "high">
    >({});
    const [formError, setFormError] = useState("");
    const [studySchedule, setStudySchedule] = useState<StudySession[]>([]);
    const [plannerLoaded, setPlannerLoaded] = useState(false);


    useEffect(() => {
        try {
            const storedUser = localStorage.getItem("studysync_user");
            const user = storedUser ? JSON.parse(storedUser) : null;
            const userId = Number(user?.user_id);

            if (!Number.isInteger(userId) || userId <= 0) {
                return;
            }

            const storageKey = `${STUDY_PLANNER_STORAGE_KEY}_${userId}`;
            const savedPlanner = localStorage.getItem(storageKey);

            if (savedPlanner) {
                const data = JSON.parse(savedPlanner);

                queueMicrotask(() => {
                    setSelectedCourses(data.selectedCourses ?? []);
                    setDeadlines(data.deadlines ?? []);
                    setStudyDays(data.studyDays ?? []);
                    setStudyHoursPerDay(data.studyHoursPerDay ?? 2);
                    setStudyGoal(data.studyGoal ?? "");
                    setCoursePriorities(data.coursePriorities ?? {});
                    setStudySchedule(data.studySchedule ?? []);
                });
            }
        } catch (error) {
            console.error("Failed to load study planner:", error);
        } finally {
            queueMicrotask(() => {
                setPlannerLoaded(true);
            });
        }
    }, []);


    useEffect(() => {
        if (!plannerLoaded) {
            return;
        }

        try {
            const storedUser = localStorage.getItem("studysync_user");
            const user = storedUser ? JSON.parse(storedUser) : null;
            const userId = Number(user?.user_id);

            if (!Number.isInteger(userId) || userId <= 0) {
                return;
            }

            const storageKey = `${STUDY_PLANNER_STORAGE_KEY}_${userId}`;

            const plannerData = {
                selectedCourses,
                deadlines,
                studyDays,
                studyHoursPerDay,
                studyGoal,
                coursePriorities,
                studySchedule,
            };

            localStorage.setItem(storageKey, JSON.stringify(plannerData));
        } catch (error) {
            console.error("Failed to save study planner:", error);
        }
    }, [
        plannerLoaded,
        selectedCourses,
        deadlines,
        studyDays,
        studyHoursPerDay,
        studyGoal,
        coursePriorities,
        studySchedule,
    ]);

    function generateStudySchedule() {
        if (!validateQuestionnaire()) {
            setStudySchedule([]);
            return;
        }

        const today = new Date();
        const schedule: StudySession[] = [];
        const MIN_SESSION_MINUTES = 30;

        const priorityWeights = {
            high: 3,
            medium: 2,
            low: 1,
        };

        function getDeadlineWeights(referenceDate: Date) {
            const weights: Record<string, number> = {};

            const referenceStart = new Date(referenceDate);
            referenceStart.setHours(0, 0, 0, 0);

            deadlines.forEach((deadline) => {
                if (!selectedCourses.includes(deadline.courseId)) {
                    return;
                }

                const dueDate = new Date(`${deadline.dueDate}T00:00:00`);

                const daysUntilDue = Math.round(
                    (dueDate.getTime() - referenceStart.getTime()) / 86400000
                );

                if (daysUntilDue >= 0 && daysUntilDue <= 7) {
                    weights[deadline.courseId] =
                        (weights[deadline.courseId] ?? 0) +
                        (deadline.type === "exam" ? 3 : 2);
                }
            });

            return weights;
        }

        const dayNames = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ];

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);

            const day = dayNames[date.getDay()];

            if (!studyDays.includes(day)) {
                continue;
            }

            const deadlineWeights = getDeadlineWeights(date);
            const selectedCourseList = courses
                .filter((course) => selectedCourses.includes(course.course_id))
                .flatMap((course) => {
                    const priority = coursePriorities[course.course_id] ?? "medium";
                    const weight = priorityWeights[priority] + (deadlineWeights[course.course_id] ?? 0);

                    return Array.from({ length: weight }, () => course);
                });

            const dateString = [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, "0"),
                String(date.getDate()).padStart(2, "0"),
            ].join("-");


            const uniqueCourses = courses.filter((course) =>
                selectedCourses.includes(course.course_id)
            );

            const maxCoursesPerDay = Math.floor(
                (studyHoursPerDay * 60) / MIN_SESSION_MINUTES
            );

            const eligibleCourses = [...uniqueCourses]
                .sort((a, b) => {
                    const weightA = selectedCourseList.filter(
                        (item) => item.course_id === a.course_id
                    ).length;

                    const weightB = selectedCourseList.filter(
                        (item) => item.course_id === b.course_id
                    ).length;

                    return weightB - weightA;
                })
                .slice(0, maxCoursesPerDay);

            const totalWeight = eligibleCourses.reduce((total, course) => {
                const weight = selectedCourseList.filter(
                    (item) => item.course_id === course.course_id
                ).length;

                return total + weight;
            }, 0);


            const totalMinutes = Math.round(studyHoursPerDay * 60);

            const remainingMinutes =
                totalMinutes - eligibleCourses.length * MIN_SESSION_MINUTES;

            const courseAllocations = eligibleCourses.map((course) => {
                const weight = selectedCourseList.filter(
                    (item) => item.course_id === course.course_id
                ).length;

                return {
                    course,
                    weight,
                    minutes:
                        MIN_SESSION_MINUTES +
                        Math.floor((remainingMinutes * weight) / totalWeight),
                };
            });

            const allocatedMinutes = courseAllocations.reduce(
                (sum, item) => sum + item.minutes,
                0
            );

            if (courseAllocations.length > 0) {
                courseAllocations[0].minutes += totalMinutes - allocatedMinutes;
            }

            courseAllocations.forEach(({ course, minutes }) => {
                if (minutes <= 0) {
                    return;
                }

                schedule.push({
                    id: crypto.randomUUID(),
                    date: dateString,
                    day,
                    courseId: course.course_id,
                    courseTitle: course.title,
                    hours: minutes / 60,
                    task: (() => {
                        const upcomingDeadline = deadlines
                            .filter((deadline) => {
                                if (deadline.courseId !== course.course_id) {
                                    return false;
                                }

                                const dueDate = new Date(`${deadline.dueDate}T00:00:00`);
                                const studyDate = new Date(`${dateString}T00:00:00`);

                                return dueDate >= studyDate;
                            })
                            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

                        if (upcomingDeadline) {
                            return upcomingDeadline.type === "exam"
                                ? `Prepare for ${upcomingDeadline.title}`
                                : `Work on ${upcomingDeadline.title}`;
                        }

                        return `Review course materials and practice key concepts. Goal: ${studyGoal.trim()}`;
                    })(),
                });
            });

        }

        setStudySchedule(schedule);
    }
    function validateQuestionnaire(): boolean {
        if (selectedCourses.length === 0) {
            setFormError("Please select at least one course.");
            return false;
        }

        if (studyDays.length === 0) {
            setFormError("Please select at least one study day.");
            return false;
        }

        if (
            !Number.isFinite(studyHoursPerDay) ||
            studyHoursPerDay < 0.5 ||
            studyHoursPerDay > 12
        ) {
            setFormError("Study hours must be between 0.5 and 12.");
            return false;
        }

        if (!studyGoal.trim()) {
            setFormError("Please enter your main study goal.");
            return false;
        }

        setFormError("");
        return true;
    }


    function addDeadline() {
        if (!deadlineCourseId || !deadlineTitle.trim() || !deadlineDate) {
            setDeadlineError("Please complete all deadline fields.");
            return;
        }

        if (!selectedCourses.includes(deadlineCourseId)) {
            setDeadlineError("Please select the course in Section 1 first.");
            return;
        }

        const newDeadline: StudyDeadline = {
            id: crypto.randomUUID(),
            courseId: deadlineCourseId,
            title: deadlineTitle.trim(),
            type: deadlineType,
            dueDate: deadlineDate,
        };

        setDeadlines((previous) => [...previous, newDeadline]);

        setDeadlineCourseId("");
        setDeadlineTitle("");
        setDeadlineType("assignment");
        setDeadlineDate("");
        setDeadlineError("");
    }


    useEffect(() => {
        async function loadSavedCourses() {
            try {
                const storedUser = localStorage.getItem("studysync_user");
                const user = storedUser ? JSON.parse(storedUser) : null;
                const userId = Number(user?.user_id);

                if (!Number.isInteger(userId) || userId <= 0) {
                    throw new Error("Invalid user ID.");
                }

                const response = await fetch(
                    `/api/courses/saved?user_id=${userId}`
                );

                if (!response.ok) {
                    throw new Error("Failed to load saved courses.");
                }

                const data = (await response.json()) as SavedCourse[];

                if (!Array.isArray(data)) {
                    throw new Error("Invalid course data.");
                }

                setCourses(data);
            } catch (error) {
                console.error(error);
                setCoursesError("Unable to load your saved courses.");
            } finally {
                setCoursesLoading(false);
            }
        }

        loadSavedCourses();
    }, []);
    return (
        <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-8 text-foreground md:px-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-12">
                <header className="space-y-3">
                    <Link
                        href="/dashboard"
                        className="inline-flex text-sm text-muted-foreground transition hover:text-secondary"
                    >
                        ← Back to Dashboard
                    </Link>

                    <h1 className="text-3xl font-bold">
                        Study Planner
                    </h1>

                    <p className="text-muted-foreground">
                        Tell us about your courses, deadlines, and study goals
                        to create a personalized study schedule.
                    </p>
                </header>

                <Card>
                    <CardHeader>
                        <CardTitle>Study Planner Questionnaire</CardTitle>
                    </CardHeader>


                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold">
                                    1. Select Your Courses
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Choose the courses you want to include in your study plan.
                                </p>
                            </div>

                            {coursesLoading ? (
                                <p className="text-sm text-muted-foreground">
                                    Loading your courses...
                                </p>
                            ) : coursesError ? (
                                <p role="alert" className="text-sm text-red-500">
                                    {coursesError}
                                </p>
                            ) : courses.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No saved courses found. Please save a course first.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {courses.map((course) => (
                                        <label
                                            key={course.course_id}
                                            className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedCourses.includes(course.course_id)}
                                                onChange={(event) => {
                                                    if (event.target.checked) {
                                                        setSelectedCourses((previous) => [
                                                            ...previous,
                                                            course.course_id,
                                                        ]);
                                                    } else {
                                                        setSelectedCourses((previous) =>
                                                            previous.filter(
                                                                (id) => id !== course.course_id
                                                            )
                                                        );
                                                    }
                                                }}
                                                className="h-4 w-4 accent-primary"
                                            />
                                            <span className="text-sm font-medium">
                                                {course.title}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>

                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>2. Deadlines & Exams</CardTitle>
                    </CardHeader>

                    <CardContent>
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Add upcoming assignments, projects, and exams.
                            </p>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label htmlFor="deadline-course" className="text-sm font-medium">
                                        Course
                                    </label>
                                    <select
                                        id="deadline-course"
                                        value={deadlineCourseId}
                                        onChange={(event) => setDeadlineCourseId(event.target.value)}
                                        className="w-full rounded-md border bg-background p-2 text-sm"
                                    >
                                        <option value="">Select a course</option>
                                        {courses
                                            .filter((course) => selectedCourses.includes(course.course_id))
                                            .map((course) => (
                                                <option key={course.course_id} value={course.course_id}>
                                                    {course.title}
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="deadline-type" className="text-sm font-medium">
                                        Type
                                    </label>
                                    <select
                                        id="deadline-type"
                                        value={deadlineType}
                                        onChange={(event) =>
                                            setDeadlineType(event.target.value as "assignment" | "exam")
                                        }
                                        className="w-full rounded-md border bg-background p-2 text-sm"
                                    >
                                        <option value="assignment">Assignment / Project</option>
                                        <option value="exam">Exam</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="deadline-title" className="text-sm font-medium">
                                        Title
                                    </label>
                                    <input
                                        id="deadline-title"
                                        type="text"
                                        value={deadlineTitle}
                                        onChange={(event) => setDeadlineTitle(event.target.value)}
                                        placeholder="e.g. Final Exam"
                                        className="w-full rounded-md border bg-background p-2 text-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="deadline-date" className="text-sm font-medium">
                                        Due Date
                                    </label>
                                    <input
                                        id="deadline-date"
                                        type="date"
                                        value={deadlineDate}
                                        onChange={(event) => setDeadlineDate(event.target.value)}
                                        className="w-full rounded-md border bg-background p-2 text-sm"
                                    />
                                </div>
                            </div>

                            {deadlineError && (
                                <p role="alert" className="text-sm text-red-500">
                                    {deadlineError}
                                </p>
                            )}

                            <button
                                type="button"
                                onClick={addDeadline}
                                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                            >
                                Add Deadline
                            </button>

                            {deadlines.length > 0 && (
                                <div className="space-y-3 border-t pt-4">
                                    <h3 className="text-sm font-semibold">
                                        Added Deadlines & Exams
                                    </h3>

                                    {deadlines.map((deadline) => (
                                        <div
                                            key={deadline.id}
                                            className="flex items-center justify-between gap-4 rounded-lg border p-3"
                                        >
                                            <div className="space-y-1">
                                                <p className="font-medium">{deadline.title}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {courses.find(
                                                        (course) => course.course_id === deadline.courseId
                                                    )?.title ?? "Unknown Course"}
                                                    {" • "}
                                                    {deadline.type === "exam" ? "Exam" : "Assignment"}
                                                    {" • "}
                                                    {deadline.dueDate}
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setDeadlines((previous) =>
                                                        previous.filter((item) => item.id !== deadline.id)
                                                    )
                                                }
                                                className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>3. Available Study Time</CardTitle>
                    </CardHeader>

                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-medium">
                                    Which days are you available to study?
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Select all days that work for you.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                {[
                                    "Monday",
                                    "Tuesday",
                                    "Wednesday",
                                    "Thursday",
                                    "Friday",
                                    "Saturday",
                                    "Sunday",
                                ].map((day) => (
                                    <label
                                        key={day}
                                        className="flex cursor-pointer items-center gap-2 rounded-lg border p-3"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={studyDays.includes(day)}
                                            onChange={(event) => {
                                                if (event.target.checked) {
                                                    setStudyDays((previous) => [...previous, day]);
                                                } else {
                                                    setStudyDays((previous) =>
                                                        previous.filter((item) => item !== day)
                                                    );
                                                }
                                            }}
                                            className="h-4 w-4 accent-primary"
                                        />
                                        <span className="text-sm">{day}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <label
                                    htmlFor="study-hours"
                                    className="text-sm font-medium"
                                >
                                    How many hours can you study per day?
                                </label>

                                <input
                                    id="study-hours"
                                    type="number"
                                    min={0.5}
                                    max={12}
                                    step={0.5}
                                    value={studyHoursPerDay}
                                    onChange={(event) =>
                                        setStudyHoursPerDay(Number(event.target.value))
                                    }
                                    className="w-full max-w-xs rounded-md border bg-background p-2 text-sm"
                                />

                                <p className="text-sm text-muted-foreground">
                                    Enter your available study hours for each selected day.
                                </p>
                            </div>

                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>4. Study Goals & Priorities</CardTitle>
                    </CardHeader>

                    <CardContent>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label
                                    htmlFor="study-goal"
                                    className="text-sm font-medium"
                                >
                                    What is your main study goal?
                                </label>

                                <textarea
                                    id="study-goal"
                                    value={studyGoal}
                                    onChange={(event) => setStudyGoal(event.target.value)}
                                    placeholder="e.g. Prepare for final exams and improve my grades."
                                    rows={3}
                                    className="w-full rounded-md border bg-background p-3 text-sm"
                                />

                                <p className="text-sm text-muted-foreground">
                                    Describe what you want to achieve with your study plan.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <h3 className="text-sm font-medium">
                                        Course Priorities
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Set the priority level for each selected course.
                                    </p>
                                </div>

                                {selectedCourses.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        Please select your courses in Section 1 first.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {courses
                                            .filter((course) => selectedCourses.includes(course.course_id))
                                            .map((course) => (
                                                <div
                                                    key={course.course_id}
                                                    className="flex items-center justify-between gap-4 rounded-lg border p-3"
                                                >
                                                    <span className="text-sm font-medium">
                                                        {course.title}
                                                    </span>

                                                    <select
                                                        value={coursePriorities[course.course_id] ?? "medium"}
                                                        onChange={(event) =>
                                                            setCoursePriorities((previous) => ({
                                                                ...previous,
                                                                [course.course_id]: event.target.value as
                                                                    | "low"
                                                                    | "medium"
                                                                    | "high",
                                                            }))
                                                        }
                                                        aria-label={`Priority for ${course.title}`}
                                                        className="rounded-md border bg-background p-2 text-sm"
                                                    >
                                                        <option value="low">Low</option>
                                                        <option value="medium">Medium</option>
                                                        <option value="high">High</option>
                                                    </select>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>

                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    {formError && (
                        <p role="alert" className="text-sm text-red-500">
                            {formError}
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={generateStudySchedule}
                        className="w-full rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
                    >
                        Generate Study Schedule
                    </button>
                </div>

                {studySchedule.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Generated Study Schedule</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Total Study Time:{" "}
                                {Math.round(
                                    studySchedule.reduce((total, session) => total + session.hours, 0) * 60
                                )}{" "}
                                minutes across{" "}
                                {new Set(studySchedule.map((session) => session.date)).size} study days
                            </p>
                        </CardHeader>

                        <CardContent>
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    Your personalized study schedule for the next 7 days.
                                </p>


                                {[...new Set(studySchedule.map((session) => session.date))].map(
                                    (date) => {
                                        const dailySessions = studySchedule.filter(
                                            (session) => session.date === date
                                        );

                                        const totalMinutes = Math.round(
                                            dailySessions.reduce(
                                                (total, session) => total + session.hours,
                                                0
                                            ) * 60
                                        );

                                        return (
                                            <div key={date} className="rounded-lg border p-4">
                                                <div className="flex items-center justify-between gap-4">
                                                    <h3 className="font-semibold">
                                                        {dailySessions[0].day}, {date}
                                                    </h3>

                                                    <span className="text-sm text-muted-foreground">
                                                        {totalMinutes} minutes total
                                                    </span>
                                                </div>

                                                <div className="mt-3 space-y-3">
                                                    {dailySessions.map((session) => (
                                                        <div
                                                            key={session.id}
                                                            className="rounded-md border p-3"
                                                        >
                                                            <div className="flex items-center justify-between gap-4">
                                                                <p className="text-sm font-medium">
                                                                    {session.courseTitle}
                                                                </p>

                                                                <span className="text-sm text-muted-foreground">
                                                                    {Math.round(session.hours * 60)} minutes
                                                                </span>
                                                            </div>

                                                            <p className="mt-1 text-sm text-muted-foreground">
                                                                {session.task}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }
                                )}

                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </main>
    );
}
