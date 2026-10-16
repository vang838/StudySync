"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ForumPost = {
  post_id: number;
  course_id: string;
  user_id: number;
  author_name: string;
  parent_post_id: number | null;
  content: string;
  created_at: string;
  updated_at: string;
  is_bookmarked: boolean;
  is_liked: boolean;
  like_count: number;
  reply_count: number;
  replies: ForumPost[];
};

type CourseForumSectionProps = {
  courseId: string;
  focusPostId?: number;
};

type DiscussionFilter = "all" | "mine" | "bookmarked";
type SortOption = "newest" | "popular";

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

const PAGE_SIZE = 12;

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
  const [searchQuery, setSearchQuery] = useState("");
  const [discussionFilter, setDiscussionFilter] = useState<DiscussionFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("newest");

  const focusMode = typeof focusPostId === "number";

  const getCurrentUserId = (): number => {
    if (typeof window === "undefined") {
      return 1;
    }
    const raw = window.localStorage.getItem("user_id");
    const parsed = Number(raw ?? "1");
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };

  const buildForumQueryString = useCallback((): string => {
    const params = new URLSearchParams();
    const currentUserId = getCurrentUserId();

    params.set("user_id", String(currentUserId));
    params.set("sort", sortOption);

    const trimmedSearch = searchQuery.trim();
    if (trimmedSearch.length > 0) {
      params.set("q", trimmedSearch);
    }

    if (discussionFilter === "mine") {
      params.set("author_user_id", String(currentUserId));
    } else if (discussionFilter === "bookmarked") {
      params.set("bookmarked_only", "true");
    }

    return params.toString();
  }, [discussionFilter, searchQuery, sortOption]);

  const loadForumData = useCallback(async () => {
    setForumLoading(true);
    setForumError(null);
    try {
      const queryString = buildForumQueryString();
      const currentUserId = getCurrentUserId();
      const listResponse = await fetch(`/api/courses/${encodeURIComponent(courseId)}/forum/posts?${queryString}`);

      if (!listResponse.ok) {
        const body = await listResponse.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Failed to load forum posts (HTTP ${listResponse.status})`);
      }

      const listData = await listResponse.json();
      setForumPosts(Array.isArray(listData) ? (listData as ForumPost[]) : []);

      if (focusMode && focusPostId !== undefined) {
        const focusedResponse = await fetch(
          `/api/courses/${encodeURIComponent(courseId)}/forum/posts/${focusPostId}?user_id=${currentUserId}`,
        );
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
  }, [buildForumQueryString, courseId, focusMode, focusPostId]);

  useEffect(() => {
    void loadForumData();
  }, [loadForumData]);

  useEffect(() => {
    setPage(1);
  }, [courseId, focusPostId, searchQuery, discussionFilter, sortOption]);

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

  const toggleBookmark = async (postId: number, currentlyBookmarked: boolean) => {
    setSubmitting(true);
    setForumError(null);
    try {
      const userId = getCurrentUserId();
      const response = await fetch(
        `/api/courses/${encodeURIComponent(courseId)}/forum/posts/${postId}/bookmark?user_id=${userId}`,
        { method: currentlyBookmarked ? "DELETE" : "POST" },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Unable to update bookmark (HTTP ${response.status})`);
      }
      await loadForumData();
    } catch (bookmarkError) {
      const message = bookmarkError instanceof Error ? bookmarkError.message : "Unable to update bookmark.";
      setForumError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLike = async (postId: number, currentlyLiked: boolean) => {
    setSubmitting(true);
    setForumError(null);
    try {
      const userId = getCurrentUserId();
      const response = await fetch(
        `/api/courses/${encodeURIComponent(courseId)}/forum/posts/${postId}/like?user_id=${userId}`,
        { method: currentlyLiked ? "DELETE" : "POST" },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Unable to update like (HTTP ${response.status})`);
      }
      await loadForumData();
    } catch (likeError) {
      const message = likeError instanceof Error ? likeError.message : "Unable to update like.";
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
            disabled={submitting}
          >
            Reply
          </Button>
          <Button
            size="s"
            variant={post.is_bookmarked ? "secondary" : "outline"}
            onClick={() => {
              void toggleBookmark(post.post_id, post.is_bookmarked);
            }}
            disabled={submitting}
          >
            {post.is_bookmarked ? "Bookmarked" : "Bookmark"}
          </Button>
          <Button
            size="s"
            variant={post.is_liked ? "secondary" : "outline"}
            onClick={() => {
              void toggleLike(post.post_id, post.is_liked);
            }}
            disabled={submitting}
          >
            {post.is_liked ? "Liked" : "Like"} ({post.like_count})
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
                disabled={submitting}
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

  const paginationItems = useMemo(() => {
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
  }, [page, totalPages]);

  const paginatedPosts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return forumPosts.slice(start, start + PAGE_SIZE);
  }, [forumPosts, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const emptyStateMessage = useMemo(() => {
    if (discussionFilter === "bookmarked") {
      return "No bookmarked discussions match your filters yet.";
    }
    if (searchQuery.trim().length > 0) {
      return "No discussions match your search.";
    }
    return "No discussion threads yet.";
  }, [discussionFilter, searchQuery]);

  const renderForumSidebarPanel = (): React.ReactNode => (
    <Card>
      <CardHeader>
        <CardTitle>Discussion Forum</CardTitle>
        <CardDescription>Talk through homework, readings, and exam prep.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {forumError && <p className="text-sm font-medium text-destructive">{forumError}</p>}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search discussions"
            className="sm:col-span-2"
          />
          <select
            value={discussionFilter}
            onChange={(event) => setDiscussionFilter(event.target.value as DiscussionFilter)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Discussions</option>
            <option value="mine">My Discussions</option>
            <option value="bookmarked">Bookmarked</option>
          </select>
          <select
            value={sortOption}
            onChange={(event) => setSortOption(event.target.value as SortOption)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="popular">Most Popular</option>
          </select>
        </div>

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
            {emptyStateMessage}
          </div>
        )}

        {!forumLoading && paginatedPosts.length > 0 && (
          <div className="space-y-3">
            {paginatedPosts.map((post) => (
              <Link
                key={post.post_id}
                href={`/courses/${encodeURIComponent(courseId)}/forum/${post.post_id}`}
                className="block"
              >
                <div className="rounded-md border border-border/60 bg-card p-3 transition hover:border-secondary hover:shadow-sm">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{post.author_name}</span>
                    <span>{formatDateTime(post.created_at)}</span>
                  </div>
                  <p className="text-sm text-foreground">{post.content}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {countReplies(post)} repl{countReplies(post) === 1 ? "y" : "ies"}
                    </span>
                    <Button
                      size="xs"
                      variant={post.is_bookmarked ? "secondary" : "outline"}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void toggleBookmark(post.post_id, post.is_bookmarked);
                      }}
                      disabled={submitting}
                    >
                      {post.is_bookmarked ? "Bookmarked" : "Bookmark"}
                    </Button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!forumLoading && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {paginationItems.map((item, index) => {
              if (item === "ellipsis") {
                return (
                  <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">
                    ...
                  </span>
                );
              }

              const isActive = item === page;
              return (
                <button
                  key={`page-${item}`}
                  type="button"
                  onClick={() => setPage(item)}
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
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="text-sm text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
            >
              Next
            </button>
          </div>
        )}

      </CardContent>
    </Card>
  );

  if (!focusMode) {
    return <>{renderForumSidebarPanel()}</>;
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
        {renderForumSidebarPanel()}
      </aside>
    </div>
  );
}
