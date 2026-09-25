"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
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
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">StudySync Courses</p>
            <h1 className="font-heading text-3xl font-bold">Create Course</h1>
          </div>
          <Link href="/courses/course_search">
            <Button variant="secondary" size="s">Back to Catalog</Button>
          </Link>
        </header>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>Course Details</CardTitle>
            <CardDescription>Add a new class to the catalog with instructor and metadata.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="course_id" className="text-sm font-medium text-muted-foreground">Course Number</label>
                  <Input
                    id="course_id"
                    className="w-full"
                    value={form.course_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, course_id: e.target.value }))}
                    placeholder="CS101"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="subject" className="text-sm font-medium text-muted-foreground">Subject</label>
                  <Input
                    id="subject"
                    className="w-full"
                    value={form.subject}
                    onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                    placeholder="Computer Science"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium text-muted-foreground">Course Name</label>
                <Input
                  id="title"
                  className="w-full"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Introduction to Computer Science"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="professor" className="text-sm font-medium text-muted-foreground">Teacher / Professor</label>
                  <Input
                    id="professor"
                    className="w-full"
                    value={form.professor}
                    onChange={(e) => setForm((prev) => ({ ...prev, professor: e.target.value }))}
                    placeholder="Dr. Evelyn Reed"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="year" className="text-sm font-medium text-muted-foreground">Year</label>
                  <Input
                    id="year"
                    type="number"
                    min={1900}
                    max={2100}
                    className="w-full"
                    value={form.year}
                    onChange={(e) => setForm((prev) => ({ ...prev, year: Number(e.target.value) }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium text-muted-foreground">Description</label>
                <textarea
                  id="description"
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Course overview, topics, and learning outcomes..."
                />
              </div>

              {error && <p className="text-sm font-medium text-destructive">{error}</p>}

              <CardFooter className="px-0">
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Course'}
                  </Button>
                  <Link href="/courses/course_search">
                    <Button variant="outline">Cancel</Button>
                  </Link>
                </div>
              </CardFooter>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
