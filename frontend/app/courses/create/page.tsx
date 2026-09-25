"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

type CreateCoursePayload = {
  course_id: string;
  title: string;
  subject: string;
  professor: string;
  year: number;
  description: string;
};

const currentYear = new Date().getFullYear();

export default function CreateCoursePage() {
  const router = useRouter();
  const [form, setForm] = useState<CreateCoursePayload>({
    course_id: '',
    title: '',
    subject: '',
    professor: '',
    year: currentYear,
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          course_id: form.course_id.trim(),
          title: form.title.trim(),
          subject: form.subject.trim(),
          professor: form.professor.trim() || null,
          year: Number(form.year),
          description: form.description.trim() || null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Failed to create course (HTTP ${response.status})`);
      }

      const created = await response.json();
      router.push(`/courses/${created.course_id}`);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to create course.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Create Course</h1>
        <Link href="/courses/course_search" className="text-sm font-medium text-blue-700 hover:underline">
          Back to Catalog
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 rounded-xl border bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="course_id" className="mb-1 block text-sm font-medium text-gray-700">Course Number</label>
            <input
              id="course_id"
              className="w-full rounded border p-2"
              value={form.course_id}
              onChange={(e) => setForm((prev) => ({ ...prev, course_id: e.target.value }))}
              placeholder="CS101"
              required
            />
          </div>

          <div>
            <label htmlFor="subject" className="mb-1 block text-sm font-medium text-gray-700">Subject</label>
            <input
              id="subject"
              className="w-full rounded border p-2"
              value={form.subject}
              onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="Computer Science"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">Course Name</label>
          <input
            id="title"
            className="w-full rounded border p-2"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Introduction to Computer Science"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="professor" className="mb-1 block text-sm font-medium text-gray-700">Teacher / Professor</label>
            <input
              id="professor"
              className="w-full rounded border p-2"
              value={form.professor}
              onChange={(e) => setForm((prev) => ({ ...prev, professor: e.target.value }))}
              placeholder="Dr. Evelyn Reed"
            />
          </div>

          <div>
            <label htmlFor="year" className="mb-1 block text-sm font-medium text-gray-700">Year</label>
            <input
              id="year"
              type="number"
              min={1900}
              max={2100}
              className="w-full rounded border p-2"
              value={form.year}
              onChange={(e) => setForm((prev) => ({ ...prev, year: Number(e.target.value) }))}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">Description</label>
          <textarea
            id="description"
            rows={4}
            className="w-full rounded border p-2"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Course overview, topics, and learning outcomes..."
          />
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-600 px-5 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {loading ? 'Creating...' : 'Create Course'}
          </button>
          <Link href="/courses/course_search" className="rounded border px-5 py-2 text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
