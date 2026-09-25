"use client";

import React, { useEffect, useState } from 'react';

type CourseDetails = {
  course_id: string;
  title: string;
  description?: string | null;
  professor?: string | null;
  subject: string;
  year: number;
};

interface CourseOverviewProps {
  courseId: string;
}

const CourseOverview: React.FC<CourseOverviewProps> = ({ courseId }) => {
  const [course, setCourse] = useState<CourseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCourse = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}`);
        if (!response.ok) {
          throw new Error(`Failed to load course data (HTTP ${response.status})`);
        }

        const data = (await response.json()) as CourseDetails;
        setCourse(data);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Unable to load course details.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [courseId]);

  if (loading) {
    return <p className="text-blue-600 font-medium">Loading course overview...</p>;
  }

  if (error) {
    return <p className="text-red-600 font-medium">{error}</p>;
  }

  if (!course) {
    return <p className="text-gray-600">No course data found.</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 1. Course Information */}
      <section className="lg:col-span-2 space-y-6 p-6 border rounded-lg bg-white shadow-lg">
        <div className="border-b pb-4 mb-4">
          <h2 className="text-3xl font-semibold text-indigo-700">📚 Course Information</h2>
          <p className="text-gray-900 mt-2 text-xl font-semibold">{course.title}</p>
          <p className="text-gray-600 mt-1">{course.course_id} · {course.subject} · {course.year}</p>
          <p className="text-gray-700 mt-3">{course.description || 'No description provided for this course yet.'}</p>
        </div>

        {/* 2. Professor Details */}
        <div className="border-b pb-4 mb-4">
          <h2 className="text-2xl font-semibold text-indigo-700">👨‍🏫 Professor</h2>
          <p className="text-xl text-gray-800">{course.professor || 'TBA'}</p>
        </div>

        {/* 3. Uploaded Materials */}
        <div>
          <h2 className="text-2xl font-semibold text-indigo-700">📂 Materials</h2>
          <p className="mt-2 text-gray-600">No materials uploaded yet.</p>
        </div>
      </section>

      {/* 4. Forum & Sidebar */}
      <aside className="lg:col-span-1 space-y-8">
        
        {/* Forum */}
        <section className="p-6 border rounded-lg bg-white shadow-lg">
          <h2 className="text-2xl font-semibold text-indigo-700">💬 Discussion Forum</h2>
          <div className="space-y-3 mt-4">
            <div className="text-sm p-2 bg-gray-50 rounded">No discussion threads yet.</div>
          </div>
          <button className="mt-4 w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">
            View All Threads
          </button>
        </section>

        {/* Quick Quick Start Card */}
        <div className="p-6 border rounded-lg bg-yellow-50 shadow-lg">
            <h3 className="text-xl font-semibold text-yellow-800">Start Here</h3>
            <p className="text-sm mt-2">Review the course description and start the first thread for this class.</p>
        </div>
      </aside>
    </div>
  );
}

export default CourseOverview;