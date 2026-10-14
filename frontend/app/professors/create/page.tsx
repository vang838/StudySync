"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import { Separator } from "@/components/ui/separator";

type Course = 
{
    course_id: string;
    title: string;
    professor: string | null;
};

function CreateProfessorReviewForm()
{
    const searchParams = useSearchParams();
    const professorName = searchParams.get("professor")?.trim() ?? "";
    const [professorCourses, setProfessorCourses] = useState<Course[]>([]);
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [courseError, setCourseError] = useState<string | null>(null);

    const [selectedCourseId, setSelectedCourseId] = useState("");
    const [newRating, setNewRating] = useState("5");
    const [feedback, setFeedback] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);
    const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
    const visibleCourseError =
        courseError ??
        (!professorName
            ? "No professor was selected. Open this form from a professor's reviews."
            : null);

    useEffect(() => {
        if (!professorName) {
            return;
        }

        const controller = new AbortController();
        async function loadCourses() {
            setLoadingCourses(true);
            setCourseError(null);
            setProfessorCourses([]);
            setSelectedCourseId("");
            try {
                const url = new URL("/api/courses/search", window.location.origin);
                url.searchParams.set("professor", professorName);
                const response = await fetch(url.toString(), {
                    signal: controller.signal,
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data: Course[] = await response.json();
                const matchingCourses = data.filter(
                    (course) =>
                        course.professor?.trim().toLocaleLowerCase() ===
                        professorName.toLocaleLowerCase()
                );
                setProfessorCourses(matchingCourses);
                setSelectedCourseId(matchingCourses[0]?.course_id ?? "");
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }
                console.error("Failed to load professor courses:", err);
                setCourseError("Could not load courses for this professor.");
            } finally {
                if (!controller.signal.aborted) {
                    setLoadingCourses(false);
                }
            }
        }

        void loadCourses();
        return () => controller.abort();
    }, [professorName]);

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSubmissionError(null);
        setSubmissionMessage(null);

        const storedUserId = localStorage.getItem("user_id");
        const userId = Number(storedUserId);
        if (!storedUserId || !Number.isInteger(userId) || userId <= 0) {
            setSubmissionError("Sign in to submit a professor review.");
            return;
        }
        if (!selectedCourseId) {
            setSubmissionError("Select one of this professor's courses.");
            return;
        }

        setSubmitting(true);
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch("/api/professor_reviews", {
                method: "POST",
                headers: { "content-type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                    professor: professorName,
                    course_id: selectedCourseId,
                    user_id: userId,
                    rating: Number(newRating),
                    feedback: feedback.trim(),
                }),
            });

            if (!response.ok) {
                const responseBody = await response.json().catch(() => ({}));
                throw new Error(
                    responseBody?.detail ?? `Could not submit review (HTTP ${response.status})`
                );
            }

            setFeedback("");
            setSubmissionMessage("Your review has been submitted.");
        } catch (err) {
            console.error("Failed to submit professor review:", err);
            setSubmissionError(
                err instanceof Error && err.name === "AbortError"
                    ? "Submitting the review timed out. Please try again."
                    : err instanceof Error
                      ? err.message
                      : "Could not submit your review. Please try again."
            );
        } finally {
            window.clearTimeout(timeoutId);
            setSubmitting(false);
        }
    };

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">StudySync Courses</p>
            <h1 className="font-heading text-3xl font-bold">Write a Professor Review</h1>
          </div>
          <Link
            href={
                professorName
                    ? `/professors/${encodeURIComponent(professorName)}`
                    : "/professors"
            }
          >
            <Button variant="secondary" size="s">Back to Reviews</Button>
          </Link>
        </header>

        <Separator />

        <Card>
            <CardHeader>
                <CardTitle>Write a Review</CardTitle>
                <CardDescription>
                {professorName
                    ? `Share your experience with ${professorName}.`
                    : "Choose a professor from the professor search to get started."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form className="grid gap-4" onSubmit={onSubmit}>
                    <div className="grid gap-2">
                        <label htmlFor="review-course" className="text-sm font-medium">
                            Course
                        </label>
                        <select
                            id="review-course"
                            required
                            value={selectedCourseId}
                            onChange={(event) => setSelectedCourseId(event.target.value)}
                            disabled={loadingCourses || professorCourses.length === 0}
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                            <option value="" disabled>
                                Select a course
                            </option>
                            {professorCourses.map((course) => (
                                <option key={course.course_id} value={course.course_id}>
                                    {course.course_id} — {course.title}
                                </option>
                            ))}
                        </select>
                        {professorName && loadingCourses && (
                            <p className="text-sm text-muted-foreground">
                                Loading courses for {professorName}...
                            </p>
                        )}
                        {visibleCourseError && (
                            <p className="text-sm text-destructive">{visibleCourseError}</p>
                        )}
                        {professorName && !loadingCourses && !visibleCourseError && professorCourses.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                No courses were found for this professor.
                            </p>
                        )}
                    </div>
                    <div className="grid gap-2">
                        <label htmlFor="review-rating" className="text-sm font-medium">
                            Rating
                        </label>
                        <select
                            id="review-rating"
                            value={newRating}
                            onChange={(event) => setNewRating(event.target.value)}
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                            {[5, 4, 3, 2, 1].map((rating) => (
                                <option key={rating} value={rating}>
                                    {rating} {rating === 1 ? "star" : "stars"}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid gap-2">
                        <label htmlFor="review-feedback" className="text-sm font-medium">
                            Review
                        </label>
                        <textarea
                            id="review-feedback"
                            required
                            minLength={1}
                            maxLength={4000}
                            rows={4}
                            value={feedback}
                            onChange={(event) => setFeedback(event.target.value)}
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                            placeholder="Write about your experience..."
                        />
                    </div>
                    {submissionError && (
                        <p className="text-sm font-medium text-destructive">
                            {submissionError}
                        </p>
                    )}
                    {submissionMessage && (
                        <p className="text-sm text-muted-foreground">
                            {submissionMessage}
                        </p>
                    )}
                    <div>
                        <Button
                            type="submit"
                            disabled={
                                submitting ||
                                loadingCourses ||
                                !professorName ||
                                professorCourses.length === 0 ||
                                feedback.trim().length === 0
                            }
                        >
                            {submitting ? "Submitting..." : "Submit Review"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function CreateProfessorReviewPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading review form...</p>}>
      <CreateProfessorReviewForm />
    </Suspense>
  );
}
