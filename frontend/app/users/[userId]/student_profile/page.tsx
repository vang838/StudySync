"use client";

import Link from "next/link";
import Image from "next/image";
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
  password_needs_update: boolean;
  forum_points: number;
  forum_point_values?: {
    post_or_reply: number;
    like_received: number;
  };
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
  published_by?: { user_id: number; name: string }[];
  is_published_by_current_user: boolean;
};

type DocumentDeleteResult = {
  document_id: string;
  deleted: boolean;
  storage_cleanup_status: "complete" | "partial";
  storage_cleanup_failed_keys: string[];
};

type DocumentPublishResult = {
  document_id: string;
  is_published: boolean;
  is_published_by_current_user: boolean;
  published_by?: { user_id: number; name: string }[];
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

export default function StudentProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [expandedCourseFolders, setExpandedCourseFolders] = useState<Record<string, boolean>>({});
  const [bookmarkedPosts, setBookmarkedPosts] = useState<BookmarkedForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [archivingCourseIds, setArchivingCourseIds] = useState<string[]>([]);
  const [publishingDocumentIds, setPublishingDocumentIds] = useState<string[]>([]);
  const [deletingDocumentIds, setDeletingDocumentIds] = useState<string[]>([]);
  const [showArchivedCourses, setShowArchivedCourses] = useState(false);
  const [showPasswordBanner, setShowPasswordBanner] = useState(true);
  const [pendingPublishChange, setPendingPublishChange] = useState<{
    document: UserDocument;
    isPublished: boolean;
    message: string;
  } | null>(null);

  const setCourseArchivedState = async (courseId: string, shouldArchive: boolean) => {
    if (!activeUserId || archivingCourseIds.includes(courseId)) {
      return;
    }

    setArchivingCourseIds((current) => [...current, courseId]);
    try {
      const response = await fetch(
        `/api/courses/${encodeURIComponent(courseId)}/archive?user_id=${activeUserId}`,
        { method: shouldArchive ? "POST" : "DELETE" },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Failed to update archive state (HTTP ${response.status})`);
      }
      setSavedCourses((current) =>
        current.map((course) => (
          course.course_id === courseId
            ? { ...course, is_archived: shouldArchive }
            : course
        )),
      );
    } catch (archiveError) {
      const message = archiveError instanceof Error ? archiveError.message : "Unable to update course archive state.";
      setError(message);
    } finally {
      setArchivingCourseIds((current) => current.filter((id) => id !== courseId));
    }
  };

  const toggleCourseFolder = (courseId: string) => {
    setExpandedCourseFolders((current) => ({
      ...current,
      [courseId]: !current[courseId],
    }));
  };

  const applyDocumentPublishState = async (documentToUpdate: UserDocument, isPublished: boolean) => {
    if (publishingDocumentIds.includes(documentToUpdate.document_id)) {
      return;
    }
    setPendingPublishChange(null);
    setPublishingDocumentIds((current) => [...current, documentToUpdate.document_id]);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentToUpdate.document_id)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ is_published: isPublished }),
      });
      const body = (await response.json().catch(() => null)) as DocumentPublishResult | { detail?: string } | null;

      if (!response.ok) {
        throw new Error(
          body && "detail" in body && typeof body.detail === "string"
            ? body.detail
            : `Failed to update publish state (HTTP ${response.status})`,
        );
      }

      if (!body || !("is_published" in body)) {
        throw new Error("Invalid publish state response.");
      }

      setDocuments((current) =>
        current.map((document) => (
          document.document_id === documentToUpdate.document_id
            ? {
                ...document,
                is_published: body.is_published,
                is_published_by_current_user: body.is_published_by_current_user,
                published_by: body.published_by,
              }
            : document
        )),
      );
    } catch (publishError) {
      const message = publishError instanceof Error ? publishError.message : "Unable to update publish state.";
      setError(message);
    } finally {
      setPublishingDocumentIds((current) => current.filter((id) => id !== documentToUpdate.document_id));
    }
  };

  const setDocumentPublishState = (documentToUpdate: UserDocument, isPublished: boolean) => {
    if (publishingDocumentIds.includes(documentToUpdate.document_id)) {
      return;
    }
    const publisherCount = documentToUpdate.published_by?.length ?? 0;
    const message = isPublished
      ? publisherCount > 0
        ? `This item is already published by ${publisherCount} other user${publisherCount === 1 ? "" : "s"}. Your copy will also be available to the class.`
        : "This will publish your copy to the class for everyone to use."
      : publisherCount > 1
        ? `Your copy will become private, but the item will stay available because ${publisherCount - 1} other user${publisherCount === 2 ? "" : "s"} still publish it.`
        : "You are the only person publishing this item. Making your copy private will remove it from the class for everyone.";
    setPendingPublishChange({ document: documentToUpdate, isPublished, message });
  };

  const deleteDocument = async (documentId: string) => {
    if (deletingDocumentIds.includes(documentId)) {
      return;
    }
    setDeletingDocumentIds((current) => [...current, documentId]);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => null)) as DocumentDeleteResult | { detail?: string } | null;

      if (!response.ok) {
        throw new Error(
          body && "detail" in body && typeof body.detail === "string"
            ? body.detail
            : `Failed to delete document (HTTP ${response.status})`,
        );
      }

      if (
        body
        && "storage_cleanup_status" in body
        && body.storage_cleanup_status === "partial"
        && Array.isArray(body.storage_cleanup_failed_keys)
      ) {
        setError(
          `Document removed from StudySync, but ${body.storage_cleanup_failed_keys.length} storage object(s) could not be deleted.`,
        );
      }

      setDocuments((current) => current.filter((document) => document.document_id !== documentId));
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete document.";
      setError(message);
    } finally {
      setDeletingDocumentIds((current) => current.filter((id) => id !== documentId));
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      const { userId } = await params;
      setResolvedUserId(userId);
      setLoading(true);
      setError(null);

      try {
        const authenticatedUserId = localStorage.getItem("user_id");
        const isAuthenticated = localStorage.getItem("auth_session") === "authenticated";
        if (
          !isAuthenticated
          || !authenticatedUserId
          || authenticatedUserId !== userId
        ) {
          throw new Error("This private profile is only available to the signed-in user.");
        }

        const [userResponse, coursesResponse, documentsResponse] = await Promise.all([
          fetch(`/api/users/${encodeURIComponent(userId)}`),
          fetch(`/api/courses/saved?user_id=${encodeURIComponent(userId)}&include_archived=true`),
          fetch("/api/documents?published_only=false"),
        ]);

        if (!userResponse.ok) {
          const body = await userResponse.json().catch(() => ({}));
          throw new Error(body?.detail ?? `Failed to load user profile (HTTP ${userResponse.status})`);
        }

        if (!coursesResponse.ok) {
          const body = await coursesResponse.json().catch(() => ({}));
          throw new Error(body?.detail ?? `Failed to load saved courses (HTTP ${coursesResponse.status})`);
        }
        if (!documentsResponse.ok) {
          const body = await documentsResponse.json().catch(() => ({}));
          throw new Error(body?.detail ?? `Failed to load documents (HTTP ${documentsResponse.status})`);
        }

        const userData = (await userResponse.json()) as UserProfile;
        const courseData = (await coursesResponse.json()) as SavedCourse[];
        const documentData = (await documentsResponse.json()) as UserDocument[];
        const normalizedCourseData = Array.isArray(courseData)
          ? courseData.map((course) => ({ ...course, is_archived: Boolean(course.is_archived) }))
          : [];
        const normalizedDocumentData = Array.isArray(documentData) ? documentData : [];
        const activeCourses = normalizedCourseData.filter((course) => !course.is_archived);
        const bookmarkResponses = await Promise.all(
          activeCourses.map((course) =>
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
                ?? `Failed to load bookmarked posts for ${activeCourses[index]?.course_id ?? "a course"} (HTTP ${bookmarkResponse.status})`,
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
        setActiveUserId(userData.user_id);
        setSavedCourses(normalizedCourseData);
        setDocuments(normalizedDocumentData);
        setExpandedCourseFolders(
          Object.fromEntries(normalizedCourseData.map((course) => [course.course_id, false])),
        );
        setBookmarkedPosts(flattenedBookmarkedPosts);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load profile.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [params]);

  const savedCourseCount = useMemo(() => savedCourses.filter((course) => !course.is_archived).length, [savedCourses]);
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
    for (const values of lookup.values()) {
      values.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    }
    return lookup;
  }, [documents, savedCourses]);
  const visibleDocumentCount = useMemo(
    () => savedCourses.reduce((total, course) => total + (documentMapByCourse.get(course.course_id)?.length ?? 0), 0),
    [documentMapByCourse, savedCourses],
  );

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading profile...</p>;
  }

  if (error) {
    const isPrivateProfileError = error === "This private profile is only available to the signed-in user.";
    if (isPrivateProfileError) {
      return (
        <main className="flex min-h-full items-center justify-center bg-background px-6 py-12 text-foreground">
          <div className="flex max-w-lg flex-col items-center gap-5 text-center">
            <Image
              src="/finger-shake-judge-judy.gif"
              alt="Judge Judy shaking her finger"
              width={420}
              height={280}
              className="rounded-xl border border-border object-cover shadow-sm"
              unoptimized
            />
            <div>
              <h1 className="font-heading text-3xl font-bold">You shouldn&apos;t be here.</h1>
              <p className="mt-2 text-muted-foreground">
                This is a private profile. Please sign in as the account owner to continue.
              </p>
            </div>
            <Link
              href="/auth/signin"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Go to sign in
            </Link>
          </div>
        </main>
      );
    }
    return <p className="text-sm font-medium text-destructive">{error}</p>;
  }

  if (!user) {
    return <p className="text-sm text-muted-foreground">No profile data found.</p>;
  }

  return (
    <>
      {pendingPublishChange && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPendingPublishChange(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-change-title"
            className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-xl">
              {pendingPublishChange.isPublished ? "✨" : "🔒"}
            </div>
            <h2 id="publish-change-title" className="text-lg font-semibold text-foreground">
              {pendingPublishChange.isPublished ? "Share this with the class?" : "Change publishing settings?"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              <span className="font-medium text-foreground">{pendingPublishChange.document.title}</span>
              {" — "}
              {pendingPublishChange.message}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setPendingPublishChange(null)}
              >
                Not yet
              </Button>
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  void applyDocumentPublishState(
                    pendingPublishChange.document,
                    pendingPublishChange.isPublished,
                  );
                }}
              >
                {pendingPublishChange.isPublished ? "Publish my copy" : "Make my copy private"}
              </Button>
            </div>
          </div>
        </div>
      )}
      <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">Student Profile</p>
            <h1 className="font-heading text-3xl font-bold">{user.full_name}</h1>
            <p className="text-sm text-muted-foreground">User ID: {resolvedUserId ?? user.user_id}</p>
            <p className="text-sm text-muted-foreground">Forum Points: {user.forum_points}</p>
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

        {user.password_needs_update && showPasswordBanner && (
          <div className="relative rounded-md border border-amber-300 bg-amber-50 px-4 py-3 pr-10 text-sm text-amber-950">
            <button
              type="button"
              onClick={() => setShowPasswordBanner(false)}
              className="absolute right-3 top-2 text-lg leading-none text-amber-800"
              aria-label="Dismiss password reminder"
            >
              ×
            </button>
            <p className="font-semibold">Your password needs an update.</p>
            <p className="mt-1">
              Please choose a stronger password with an uppercase letter and special character.
              {" "}
              <Link className="font-semibold underline" href={`/users/${user.user_id}/settings`}>
                Update your password
              </Link>
            </p>
          </div>
        )}

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
                  {archivedSavedCourses.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {archivedSavedCourses.length} archived
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground">Forum points balance</p>
                  <p className="mt-1 text-base text-foreground">{user.forum_points}</p>
                  {user.forum_point_values && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      +{user.forum_point_values.post_or_reply} per post/reply · +{user.forum_point_values.like_received} per like received
                    </p>
                  )}
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
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground">
                        {effectiveShowArchivedCourses ? "Archived" : "Active"}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {visibleDocumentCount} upload{visibleDocumentCount === 1 ? "" : "s"}
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
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleCourseFolder(course.course_id)}
                              className="shrink-0 text-3xl font-black leading-none text-foreground transition hover:opacity-80"
                              aria-label={Boolean(expandedCourseFolders[course.course_id]) ? "Collapse course folder" : "Expand course folder"}
                              aria-expanded={Boolean(expandedCourseFolders[course.course_id])}
                            >
                              {Boolean(expandedCourseFolders[course.course_id]) ? "▾" : "▸"}
                            </button>
                            <Link
                              href={`/courses/${encodeURIComponent(course.course_id)}`}
                              className="min-w-0 flex-1 text-left transition hover:opacity-90"
                            >
                              <p className="truncate text-sm font-medium text-foreground">{course.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {course.course_id} · {course.subject} · {course.year}
                              </p>
                            </Link>
                          </div>
                          <Button
                            type="button"
                            size="s"
                            variant={effectiveShowArchivedCourses ? "secondary" : "outline"}
                            disabled={archivingCourseIds.includes(course.course_id)}
                            onClick={() => {
                              void setCourseArchivedState(course.course_id, !effectiveShowArchivedCourses);
                            }}
                          >
                            {effectiveShowArchivedCourses ? "Restore" : "Archive"}
                          </Button>
                        </div>
                        {Boolean(expandedCourseFolders[course.course_id]) && (
                          <div className="border-t border-border/60 p-3">
                            {(documentMapByCourse.get(course.course_id) ?? []).length === 0 ? (
                              <div className="flex flex-wrap items-center gap-3">
                                <p className="text-sm text-muted-foreground">No uploads in this class yet.</p>
                                <Link
                                  href={`/users/${encodeURIComponent(String(activeUserId ?? user.user_id))}/uploads`}
                                  className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                                >
                                  Upload document
                                </Link>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {(documentMapByCourse.get(course.course_id) ?? []).map((document) => (
                                  <div
                                    key={document.document_id}
                                    className="rounded-md border border-border/60 bg-card p-3"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-foreground">{document.title}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                          {document.original_filename} · {formatFileSize(document.file_size_bytes)} · {formatDateTime(document.created_at)}
                                        </p>
                                      </div>
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                          document.is_published
                                            ? "bg-emerald-100 text-emerald-700"
                                            : "bg-muted text-muted-foreground"
                                        }`}
                                      >
                                        {document.is_published ? "Published" : "Private"}
                                      </span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void setDocumentPublishState(
                                            document,
                                            !document.is_published_by_current_user,
                                          );
                                        }}
                                        disabled={publishingDocumentIds.includes(document.document_id)}
                                        className="text-xs font-medium text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                                      >
                                        {publishingDocumentIds.includes(document.document_id)
                                          ? "Updating..."
                                        : document.is_published_by_current_user
                                            ? "Make my copy private"
                                          : "Publish my copy"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void deleteDocument(document.document_id);
                                        }}
                                        disabled={deletingDocumentIds.includes(document.document_id)}
                                        className="text-xs font-medium text-destructive underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                                      >
                                        {deletingDocumentIds.includes(document.document_id) ? "Removing..." : "Remove"}
                                      </button>
                                    </div>
                                  </div>
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
          </aside>
        </div>
      </div>
      </main>
    </>
  );
}
