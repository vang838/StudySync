"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type ProfessorReview = {
    review_id: number;
    professor: string;
    course_id: string;
    rating: number;
    feedback: string;
    created_at: string;
};

export default function ProfessorReviewsPage() {
    const params = useParams<{ professor: string }>();

    const professorName = decodeURIComponent(params.professor);

    const [reviews, setReviews] = useState<ProfessorReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [ratingFilter, setRatingFilter] = useState("all");
    const [courseFilter, setCourseFilter] = useState("all");

    useEffect(() => {
        async function loadReviews() {
            setLoading(true);
            setError(null);

            try {
                const apiBase =
                    process.env.NEXT_PUBLIC_API_BASE_URL ??
                    "http://127.0.0.1:8000";

                const url = new URL(
                    "/api/v1/professor-reviews",
                    apiBase
                );

                url.searchParams.set("professor", professorName);

                const response = await fetch(url.toString());

                if (!response.ok) {
                    throw new Error(
                        `HTTP error! status: ${response.status}`
                    );
                }

                const data: ProfessorReview[] =
                    await response.json();

                setReviews(data);
            } catch (err) {
                console.error(
                    "Failed to load professor reviews:",
                    err
                );

                setError(
                    "Failed to load professor reviews. Please try again."
                );
            } finally {
                setLoading(false);
            }
        }

        loadReviews();
    }, [professorName]);

    const courses = useMemo(() => {
        return Array.from(
            new Set(reviews.map((review) => review.course_id))
        );
    }, [reviews]);

    const filteredReviews = useMemo(() => {
        return reviews.filter((review) => {
            const matchesRating =
                ratingFilter === "all" ||
                review.rating === Number(ratingFilter);

            const matchesCourse =
                courseFilter === "all" ||
                review.course_id === courseFilter;

            return matchesRating && matchesCourse;
        });
    }, [reviews, ratingFilter, courseFilter]);

    const averageRating = useMemo(() => {
        if (reviews.length === 0) {
            return null;
        }

        const total = reviews.reduce(
            (sum, review) => sum + review.rating,
            0
        );

        return (total / reviews.length).toFixed(1);
    }, [reviews]);

    return (
        <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">

                <header className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-muted-foreground">
                        StudySync Professor Reviews
                    </p>

                    <h1 className="font-heading text-3xl font-bold">
                        {professorName}
                    </h1>

                    {averageRating && (
                        <p className="text-sm text-muted-foreground">
                            Average Rating: {averageRating} / 5
                            {" · "}
                            {reviews.length} review
                            {reviews.length === 1 ? "" : "s"}
                        </p>
                    )}
                </header>

                <Separator />

                <div>
                    <Link href="/professors">
                        <Button variant="outline">
                            Back to Professor Search
                        </Button>
                    </Link>
                </div>

                {!loading && !error && reviews.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Filter Reviews</CardTitle>
                            <CardDescription>
                                Filter reviews by rating or class.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="flex flex-col gap-4 sm:flex-row">

                            <div className="flex flex-col gap-2">
                                <label
                                    htmlFor="rating-filter"
                                    className="text-sm font-medium"
                                >
                                    Rating
                                </label>

                                <select
                                    id="rating-filter"
                                    value={ratingFilter}
                                    onChange={(e) =>
                                        setRatingFilter(e.target.value)
                                    }
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="all">
                                        All Ratings
                                    </option>
                                    <option value="5">5 Stars</option>
                                    <option value="4">4 Stars</option>
                                    <option value="3">3 Stars</option>
                                    <option value="2">2 Stars</option>
                                    <option value="1">1 Star</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label
                                    htmlFor="course-filter"
                                    className="text-sm font-medium"
                                >
                                    Class
                                </label>

                                <select
                                    id="course-filter"
                                    value={courseFilter}
                                    onChange={(e) =>
                                        setCourseFilter(e.target.value)
                                    }
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="all">
                                        All Classes
                                    </option>

                                    {courses.map((course) => (
                                        <option
                                            key={course}
                                            value={course}
                                        >
                                            {course}
                                        </option>
                                    ))}
                                </select>
                            </div>

                        </CardContent>
                    </Card>
                )}

                {loading && (
                    <p className="text-sm text-muted-foreground">
                        Loading reviews...
                    </p>
                )}

                {error && (
                    <p className="text-sm font-medium text-destructive">
                        {error}
                    </p>
                )}

                {!loading &&
                    !error &&
                    reviews.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            No reviews found for this professor.
                        </p>
                    )}

                {!loading &&
                    !error &&
                    reviews.length > 0 &&
                    filteredReviews.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            No reviews match the selected filters.
                        </p>
                    )}

                <div className="grid grid-cols-1 gap-4">
                    {filteredReviews.map((review) => (
                        <Card key={review.review_id}>
                            <CardHeader>
                                <CardTitle>
                                    {"★".repeat(review.rating)}
                                    {"☆".repeat(5 - review.rating)}
                                </CardTitle>

                                <CardDescription>
                                    {review.course_id} ·{" "}
                                    {review.rating}/5
                                </CardDescription>
                            </CardHeader>

                            <CardContent>
                                <p className="text-sm">
                                    {review.feedback}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

            </div>
        </main>
    );
}