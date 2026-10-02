"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Course = {
  course_id: string;
  title: string;
  subject?: string;
};

export default function CollaborativeHub() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSavedCourses() {
      try {
        const rawUser = localStorage.getItem("studysync_user");

        if (!rawUser) {
            throw new Error("User is not logged in.");
        }

        const user = JSON.parse(rawUser);
        const userId = Number(user.user_id);

        if (!Number.isInteger(userId) || userId <= 0) {
            throw new Error("Invalid user ID.");
        }

        const response = await fetch(
          `/api/courses/saved?user_id=${userId}`
        );

        if (!response.ok) {
          throw new Error("Failed to load saved courses.");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid course data.");
        }

        setCourses(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load your saved courses.");
      } finally {
        setLoading(false);
      }
    }

    loadSavedCourses();
  }, []);

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground md:px-10">
      <div className="mx-auto max-w-6xl">

        <header className="mb-8">
          <p className="text-sm text-muted-foreground">
            Student Community
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            Collaborative Hub
          </h1>

          <p className="mt-2 text-muted-foreground">
            Connect with classmates and join discussions
            for your saved courses.
          </p>
        </header>

        <h2 className="mb-4 text-xl font-semibold">
          Your Course Forums
        </h2>

        {loading && (
          <p className="text-muted-foreground">
            Loading your courses...
          </p>
        )}

        {error && (
          <p className="text-red-500">{error}</p>
        )}

        {!loading && !error && courses.length === 0 && (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              You have not saved any courses yet.
            </p>

            <Link
              href="/courses/course_search"
              className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Browse Courses
            </Link>
          </div>
        )}

        {!loading && !error && courses.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.course_id}>
                <CardHeader>
                  <p className="text-sm text-muted-foreground">
                    {course.course_id}
                  </p>

                  <CardTitle>
                    {course.title}
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Join the discussion and collaborate
                    with your classmates.
                  </p>

                  <Link
                    href={`/courses/${encodeURIComponent(
                      course.course_id
                    )}`}
                    className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    Open Course Forum
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
