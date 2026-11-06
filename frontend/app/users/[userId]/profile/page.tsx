"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type UserProfile = {
  user_id?: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email?: string;
  discussion_activity?: UserDiscussionActivityPost[];
  forum_points: number;
  forum_point_values?: {
    post_or_reply: number;
    like_received: number;
  };
};

type UserDiscussionActivityPost = {
    post_id: number;
    course_id: string;
    content: string;
    created_at: string;
    role_label: "Posted" | "Replied" | "Posted & Replied";
};

type SavedCourse = {
  course_id: string;
  title: string;
  description?: string | null;
  professor?: string | null;
  subject: string;
  year: number;
  is_archived?: boolean;
};

type UserDocument = {
  document_id: string;
  version_id: string;
  course_id: string;
  title: string;
  is_published: boolean;
  original_filename: string;
  file_size_bytes: number;
  created_at: string;
};

type BookmarkedForumPost = {
  post_id: number;
  course_id: string;
  author_name: string;
  content: string;
  created_at: string;
  reply_count: number;
};

const PAGE_SIZE = 12;

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
};

const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "Unknown size";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getPaginationItems = (page: number, totalPages: number): Array<number | "ellipsis"> => {
  const items: Array<number | "ellipsis"> = [];
  if (totalPages <= 1) {
    return [1];
  }

  const windowStart = Math.max(1, page - 1);
  const windowEnd = Math.min(totalPages, page + 1);

  items.push(1);

  if (windowStart > 2) {
    items.push("ellipsis");
  }

  for (let pageNumber = windowStart; pageNumber <= windowEnd; pageNumber += 1) {
    if (pageNumber !== 1 && pageNumber !== totalPages) {
      items.push(pageNumber);
    }
  }

  if (windowEnd < totalPages - 1) {
    items.push("ellipsis");
  }

  if (totalPages > 1) {
    items.push(totalPages);
  }

  return items;
};

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [expandedCourseFolders, setExpandedCourseFolders] = useState<Record<string, boolean>>({});
  const [bookmarkedPosts, setBookmarkedPosts] = useState<BookmarkedForumPost[]>([]);
  const [discussionActivityPosts, setDiscussionActivityPosts] = useState<UserDiscussionActivityPost[]>([]);
  const [bookmarkedPage, setBookmarkedPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [bookmarkedSearchQuery, setBookmarkedSearchQuery] = useState("");
  const [activitySearchQuery, setActivitySearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchivedCourses, setShowArchivedCourses] = useState(false);

  const toggleCourseFolder = (courseId: string) => {
    setExpandedCourseFolders((current) => ({
      ...current,
      [courseId]: !current[courseId],
    }));
  };

  useEffect(() => {
    const loadProfile = async () => {
      const { userId } = await params;
      setLoading(true);
      setError(null);

      try {
        const userResponse = await fetch(`/api/public-users/${encodeURIComponent(userId)}`);

        if (!userResponse.ok) {
          const body = await userResponse.json().catch(() => ({}));
          throw new Error(body?.detail ?? `Failed to load user profile (HTTP ${userResponse.status})`);
        }

        const userData = (await userResponse.json()) as UserProfile;
        const normalizedCourseData: SavedCourse[] = [];
        const normalizedDocumentData: UserDocument[] = [];

        setUser(userData);
        setSavedCourses(normalizedCourseData);
        setDocuments(normalizedDocumentData);
        setExpandedCourseFolders(
          Object.fromEntries(normalizedCourseData.map((course) => [course.course_id, false])),
        );
        setBookmarkedPosts([]);
        setDiscussionActivityPosts(userData.discussion_activity ?? []);
        setBookmarkedPage(1);
        setActivityPage(1);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load profile.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [params]);

  const savedCourseCount = useMemo(() => savedCourses.length, [savedCourses]);
  const activeSavedCourses = useMemo(
    () => savedCourses.filter((course) => !course.is_archived),
    [savedCourses],
  );
  const archivedSavedCourses = useMemo(
    () => savedCourses.filter((course) => course.is_archived),
    [savedCourses],
  );
  const effectiveShowArchivedCourses = showArchivedCourses
    ? archivedSavedCourses.length > 0
    : activeSavedCourses.length === 0 && archivedSavedCourses.length > 0;
  const displayedSavedCourses = useMemo(
    () => (effectiveShowArchivedCourses ? archivedSavedCourses : activeSavedCourses),
    [activeSavedCourses, archivedSavedCourses, effectiveShowArchivedCourses],
  );
  const documentMapByCourse = useMemo(() => {
    const lookup = new Map<string, UserDocument[]>();
    const visibleCourseIds = new Set(savedCourses.map((course) => course.course_id));

    for (const document of documents) {
      if (!visibleCourseIds.has(document.course_id)) {
        continue;
      }

      const current = lookup.get(document.course_id);
      if (current) {
        current.push(document);
      } else {
        lookup.set(document.course_id, [document]);
      }
    }

    for (const value of lookup.values()) {
      value.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    }

    return lookup;
  }, [documents, savedCourses]);
  const visibleDocumentCount = useMemo(
    () => savedCourses.reduce((total, course) => total + (documentMapByCourse.get(course.course_id)?.length ?? 0), 0),
    [documentMapByCourse, savedCourses],
  );
  const filteredBookmarkedPosts = useMemo(() => {
    const normalizedQuery = bookmarkedSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return bookmarkedPosts;
    }
    return bookmarkedPosts.filter((post) =>
      post.content.toLowerCase().includes(normalizedQuery)
      || post.course_id.toLowerCase().includes(normalizedQuery)
      || post.author_name.toLowerCase().includes(normalizedQuery),
    );
  }, [bookmarkedPosts, bookmarkedSearchQuery]);
  const filteredDiscussionActivityPosts = useMemo(() => {
    const normalizedQuery = activitySearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return discussionActivityPosts;
    }
    return discussionActivityPosts.filter((post) =>
      post.content.toLowerCase().includes(normalizedQuery)
      || post.course_id.toLowerCase().includes(normalizedQuery)
      || post.role_label.toLowerCase().includes(normalizedQuery),
    );
  }, [activitySearchQuery, discussionActivityPosts]);
  const bookmarkedTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredBookmarkedPosts.length / PAGE_SIZE)),
    [filteredBookmarkedPosts.length],
  );
  const activityTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredDiscussionActivityPosts.length / PAGE_SIZE)),
    [filteredDiscussionActivityPosts.length],
  );
  const paginatedBookmarkedPosts = useMemo(() => {
    const start = (bookmarkedPage - 1) * PAGE_SIZE;
    return filteredBookmarkedPosts.slice(start, start + PAGE_SIZE);
  }, [bookmarkedPage, filteredBookmarkedPosts]);
  const paginatedDiscussionActivityPosts = useMemo(() => {
    const start = (activityPage - 1) * PAGE_SIZE;
    return filteredDiscussionActivityPosts.slice(start, start + PAGE_SIZE);
  }, [activityPage, filteredDiscussionActivityPosts]);
  const bookmarkedPaginationItems = useMemo(
    () => getPaginationItems(bookmarkedPage, bookmarkedTotalPages),
    [bookmarkedPage, bookmarkedTotalPages],
  );
  const activityPaginationItems = useMemo(
    () => getPaginationItems(activityPage, activityTotalPages),
    [activityPage, activityTotalPages],
  );

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading profile...</p>;
  }

  if (error && !user) {
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

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

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
                {user.email && <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground">Email</p>
                  <p className="mt-1 text-base text-foreground">{user.email}</p>
                </div>}
              </CardContent>
            </Card>

            {false && <Card>
              <CardHeader>
                <CardTitle>Saved Courses</CardTitle>
                <CardDescription>Courses this student has bookmarked or joined.</CardDescription>
              </CardHeader>
              <CardContent>
                {savedCourseCount === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved courses yet.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground">
                        {effectiveShowArchivedCourses ? "Archived" : "Active"}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {visibleDocumentCount} published file{visibleDocumentCount === 1 ? "" : "s"}
                        </p>
                        <Button
                          type="button"
                          size="s"
                          variant="outline"
                          onClick={() => setShowArchivedCourses((current) => !current)}
                        >
                          {effectiveShowArchivedCourses
                            ? `Show Active (${activeSavedCourses.length})`
                            : `Show Archived (${archivedSavedCourses.length})`}
                        </Button>
                      </div>
                    </div>
                    {displayedSavedCourses.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {effectiveShowArchivedCourses ? "No archived courses." : "No active saved courses."}
                      </p>
                    ) : displayedSavedCourses.map((course) => (
                      <div
                        key={course.course_id}
                        className={`rounded-md border border-border/60 ${
                          effectiveShowArchivedCourses ? "bg-card/70" : "bg-card"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 p-3">
                          <button
                            type="button"
                            onClick={() => toggleCourseFolder(course.course_id)}
                            className="min-w-0 flex-1 text-left transition hover:opacity-90"
                          >
                            <p className="truncate text-sm font-medium text-foreground">
                              {Boolean(expandedCourseFolders[course.course_id]) ? "▾" : "▸"} {course.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {course.course_id} · {course.subject} · {course.year}
                            </p>
                          </button>
                        </div>
                        {Boolean(expandedCourseFolders[course.course_id]) && (
                          <div className="border-t border-border/60 p-3">
                            {(documentMapByCourse.get(course.course_id) ?? []).length === 0 ? (
                              <p className="text-sm text-muted-foreground">No published uploads in this class yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {(documentMapByCourse.get(course.course_id) ?? []).map((document) => (
                                  <Link
                                    key={document.document_id}
                                    href={`/courses/${encodeURIComponent(course.course_id)}`}
                                    className="block rounded-md border border-border/60 bg-card p-3 transition hover:border-secondary hover:shadow-sm"
                                  >
                                    <p className="truncate text-sm font-medium text-foreground">{document.title}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {document.original_filename} · {formatFileSize(document.file_size_bytes)} · {formatDateTime(document.created_at)}
                                    </p>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>}
          </section>

          <aside className="space-y-6 lg:col-span-4">
            {false && <Card>
              <CardHeader>
                <CardTitle>Bookmarked Posts</CardTitle>
                <CardDescription>Saved discussions from your courses.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-3">
                  <Input
                    value={bookmarkedSearchQuery}
                    onChange={(event) => {
                      setBookmarkedSearchQuery(event.target.value);
                      setBookmarkedPage(1);
                    }}
                    placeholder="Search bookmarked posts"
                    className="w-full"
                  />
                </div>
                {bookmarkedPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bookmarked posts yet.</p>
                ) : filteredBookmarkedPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bookmarked posts match your search.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      {paginatedBookmarkedPosts.map((post) => (
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
                    {bookmarkedTotalPages > 1 && (
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {bookmarkedPaginationItems.map((item, index) => {
                          if (item === "ellipsis") {
                            return (
                              <span key={`bookmarks-ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">
                                ...
                              </span>
                            );
                          }

                          const isActive = item === bookmarkedPage;
                          return (
                            <button
                              key={`bookmarks-page-${item}`}
                              type="button"
                              onClick={() => setBookmarkedPage(item)}
                              disabled={isActive}
                              className={`text-sm ${
                                isActive
                                  ? "font-semibold text-foreground"
                                  : "text-primary underline-offset-2 hover:underline"
                              } disabled:cursor-default`}
                            >
                              {item}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setBookmarkedPage((current) => Math.min(bookmarkedTotalPages, current + 1))}
                          disabled={bookmarkedPage >= bookmarkedTotalPages}
                          className="text-sm text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>}
            <Card>
              <CardHeader>
                <CardTitle>Discussion Activity</CardTitle>
                <CardDescription>Posts you created or replied in.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-3">
                  <Input
                    value={activitySearchQuery}
                    onChange={(event) => {
                      setActivitySearchQuery(event.target.value);
                      setActivityPage(1);
                    }}
                    placeholder="Search discussion activity"
                    className="w-full"
                  />
                </div>
                {discussionActivityPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No discussion activity yet.</p>
                ) : filteredDiscussionActivityPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No discussion activity matches your search.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      {paginatedDiscussionActivityPosts.map((post) => (
                        <Link
                          key={`activity-${post.course_id}-${post.post_id}`}
                          href={`/courses/${encodeURIComponent(post.course_id)}/forum/${post.post_id}`}
                          className="block"
                        >
                          <div className="rounded-md border border-border/60 bg-card p-3 transition hover:border-secondary hover:shadow-sm">
                            <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{post.course_id}</span>
                              <span>{formatDateTime(post.created_at)}</span>
                            </div>
                            <p className="text-sm text-foreground">{post.content}</p>
                            <p className="mt-2 text-xs text-muted-foreground">{post.role_label}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                    {activityTotalPages > 1 && (
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {activityPaginationItems.map((item, index) => {
                          if (item === "ellipsis") {
                            return (
                              <span key={`activity-ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">
                                ...
                              </span>
                            );
                          }

                          const isActive = item === activityPage;
                          return (
                            <button
                              key={`activity-page-${item}`}
                              type="button"
                              onClick={() => setActivityPage(item)}
                              disabled={isActive}
                              className={`text-sm ${
                                isActive
                                  ? "font-semibold text-foreground"
                                  : "text-primary underline-offset-2 hover:underline"
                              } disabled:cursor-default`}
                            >
                              {item}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setActivityPage((current) => Math.min(activityTotalPages, current + 1))}
                          disabled={activityPage >= activityTotalPages}
                          className="text-sm text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}
