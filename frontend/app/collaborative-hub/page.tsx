
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Course = {
  course_id: string;
  title: string;
  subject?: string;
};

type RecentDiscussion = {
  post_id: number;
  course_id: string;
  course_title: string;
  author_name: string;
  content: string;
  created_at: string;
  last_activity_at: string;
  reply_count: number;
};

type SessionStatus = "loading" | "guest" | "member" | "error";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function CollaborativeHub() {
  const [discussions, setDiscussions] = useState<RecentDiscussion[]>([]);
  const [discussionsLoading, setDiscussionsLoading] = useState(true);
  const [discussionsError, setDiscussionsError] = useState("");

  const [session, setSession] = useState<SessionStatus>("loading");
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDiscussions() {
      try {
        const response = await fetch("/api/forum/recent", { signal: controller.signal });
        if (!response.ok) throw new Error("Failed to load recent discussions.");

        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid discussion data.");

        if (!controller.signal.aborted) setDiscussions(data);
      } catch {
        if (!controller.signal.aborted) setDiscussionsError("Unable to load recent discussions.");
      } finally {
        if (!controller.signal.aborted) setDiscussionsLoading(false);
      }
    }

    void loadDiscussions();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSavedCourses() {
      try {
        const response = await fetch("/api/auth/me", { signal: controller.signal });
        if (response.status === 401) {
          if (!controller.signal.aborted) setSession("guest");
          return;
        }
        if (!response.ok) throw new Error("Unable to verify session.");

        const user: { user_id: number } = await response.json();
        if (!Number.isInteger(user.user_id) || user.user_id <= 0) {
          throw new Error("Invalid session.");
        }

        if (controller.signal.aborted) return;
        setSession("member");
        setCoursesLoading(true);

        const coursesResponse = await fetch(
          `/api/courses/saved?user_id=${user.user_id}`,
          { signal: controller.signal }
        );

        if (coursesResponse.status === 401) {
          if (!controller.signal.aborted) setSession("guest");
          return;
        }
        if (!coursesResponse.ok) throw new Error("Unable to load saved courses.");

        const data = await coursesResponse.json();
        if (!Array.isArray(data)) throw new Error("Invalid course data.");

        if (!controller.signal.aborted) setCourses(data);
      } catch {
        if (!controller.signal.aborted) {
          setCoursesError("Unable to load your saved courses or verify your session.");
          setSession((current) => current === "loading" ? "error" : current);
        }
      } finally {
        if (!controller.signal.aborted) setCoursesLoading(false);
      }
    }

    void loadSavedCourses();
    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground md:px-10">
      <div className="mx-auto max-w-6xl space-y-10">
        <header>
          <p className="text-sm text-muted-foreground">Student Community</p>
          <h1 className="mt-1 font-heading text-3xl font-bold">Collaborative Hub</h1>
          <p className="mt-2 text-muted-foreground">
            Explore course discussions, learn from classmates, and stay connected.
          </p>
        </header>

        <section aria-labelledby="recent-discussions">
          <div className="mb-5">
            <h2 id="recent-discussions" className="font-heading text-2xl font-bold">
              Recent Discussions
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The latest conversations across the StudySync community.
            </p>
          </div>

          {discussionsLoading && (
            <p className="text-sm text-muted-foreground">Loading recent discussions...</p>
          )}

          {discussionsError && (
            <p role="alert" className="text-sm text-destructive">{discussionsError}</p>
          )}

          {!discussionsLoading && !discussionsError && discussions.length === 0 && (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              No discussions have been posted yet.
            </div>
          )}

          {!discussionsLoading && !discussionsError && discussions.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {discussions.map((discussion) => (
                <Card key={discussion.post_id} className="border-border/70 bg-card">
                  <CardHeader className="space-y-2">
                    <p className="text-xs font-semibold text-secondary">
                      {discussion.course_id} · {discussion.course_title}
                    </p>
                    <CardTitle className="text-lg">
                      {discussion.content.length > 85
                        ? `${discussion.content.slice(0, 85)}...`
                        : discussion.content}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Started by {discussion.author_name}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm leading-6 text-muted-foreground">
                      {discussion.content.length > 200
                        ? `${discussion.content.slice(0, 200)}...`
                        : discussion.content}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {discussion.reply_count} {discussion.reply_count === 1 ? "reply" : "replies"}
                      </span>
                      <span>Last active {formatDate(discussion.last_activity_at)}</span>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/collaborative-hub/${encodeURIComponent(discussion.course_id)}/${discussion.post_id}`}
                        className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                      >
                        Read Discussion
                      </Link>
                      {session === "member" && (
                        <Link
                          href={`/courses/${encodeURIComponent(discussion.course_id)}/forum/${discussion.post_id}`}
                          className="inline-flex items-center text-sm font-medium text-secondary hover:underline"
                        >
                          Open Course Forum
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="saved-course-forums">
          {session === "loading" && (
            <p className="text-sm text-muted-foreground">Checking your session...</p>
          )}

          {session === "guest" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 md:p-8">
              <h2 className="font-heading text-2xl font-bold text-slate-900">
                Want to join the conversation?
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
                You can explore discussions without an account. Sign in or create
                an account to save courses, post questions, and reply to classmates.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/auth/signin" className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
                  Sign In
                </Link>
                <Link href="/auth/signup" className="rounded-md border border-primary px-5 py-2.5 text-sm font-semibold text-primary">
                  Create Account
                </Link>
              </div>
            </div>
          )}

          {(session === "member" || session === "error") && (
            <div className="space-y-4">
              <h2 id="saved-course-forums" className="font-heading text-2xl font-bold">
                Your Course Forums
              </h2>

              {coursesLoading && (
                <p className="text-muted-foreground">Loading your courses...</p>
              )}

              {coursesError && (
                <p role="alert" className="text-sm text-destructive">{coursesError}</p>
              )}

              {session === "member" && !coursesLoading && !coursesError && courses.length === 0 && (
                <div className="space-y-3">
                  <p className="text-muted-foreground">You have not saved any courses yet.</p>
                  <Link href="/courses/course_search" className="text-sm font-semibold text-secondary hover:underline">
                    Browse Courses
                  </Link>
                </div>
              )}

              {session === "member" && !coursesLoading && !coursesError && courses.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {courses.map((course) => (
                    <Card key={course.course_id}>
                      <CardHeader>
                        <p className="text-xs text-muted-foreground">{course.course_id}</p>
                        <CardTitle>{course.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Link
                          href={`/courses/${encodeURIComponent(course.course_id)}`}
                          className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                        >
                          Open Course Forum
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
