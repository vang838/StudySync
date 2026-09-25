"use client";

import Link from 'next/link';
import React, { useState, useEffect, useCallback } from 'react';
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
const fetchCourses = async (filters: CourseSearchFilters, query: string): Promise<Course[]> => {
    const url = new URL('/api/courses/search', window.location.origin);
    url.searchParams.set('subject', filters.subject);
    url.searchParams.set('courseNumber', filters.courseNumber);
    url.searchParams.set('professor', filters.professor);
    url.searchParams.set('name', query);

    const response = await fetch(url.toString());
    
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
};

export default function CourseSearchPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<CourseSearchFilters>({
        subject: '',
        courseNumber: '',
        professor: '',
    });
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const results = await fetchCourses(filters, searchTerm);
            setCourses(results);
        } catch (err) {
            console.error('Course fetch failed:', err);
            setError("Failed to fetch course data. Please try again.");
            setCourses([]);
        } finally {
            setLoading(false);
        }
    }, [filters, searchTerm]);

    useEffect(() => {
        handleSearch();
    }, [handleSearch]);

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-3xl font-bold mb-8">Course Catalog</h1>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar for Filters */}
                <aside className="lg:col-span-3">
                    <div className="sticky top-6 p-4 border rounded-lg shadow-sm bg-white">
                        <h2 className="text-xl font-semibold mb-4">Filter Courses</h2>
                        {/* Filter Inputs will go here */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Subject</label>
                            <select 
                                className="w-full p-2 border rounded" 
                                value={filters.subject} 
                                onChange={(e) => setFilters(prev => ({ ...prev, subject: e.target.value }))}
                            >
                                <option value="">All Subjects</option>
                                <option value="Computer Science">Computer Science</option>
                                <option value="Data Science">Data Science</option>
                            </select>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Course Number</label>
                            <input 
                                type="text" 
                                className="w-full p-2 border rounded" 
                                value={filters.courseNumber} 
                                onChange={(e) => setFilters(prev => ({ ...prev, courseNumber: e.target.value }))}
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Professor</label>
                            <input
                                type="text"
                                className="w-full p-2 border rounded"
                                value={filters.professor}
                                onChange={(e) => setFilters(prev => ({ ...prev, professor: e.target.value }))}
                                placeholder="e.g., Reed"
                            />
                        </div>
                        <button 
                            onClick={handleSearch}
                            className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-150"
                        >
                            Apply Filters
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="lg:col-span-9">
                    {/* Search Bar */}
                    <div className="mb-8 p-4 border rounded-lg shadow-sm bg-white">
                        <h2 className="text-xl font-semibold mb-3">Search Courses</h2>
                        <div className="flex gap-3">
                            <input 
                                type="text" 
                                placeholder="Search by course name or keyword..." 
                                className="flex-grow p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                            />
                            <button 
                                onClick={handleSearch}
                                disabled={loading}
                                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 transition duration-150"
                            >
                                {loading ? 'Searching...' : 'Search'}
                            </button>
                        </div>
                    </div>

                    {/* Results Display */}
                    <div className="mb-6 p-4 border rounded-lg shadow-sm bg-white">
                        {error && <p className="text-red-600 font-medium">{error}</p>}
                        {loading && <p className="text-blue-600 font-medium">Loading course results...</p>}
                        {!loading && !error && courses.length === 0 && <p className="text-gray-600">No courses found matching your criteria.</p>}
                        {!loading && !error && courses.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {courses.map(course => (
                                    <Link key={course.id} href={`/courses/${course.id}`} className="block">
                                        <article className="rounded-lg border bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
                                            <div className="mb-3 flex items-center justify-between gap-2">
                                                <h3 className="text-lg font-semibold text-gray-900">{course.name}</h3>
                                                <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                                                    {course.subject}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600">Course Number: {course.courseNumber}</p>
                                            <p className="text-sm text-gray-600">Professor: {course.professor}</p>
                                            <p className="text-sm text-gray-600">Year: {course.year}</p>
                                        </article>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}