"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ForumPost = {
  post_id: number;
  course_id: string;
  user_id: number;
  author_name: string;
  parent_post_id: number | null;
  content: string;
  created_at: string;
  updated_at: string;
  replies: ForumPost[];
};

type CourseForumSectionProps = {
  courseId: string;
  focusPostId?: number;
};

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
};

const countReplies = (post: ForumPost): number => {
  if (post.replies.length === 0) {
    return 0;
  }
  return post.replies.length + post.replies.reduce((total, reply) => total + countReplies(reply), 0);
};

const PAGE_SIZE = 15;

export default function CourseForumSection({ courseId, focusPostId }: CourseForumSectionProps) {
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [focusedPost, setFocusedPost] = useState<ForumPost | null>(null);
  const [forumLoading, setForumLoading] = useState(true);
  const [forumError, setForumError] = useState<string | null>(null);
  const [newPostContent, setNewPostContent] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [activeReplyPostId, setActiveReplyPostId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);

  const focusMode = typeof focusPostId === "number";

  const getCurrentUserId = (): number => {
    if (typeof window === "undefined") {
      return 1;
    }
    const raw = window.localStorage.getItem("user_id");
    const parsed = Number(raw ?? "1");
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };

  const loadForumData = useCallback(async () => {
    setForumLoading(true);
    setForumError(null);
    try {
      const listResponse = await fetch(`/api/courses/${encodeURIComponent(courseId)}/forum/posts`);
      if (!listResponse.ok) {
        const body = await listResponse.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Failed to load forum posts (HTTP ${listResponse.status})`);
      }
      const listData = await listResponse.json();
      setForumPosts(Array.isArray(listData) ? (listData as ForumPost[]) : []);

      if (focusMode && focusPostId !== undefined) {
        const focusedResponse = await fetch(`/api/courses/${encodeURIComponent(courseId)}/forum/posts/${focusPostId}`);
        if (!focusedResponse.ok) {
          const body = await focusedResponse.json().catch(() => ({}));
          throw new Error(body?.detail ?? `Failed to load forum thread (HTTP ${focusedResponse.status})`);
        }
        const focusedData = (await focusedResponse.json()) as ForumPost;
        setFocusedPost(focusedData);
      } else {
        setFocusedPost(null);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load forum posts.";
      setForumError(message);
    } finally {
      setForumLoading(false);
    }
  }, [courseId, focusMode, focusPostId]);

  useEffect(() => {
    void loadForumData();
  }, [loadForumData]);

  useEffect(() => {
    setPage(1);
  }, [courseId, focusPostId]);

  const submitForumPost = async (content: string, parentPostId?: number) => {
    setSubmitting(true);
    setForumError(null);
    try {
      const payload: { user_id: number; content: string; parent_post_id?: number } = {
        user_id: getCurrentUserId(),
        content: content.trim(),
      };
      if (parentPostId !== undefined) {
        payload.parent_post_id = parentPostId;
      }

      const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}/forum/posts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Unable to submit post (HTTP ${response.status})`);
      }

      setNewPostContent("");
      if (parentPostId !== undefined) {
        setReplyDrafts((prev) => ({ ...prev, [parentPostId]: "" }));
        setActiveReplyPostId(null);
      }
      await loadForumData();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to submit forum post.";
      setForumError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const savePostEdits = async (postId: number) => {
    setSubmitting(true);
    setForumError(null);
    try {
      const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}/forum/posts/${postId}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          user_id: getCurrentUserId(),
          content: editDraft.trim(),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Unable to edit post (HTTP ${response.status})`);
      }

      setEditingPostId(null);
      setEditDraft("");
      await loadForumData();
    } catch (editError) {
      const message = editError instanceof Error ? editError.message : "Unable to edit forum post.";
      setForumError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const deletePost = async (postId: number) => {
    setSubmitting(true);
    setForumError(null);
    try {
      const userId = getCurrentUserId();
      const response = await fetch(
        `/api/courses/${encodeURIComponent(courseId)}/forum/posts/${postId}?user_id=${userId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Unable to delete post (HTTP ${response.status})`);
      }
      await loadForumData();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete forum post.";
      setForumError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderPostThread = (post: ForumPost, depth: number): React.ReactNode => {
    const isOwnPost = post.user_id === getCurrentUserId();
    const isEditing = editingPostId === post.post_id;
    const replyDraft = replyDrafts[post.post_id] ?? "";
    const showReplyEditor = activeReplyPostId === post.post_id;
    const leftPaddingClass = depth > 0 ? "ml-4 border-l pl-4" : "";

    return (
      <div key={post.post_id} className={`space-y-3 rounded-md border border-border/60 bg-card p-3 ${leftPaddingClass}`}>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{post.author_name}</span>
            <span>{formatDateTime(post.created_at)}</span>
          </div>
          {!isEditing && <p className="text-sm text-foreground">{post.content}</p>}
          {isEditing && (
            <div className="space-y-2">
              <textarea
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editDraft}
                onChange={(event) => setEditDraft(event.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="s"
                  onClick={() => {
                    void savePostEdits(post.post_id);
                  }}
                  disabled={submitting || editDraft.trim().length === 0}
                >
                  Save
                </Button>
                <Button
                  size="s"
                  variant="outline"
                  onClick={() => {
                    setEditingPostId(null);
                    setEditDraft("");
                  }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="s"
            variant="outline"
            onClick={() => setActiveReplyPostId(showReplyEditor ? null : post.post_id)}
          >
            Reply
          </Button>
          {isOwnPost && !isEditing && (
            <>
              <Button
                size="s"
                variant="outline"
                onClick={() => {
                  setEditingPostId(post.post_id);
                  setEditDraft(post.content);
                }}
              >
                Edit
              </Button>
              <Button
                size="s"
                variant="destructive"
                onClick={() => {
                  void deletePost(post.post_id);
                }}
                disabled={submitting}
              >
                Delete
              </Button>
            </>
          )}
        </div>

        {showReplyEditor && (
          <div className="space-y-2 rounded-md border border-dashed p-3">
            <textarea
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Write a reply..."
              value={replyDraft}
              onChange={(event) =>
                setReplyDrafts((prev) => ({ ...prev, [post.post_id]: event.target.value }))
              }
            />
            <div className="flex gap-2">
              <Button
                size="s"
                onClick={() => {
                  void submitForumPost(replyDraft, post.post_id);
                }}
                disabled={submitting || replyDraft.trim().length === 0}
              >
                Post Reply
              </Button>
              <Button
                size="s"
                variant="outline"
                onClick={() => setActiveReplyPostId(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {post.replies.length > 0 && (
          <div className="space-y-3">
            {post.replies.map((reply) => renderPostThread(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const focusThread = useMemo(() => {
    if (!focusMode) {
      return null;
    }
    return focusedPost;
  }, [focusMode, focusedPost]);

  const totalPages = useMemo(() => {
    if (forumPosts.length === 0) {
      return 1;
    }
    return Math.ceil(forumPosts.length / PAGE_SIZE);
  }, [forumPosts.length]);

  const paginatedPosts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return forumPosts.slice(start, start + PAGE_SIZE);
  }, [forumPosts, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const renderForumSidebarPanel = (showHeaderAction: boolean): React.ReactNode => (
    <Card>
      <CardHeader>
        <CardTitle>Discussion Forum</CardTitle>
        <CardDescription>Talk through homework, readings, and exam prep.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {forumError && <p className="text-sm font-medium text-destructive">{forumError}</p>}

        <div className="space-y-2">
          <textarea
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Ask a question or share a concept with your course community..."
            value={newPostContent}
            onChange={(event) => setNewPostContent(event.target.value)}
          />
          <Button
            className="w-full"
            onClick={() => {
              void submitForumPost(newPostContent);
            }}
            disabled={submitting || newPostContent.trim().length === 0}
          >
            Create Post
          </Button>
        </div>

        {forumLoading && <p className="text-sm text-muted-foreground">Loading discussion threads...</p>}

        {!forumLoading && paginatedPosts.length === 0 && (
          <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
            No discussion threads yet.
          </div>
        )}

        {!forumLoading && paginatedPosts.length > 0 && (
          <div className="space-y-3">
            {paginatedPosts.map((post) => (
              <div key={post.post_id} className="rounded-md border border-border/60 bg-card p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{post.author_name}</span>
                  <span>{formatDateTime(post.created_at)}</span>
                </div>
                <p className="text-sm text-foreground">{post.content}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {countReplies(post)} repl{countReplies(post) === 1 ? "y" : "ies"}
                  </span>
                  <Link href={`/courses/${encodeURIComponent(courseId)}/forum/${post.post_id}`}>
                    <Button size="s" variant="outline">Open discussion</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {!forumLoading && totalPages > 1 && (
          <div className="flex items-center justify-between gap-2">
            <Button
              size="s"
              variant="outline"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <Button
              size="s"
              variant="outline"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        )}

        {showHeaderAction && (
          <Link href={`/courses/${encodeURIComponent(courseId)}`}>
            <Button size="s" variant="secondary">Back to course overview</Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );

  if (!focusMode) {
    return <>{renderForumSidebarPanel(false)}</>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <section className="space-y-6 lg:col-span-8">
        <Card>
          <CardHeader>
            <CardTitle>Focused Thread</CardTitle>
            <CardDescription>Read and continue this discussion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {forumLoading && <p className="text-sm text-muted-foreground">Loading discussion thread...</p>}
            {!forumLoading && focusThread && renderPostThread(focusThread, 0)}
            {!forumLoading && !focusThread && (
              <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                This discussion thread could not be found.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      <aside className="space-y-6 lg:col-span-4">
        {renderForumSidebarPanel(true)}
      </aside>
    </div>
  );
}
