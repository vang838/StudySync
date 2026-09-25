"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

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
    return <p className="text-sm text-muted-foreground">Loading course overview...</p>;
  }

  if (error) {
    return <p className="text-sm font-medium text-destructive">{error}</p>;
  }

  if (!course) {
    return <p className="text-sm text-muted-foreground">No course data found.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <section className="space-y-6 lg:col-span-8">
        <Card>
          <CardHeader>
            <CardTitle>{course.title}</CardTitle>
            <CardDescription>{course.course_id} · {course.subject} · {course.year}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{course.description || 'No description provided for this course yet.'}</p>
            <Separator />
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground">Professor</p>
              <p className="mt-1 text-base text-foreground">{course.professor || 'TBA'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Materials</CardTitle>
            <CardDescription>Course files and links shared by instructors.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No materials uploaded yet.</p>
          </CardContent>
        </Card>
      </section>

      <aside className="space-y-6 lg:col-span-4">
        <Card>
          <CardHeader>
            <CardTitle>Discussion Forum</CardTitle>
            <CardDescription>Talk through homework, readings, and exam prep.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
              No discussion threads yet.
            </div>
          </CardContent>
          <CardContent>
            <Button className="w-full">View All Threads</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Start Here</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Review the course description and start the first thread for this class.
            </p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

export default CourseOverview;