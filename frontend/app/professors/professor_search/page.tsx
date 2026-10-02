"use client";

import { useState } from "react";
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

type ProfessorResult = {
    name: string;
    courses: CourseResult[];
};

export default function ProfessorSearchPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [professors, setProfessors] = useState<ProfessorResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searched, setSearched] = useState(false);

    async function handleSearch() {
        const professorName = searchTerm.trim();

        if (!professorName) {
            setError("Please enter a professor name.");
            setProfessors([]);
            return;
        }

        setLoading(true);
        setError(null);
        setSearched(true);

        try {
            const url = new URL("/api/courses/search", window.location.origin);
            url.searchParams.set("professor", professorName);

            const response = await fetch(url.toString());

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: CourseResult[] = await response.json();

            const professorMap = new Map<string, CourseResult[]>();

            data.forEach((course) => {
                if (!course.professor) {
                    return;
                }

                const existingCourses =
                    professorMap.get(course.professor) ?? [];

                existingCourses.push(course);
                professorMap.set(course.professor, existingCourses);
            });

            const results: ProfessorResult[] = Array.from(
                professorMap.entries()
            ).map(([name, courses]) => ({
                name,
                courses,
            }));

            setProfessors(results);
        } catch (err) {
            console.error("Professor search failed:", err);
            setError("Failed to search for professors. Please try again.");
            setProfessors([]);
        } finally {
            setLoading(false);
        }
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

                {error && (
                    <p className="text-sm font-medium text-destructive">
                        {error}
                    </p>
                )}

                {!loading &&
                    !error &&
                    searched &&
                    professors.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            No professors found matching your search.
                        </p>
                    )}

                {professors.length > 0 && (
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
                                            key={course.course_id}
                                            className="text-sm text-muted-foreground"
                                        >
                                            <p className="font-medium text-foreground">
                                                {course.course_id} — {course.title}
                                            </p>
                                            <p>{course.subject}</p>
                                        </div>
                                    ))}

                                    <Link
                                        href={`/professors/${encodeURIComponent(
                                            professor.name
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
            </div>
        </main>
    );
}