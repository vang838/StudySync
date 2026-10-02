'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import Link from 'next/link';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Course, CourseSearchFilters } from '@/lib/types/course';

type ApiCourse = {
    course_id: string;
    title: string;
    professor?: string | null;
    subject: string;
    year: number;
};

const normalizeCourse = (item: ApiCourse): Course => ({
    id: item.course_id,
    name: item.title,
    courseNumber: item.course_id,
    professor: item.professor ?? 'TBA',
    subject: item.subject,
    year: item.year,
});

// Function to fetch courses from the API endpoint
const fetchCourses = async (
    filters: CourseSearchFilters,
    query: string,
    savedOnly: boolean,
    userId: number,
): Promise<Course[]> => {
    const url = new URL('/api/courses/search', window.location.origin);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);
    url.searchParams.set('subject', filters.subject);
    url.searchParams.set('courseNumber', filters.courseNumber);
    url.searchParams.set('professor', filters.professor);
    url.searchParams.set('name', query);
    url.searchParams.set('savedOnly', savedOnly ? 'true' : 'false');
    if (savedOnly) {
        url.searchParams.set('user_id', String(userId));
    }

    try {
        const response = await fetch(url.toString(), { signal: controller.signal });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        // Safely check if the data is an array of courses, or if it contains a 'courses' array.
        if (Array.isArray(data)) {
            return (data as ApiCourse[]).map(normalizeCourse);
        }
        if (typeof data === 'object' && data !== null && Array.isArray(data.courses)) {
            return (data.courses as ApiCourse[]).map(normalizeCourse);
        }
        // Throwing a specific error if the structure is unrecognizable
        throw new Error("API response did not contain a recognizable array of courses.");
    } finally {
        window.clearTimeout(timeoutId);
    }
};

