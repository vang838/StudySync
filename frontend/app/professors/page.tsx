"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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

type CourseResult = {
    course_id: string;
    title: string;
    professor?: string | null;
    subject: string;
    year: number;
};

type ProfessorReview = {
    review_id: number;
    professor: string;
    course_id: string;
    rating: number;
    feedback: string;
    created_at: string;
};

type ProfessorSearchEntry = {
    name: string;
    courses: CourseResult[];
    reviews: ProfessorReview[];
};

type ProfessorSearchResponse = {
    professors: ProfessorSearchEntry[];
    total_count: number;
    page: number;
    per_page: number;
    total_pages: number;
};

const PAGE_SIZE = 24;

export default function ProfessorSearchPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [submittedQuery, setSubmittedQuery] = useState("");
    const [professors, setProfessors] = useState<ProfessorSearchEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searched, setSearched] = useState(false);
    const [ratingFilter, setRatingFilter] = useState("all");
    const [courseFilter, setCourseFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [reviews, setReviews] = useState<Record<string, ProfessorReview[]>>({});

    const paginationItems = useMemo(() => {
        const items: Array<number | "ellipsis"> = [];
        if (totalPages <= 1) {
            return [1];
        }

        const windowStart = Math.max(1, page - 1);
        const windowEnd = Math.min(totalPages, page + 1);

        items.push(1);

        if (windowStart > 2) {
            items.push("ellipsis");
        }

        for (let pageNumber = windowStart; pageNumber <= windowEnd; pageNumber += 1) {
            if (pageNumber !== 1 && pageNumber !== totalPages) {
                items.push(pageNumber);
            }
        }

        if (windowEnd < totalPages - 1) {
            items.push("ellipsis");
        }

        if (totalPages > 1) {
            items.push(totalPages);
        }

        return items;
    }, [page, totalPages]);

    const availableCourses = useMemo(() => {
        return Array.from(
            new Map(
                professors.flatMap((professor) =>
                    professor.courses.map((course) => [
                        course.course_id,
                        course,
                    ] as const),
                ),
            ).values(),
        );
    }, [professors]);

    async function fetchProfessorPage(
        query: string,
        pageNumber: number,
        rating: string,
        courseId: string,
    ) {
        try {
            const url = new URL("/api/professor-reviews/search", window.location.origin);
            url.searchParams.set("q", query);
            url.searchParams.set("page", String(pageNumber));
            url.searchParams.set("per_page", String(PAGE_SIZE));
            if (rating !== "all") {
                url.searchParams.set("rating", rating);
            }
            if (courseId !== "all") {
                url.searchParams.set("course_id", courseId);
            }

            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const payload = (await response.json()) as ProfessorSearchResponse;
            setProfessors(payload.professors ?? []);
            setTotalCount(payload.total_count ?? 0);
            setTotalPages(payload.total_pages ?? 1);
            setPage(payload.page ?? 1);

            const reviewMap: Record<string, ProfessorReview[]> = {};
            for (const professor of payload.professors ?? []) {
                reviewMap[professor.name] = professor.reviews ?? [];
            }
            setReviews(reviewMap);
        } catch (err) {
            console.error("Professor search failed:", err);
            setError("Failed to search for professors. Please try again.");
            setProfessors([]);
            setReviews({});
            setTotalCount(0);
            setTotalPages(1);
            setPage(1);
        } finally {
            setLoading(false);
        }
    }

    function handleSearch() {
        const professorName = searchTerm.trim();
        if (!professorName) {
            setError("Please enter a professor name.");
            setProfessors([]);
            setReviews({});
            setTotalCount(0);
            setTotalPages(1);
            return;
        }

        setLoading(true);
        setError(null);
        setSearched(true);
        setSubmittedQuery(professorName);
        setPage(1);
        void fetchProfessorPage(professorName, 1, ratingFilter, courseFilter);
    }

    return (
        <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
                <header className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">
                        StudySync Professor Reviews
                    </p>
                    <h1 className="font-heading text-3xl font-bold">
                        Search Professors
                    </h1>
                </header>

                <Separator />

                <Card>
                    <CardHeader>
                        <CardTitle>Find a Professor</CardTitle>
                        <CardDescription>
                            Search for professors associated with courses.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="flex flex-col gap-3 sm:flex-row">
                        <Input
                            type="text"
                            placeholder="Enter professor name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleSearch();
                                }
                            }}
                        />

                        <Button
                            onClick={handleSearch}
                            disabled={loading}
                        >
                            {loading ? "Searching..." : "Search"}
                        </Button>
                    </CardContent>
                </Card>

                {searched && !loading && !error && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Filter Professors</CardTitle>
                            <CardDescription>
                                Filter professors by rating or course.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="flex flex-col gap-4 sm:flex-row">
                            <div className="flex flex-col gap-2">
                                <label htmlFor="rating-filter">
                                    Rating
                                </label>

                                <select
                                    id="rating-filter"
                                    value={ratingFilter}
                                    onChange={(e) => {
                                        const nextRating = e.target.value;
                                        setLoading(true);
                                        setError(null);
                                        setRatingFilter(nextRating);
                                        setPage(1);
                                        if (searched && submittedQuery) {
                                            void fetchProfessorPage(submittedQuery, 1, nextRating, courseFilter);
                                        }
                                    }}
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="all">All Ratings</option>
                                    <option value="5">5 Stars</option>
                                    <option value="4">4 Stars</option>
                                    <option value="3">3 Stars</option>
                                    <option value="2">2 Stars</option>
                                    <option value="1">1 Star</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label htmlFor="course-filter">
                                    Course
                                </label>

                                <select
                                    id="course-filter"
                                    value={courseFilter}
                                    onChange={(e) => {
                                        const nextCourse = e.target.value;
                                        setLoading(true);
                                        setError(null);
                                        setCourseFilter(nextCourse);
                                        setPage(1);
                                        if (searched && submittedQuery) {
                                            void fetchProfessorPage(submittedQuery, 1, ratingFilter, nextCourse);
                                        }
                                    }}
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="all">All Courses</option>

                                    {availableCourses.map((course) => (
                                        <option
                                            key={`${course.course_id}-${course.title}`}
                                            value={course.course_id}
                                        >
                                            {course.course_id} - {course.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {error && (
                    <p className="text-sm font-medium text-destructive">
                        {error}
                    </p>
                )}

                {!loading &&
                    !error &&
                    searched &&
                    totalCount === 0 && (
                        <p className="text-sm text-muted-foreground">
                            No professors found matching your search.
                        </p>
                    )
                }

                {!loading && !error && totalCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                        {totalCount} professor{totalCount === 1 ? "" : "s"} found
                    </p>
                )}

                {!loading && !error && professors.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {professors.map((professor) => (
                            <Card key={professor.name}>
                                <CardHeader>
                                    <CardTitle>{professor.name}</CardTitle>
                                    <CardDescription>
                                        {professor.courses.length} course
                                        {professor.courses.length === 1
                                            ? ""
                                            : "s"}
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="space-y-3">
                                    {professor.courses.map((course) => (
                                        <div
                                            key={`${professor.name}-${course.course_id}`}
                                            className="text-sm text-muted-foreground"
                                        >
                                            <p className="font-medium text-foreground">
                                                {course.course_id} — {course.title}
                                            </p>
                                            <p>{course.subject}</p>
                                        </div>
                                    ))}

                                    <p className="text-xs text-muted-foreground">
                                        {reviews[professor.name]?.length ?? 0} review
                                        {(reviews[professor.name]?.length ?? 0) === 1 ? "" : "s"}
                                    </p>

                                    <Link
                                        href={`/professors/${encodeURIComponent(
                                            professor.name,
                                        )}`}
                                    >
                                        <Button className="mt-2">
                                            View Reviews
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {!loading && !error && totalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {paginationItems.map((item, index) => {
                            if (item === "ellipsis") {
                                return (
                                    <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">
                                        ...
                                    </span>
                                );
                            }

                            const isActive = item === page;
                            return (
                                <button
                                    key={`page-${item}`}
                                    type="button"
                                    onClick={() => {
                                        const nextPage = Number(item);
                                        setLoading(true);
                                        setError(null);
                                        setPage(nextPage);
                                        void fetchProfessorPage(submittedQuery, nextPage, ratingFilter, courseFilter);
                                    }}
                                    disabled={isActive}
                                    className={`text-sm ${
                                        isActive
                                            ? "font-semibold text-foreground"
                                            : "text-primary underline-offset-2 hover:underline"
                                    } disabled:cursor-default`}
                                >
                                    {item}
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={() => {
                                const nextPage = Math.min(totalPages, page + 1);
                                setLoading(true);
                                setError(null);
                                setPage(nextPage);
                                void fetchProfessorPage(submittedQuery, nextPage, ratingFilter, courseFilter);
                            }}
                            disabled={page >= totalPages}
                            className="text-sm text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
