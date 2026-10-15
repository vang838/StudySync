"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type UserProfile = {
  user_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
};

type SavedCourse = {
  course_id: string;
  title: string;
  description?: string | null;
  professor?: string | null;
  subject: string;
  year: number;
};

type BookmarkedForumPost = {
  post_id: number;
  course_id: string;
  author_name: string;
  content: string;
  created_at: string;
  reply_count: number;
};

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
};

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<BookmarkedForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  useEffect(() => {
    const loadProfile = async () => {
      const { userId } = await params;
      setResolvedUserId(userId);

      const loggedInUserId = window.localStorage.getItem("user_id");
      if (loggedInUserId && loggedInUserId === userId) {
        router.replace(`/users/${encodeURIComponent(userId)}/profile`);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [userResponse, coursesResponse] = await Promise.all([
          fetch(`/api/users/${encodeURIComponent(userId)}`),
        fetch(`/api/courses/saved?user_id=${encodeURIComponent(userId)}`),
        ]);

        if (!userResponse.ok) {
          const body = await userResponse.json().catch(() => ({}));
          throw new Error(body?.detail ?? `Failed to load user profile (HTTP ${userResponse.status})`);
        }

        if (!coursesResponse.ok) {
          const body = await coursesResponse.json().catch(() => ({}));
          throw new Error(body?.detail ?? `Failed to load saved courses (HTTP ${coursesResponse.status})`);
        }

        const userData = (await userResponse.json()) as UserProfile;
        const courseData = (await coursesResponse.json()) as SavedCourse[];
        const normalizedCourseData = Array.isArray(courseData) ? courseData : [];
        const bookmarkResponses = await Promise.all(
          normalizedCourseData.map((course) =>
            fetch(
              `/api/courses/${encodeURIComponent(course.course_id)}/forum/posts?bookmarked_only=true&user_id=${encodeURIComponent(userId)}&sort=newest`,
            ),
          ),
        );
        for (let index = 0; index < bookmarkResponses.length; index += 1) {
          const bookmarkResponse = bookmarkResponses[index];
          if (!bookmarkResponse.ok) {
            const body = await bookmarkResponse.json().catch(() => ({}));
            throw new Error(
              body?.detail
                ?? `Failed to load bookmarked posts for ${normalizedCourseData[index]?.course_id ?? "a course"} (HTTP ${bookmarkResponse.status})`,
            );
          }
        }
        const bookmarkPayloads = await Promise.all(bookmarkResponses.map((response) => response.json()));
        const flattenedBookmarkedPosts = (bookmarkPayloads.flatMap((payload) =>
          Array.isArray(payload) ? payload : []
        ) as BookmarkedForumPost[]).sort((a, b) => {
          const aValue = Date.parse(a.created_at);
          const bValue = Date.parse(b.created_at);
          if (Number.isNaN(aValue) || Number.isNaN(bValue)) {
            return b.post_id - a.post_id;
          }
          return bValue - aValue;
        });

        setUser(userData);
        setSavedCourses(normalizedCourseData);
        setBookmarkedPosts(flattenedBookmarkedPosts);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load profile.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [params, router]);

  const savedCourseCount = useMemo(() => savedCourses.length, [savedCourses]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading profile...</p>;
  }

  if (error) {
    return <p className="text-sm font-medium text-destructive">{error}</p>;
  }

  if (!user) {
    return <p className="text-sm text-muted-foreground">No profile data found.</p>;
  }

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">Student Profile</p>
            <h1 className="font-heading text-3xl font-bold">{user.full_name}</h1>
            <p className="text-sm text-muted-foreground">User ID: {resolvedUserId ?? user.user_id}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/courses/course_search">
              <Button variant="secondary" size="s">Back to Catalog</Button>
            </Link>
            <Link href="/dashboard">
              <Button size="s">Dashboard</Button>
            </Link>
          </div>
        </header>

        <Separator />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="space-y-6 lg:col-span-8">
            <Card>
              <CardHeader>
                <CardTitle>Profile Details</CardTitle>
                <CardDescription>Basic account information for this course member.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground">Name</p>
                  <p className="mt-1 text-base text-foreground">{user.full_name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground">Email</p>
                  <p className="mt-1 text-base text-foreground">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground">Saved courses</p>
                  <p className="mt-1 text-base text-foreground">{savedCourseCount}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Saved Courses</CardTitle>
                <CardDescription>Courses this student has bookmarked or joined.</CardDescription>
              </CardHeader>
              <CardContent>
                {savedCourses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved courses yet.</p>
                ) : (
                  <div className="space-y-3">
                    {savedCourses.map((course) => (
                      <Link key={course.course_id} href={`/courses/${encodeURIComponent(course.course_id)}`} className="block">
                        <div className="rounded-md border border-border/60 bg-card p-3 transition hover:border-secondary hover:shadow-sm">
                          <p className="text-sm font-medium text-foreground">{course.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {course.course_id} · {course.subject} · {course.year}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-6 lg:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle>Bookmarked Posts</CardTitle>
                <CardDescription>Saved discussions from your courses.</CardDescription>
              </CardHeader>
              <CardContent>
                {bookmarkedPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bookmarked posts yet.</p>
                ) : (
                  <div className="space-y-3">
                    {bookmarkedPosts.map((post) => (
                      <Link
                        key={`${post.course_id}-${post.post_id}`}
                        href={`/courses/${encodeURIComponent(post.course_id)}/forum/${post.post_id}`}
                        className="block"
                      >
                        <div className="rounded-md border border-border/60 bg-card p-3 transition hover:border-secondary hover:shadow-sm">
                          <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{post.course_id}</span>
                            <span>{formatDateTime(post.created_at)}</span>
                          </div>
                          <p className="text-sm text-foreground">{post.content}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {post.reply_count} repl{post.reply_count === 1 ? "y" : "ies"} · {post.author_name}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  This profile shows the member&apos;s course activity and saved classes.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}