export default function CourseSearchPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<CourseSearchFilters>({
        subject: '',
        courseNumber: '',
        professor: '',
    });
    const [courses, setCourses] = useState<Course[]>([]);
    const [subjectOptions, setSubjectOptions] = useState<string[]>([]);
    const [savedCourseIds, setSavedCourseIds] = useState<string[]>([]);
    const [savedOnlyFilter, setSavedOnlyFilter] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hasLoadedSubjectsRef = useRef(false);

    const getCurrentUserId = useCallback(() => {
        if (typeof window === 'undefined') {
            return 1;
        }

        const rawUserId = window.localStorage.getItem('user_id');
        const parsedUserId = Number(rawUserId ?? '1');
        return Number.isFinite(parsedUserId) && parsedUserId > 0 ? parsedUserId : 1;
    }, []);

    const syncSavedCourses = useCallback(async () => {
        const userId = getCurrentUserId();
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(`/api/courses/saved?user_id=${userId}`, { signal: controller.signal });
            if (!response.ok) {
                return;
            }

            const savedCourses = await response.json();
            const ids = Array.isArray(savedCourses)
                ? savedCourses
                    .map((course: { course_id?: string; id?: string }) => course.course_id ?? course.id)
                    .filter((courseId): courseId is string => Boolean(courseId))
                : [];
            setSavedCourseIds(ids);
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                setError('Loading saved courses timed out. Please try again.');
                return;
            }
            console.error('Failed to load saved courses:', err);
        } finally {
            window.clearTimeout(timeoutId);
        }
    }, [getCurrentUserId]);

    const loadSubjectOptions = useCallback(async () => {
        if (hasLoadedSubjectsRef.current) {
            return;
        }

        hasLoadedSubjectsRef.current = true;
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch('/api/courses/subjects', { signal: controller.signal });
            if (!response.ok) {
                return;
            }
            const subjects = await response.json();
            if (Array.isArray(subjects)) {
                const normalized = subjects.filter(
                    (subject): subject is string => typeof subject === 'string' && subject.trim().length > 0,
                );
                setSubjectOptions(normalized);
            }
        } catch (err) {
            if (!(err instanceof Error && err.name === 'AbortError')) {
                console.error('Failed to load subject options:', err);
            }
        } finally {
            window.clearTimeout(timeoutId);
        }
    }, []);

    const handleSearch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const results = await fetchCourses(filters, searchTerm, savedOnlyFilter, getCurrentUserId());
            setCourses(results);
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                setError('Course search timed out. Please try again.');
                setCourses([]);
                return;
            }
            console.error('Course fetch failed:', err);
            setError("Failed to fetch course data. Please try again.");
            setCourses([]);
        } finally {
            setLoading(false);
        }
    }, [filters, getCurrentUserId, savedOnlyFilter, searchTerm]);

    const handleSaveToggle = useCallback(async (courseId: string) => {
        const userId = getCurrentUserId();
        const isSaved = savedCourseIds.includes(courseId);
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}/save?user_id=${userId}`, {
                method: isSaved ? 'DELETE' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`Unable to ${isSaved ? 'unsave' : 'save'} course.`);
            }

            const nextSavedIds = isSaved
                ? savedCourseIds.filter((savedCourseId) => savedCourseId !== courseId)
                : [...savedCourseIds, courseId];

            setSavedCourseIds(nextSavedIds);

            if (typeof window !== 'undefined') {
                const nextSavedCourses = courses
                    .filter((course) => nextSavedIds.includes(course.id))
                    .map((course) => ({
                        code: course.courseNumber,
                        name: course.name,
                        progress: 100,
                    }));
                window.localStorage.setItem('saved_courses', JSON.stringify(nextSavedCourses));
            }
        } catch (err) {
            console.error('Failed to update saved course:', err);
            setError('Saving this course failed. Please try again.');
        } finally {
            window.clearTimeout(timeoutId);
        }
    }, [courses, getCurrentUserId, savedCourseIds]);

    useEffect(() => {
        void syncSavedCourses();
    }, [syncSavedCourses]);

    useEffect(() => {
        void loadSubjectOptions();
    }, [loadSubjectOptions]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void handleSearch();
        }, 250);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [handleSearch]);

    return (
        <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-10 pb-10">
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-muted-foreground">StudySync Courses</p>
                        <h1 className="font-heading text-3xl font-bold">Course Catalog</h1>
                    </div>
                    <Link href="/courses/create">
                        <Button>Create Course</Button>
                    </Link>
                </header>

                <Separator />

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <aside className="lg:col-span-4 xl:col-span-3">
                        <Card>
                            <CardHeader>
                                <CardTitle>Filter Courses</CardTitle>
                                <CardDescription>Narrow results by subject, number, or professor.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Subject</label>
                                    <select
                                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                        value={filters.subject}
                                        onChange={(e) => setFilters((prev) => ({ ...prev, subject: e.target.value }))}
                                    >
                                        <option value="">All Subjects</option>
                                        {subjectOptions.map((subject) => (
                                            <option key={subject} value={subject}>
                                                {subject}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Course Number</label>
                                    <Input
                                        className="w-full"
                                        value={filters.courseNumber}
                                        onChange={(e) => setFilters((prev) => ({ ...prev, courseNumber: e.target.value }))}
                                        placeholder="CS101"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Professor</label>
                                    <Input
                                        className="w-full"
                                        value={filters.professor}
                                        onChange={(e) => setFilters((prev) => ({ ...prev, professor: e.target.value }))}
                                        placeholder="Reed"
                                    />
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        id="saved-only-filter"
                                        type="checkbox"
                                        className="h-4 w-4 rounded border border-input"
                                        checked={savedOnlyFilter}
                                        onChange={(e) => setSavedOnlyFilter(e.target.checked)}
                                    />
                                    <label
                                        htmlFor="saved-only-filter"
                                        className="text-sm font-medium text-muted-foreground"
                                    >
                                        Saved courses only
                                    </label>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleSearch} className="w-full">Apply Filters</Button>
                            </CardFooter>
                        </Card>
                    </aside>

                    <section className="space-y-6 lg:col-span-8 xl:col-span-9">
                        <Card>
                            <CardHeader>
                                <CardTitle>Search Courses</CardTitle>
                                <CardDescription>Find classes by name, topic, or keyword.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3 sm:flex-row">
                                <Input
                                    className="w-full"
                                    type="text"
                                    placeholder="Search by course name or keyword..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSearch();
                                        }
                                    }}
                                />
                                <Button onClick={handleSearch} disabled={loading}>
                                    {loading ? 'Searching...' : 'Search'}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Results</CardTitle>
                                <CardDescription>
                                    {courses.length} course{courses.length === 1 ? '' : 's'} found
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                                {loading && <p className="text-sm text-muted-foreground">Loading course results...</p>}
                                {!loading && !error && courses.length === 0 && (
                                    <p className="text-sm text-muted-foreground">No courses found matching your criteria.</p>
                                )}

                                {!loading && !error && courses.length > 0 && (
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                        {courses.map((course) => {
                                            const isSaved = savedCourseIds.includes(course.id);

                                            return (
                                                <div key={course.id} className="space-y-3">
                                                    <Link href={`/courses/${course.id}`} className="block">
                                                        <Card className="transition hover:ring-2 hover:ring-primary/40">
                                                            <CardHeader>
                                                                <CardTitle>{course.name}</CardTitle>
                                                                <CardDescription>{course.subject}</CardDescription>
                                                            </CardHeader>
                                                            <CardContent className="space-y-1 text-sm text-muted-foreground">
                                                                <p>Course Number: {course.courseNumber}</p>
                                                                <p>Professor: {course.professor}</p>
                                                                <p>Year: {course.year}</p>
                                                            </CardContent>
                                                            <CardFooter>
                                                                <Button variant="secondary" size="s">Open Overview</Button>
                                                            </CardFooter>
                                                        </Card>
                                                    </Link>
                                                    <Button
                                                        type="button"
                                                        variant={isSaved ? 'default' : 'outline'}
                                                        className="w-full"
                                                        onClick={() => {
                                                            void handleSaveToggle(course.id);
                                                        }}
                                                    >
                                                        {isSaved ? 'Saved' : 'Save course'}
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </div>
        </main>
    );
}