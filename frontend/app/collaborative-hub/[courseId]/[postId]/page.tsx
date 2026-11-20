
import Link from "next/link";
import { notFound } from "next/navigation";

type ForumPost = {
    post_id: number;
    author_name: string;
    content: string;
    created_at: string;
    replies: ForumPost[];
};

function ThreadPost({ post, nested = false }: { post: ForumPost; nested?: boolean }) {
    return (
        <div className={nested ? "ml-4 border-l border-border pl-4" : ""}>
            <article className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{post.author_name}</span>
                    <time dateTime={post.created_at}>
                        {new Date(post.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                        })}
                    </time>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
                    {post.content}
                </p>
            </article>
            {post.replies.length > 0 && (
                <div className="mt-3 space-y-3">
                    {post.replies.map((reply) => (
                        <ThreadPost key={reply.post_id} post={reply} nested />
                    ))}
                </div>
            )}
        </div>
    );
}

export default async function PublicDiscussionPage({
    params,
}: {
    params: Promise<{ courseId: string; postId: string }>;
}) {
    const { courseId, postId } = await params;
    const normalizedCourseId = decodeURIComponent(courseId);
    const numericPostId = Number(postId);

    if (!Number.isSafeInteger(numericPostId) || numericPostId <= 0) notFound();

    const backendBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";
    const targetUrl = new URL(
        `/api/v1/courses/${encodeURIComponent(normalizedCourseId)}/forum/posts/${numericPostId}`,
        backendBaseUrl
    );

    let response: Response;

    try {
        response = await fetch(targetUrl, { cache: "no-store" });
    } catch {
        return (
            <main className="mx-auto max-w-4xl px-6 py-10">
                <p role="alert" className="text-destructive">Unable to load this discussion.</p>
                <Link href="/collaborative-hub" className="mt-4 inline-block text-secondary hover:underline">
                    Back to Collaborative Hub
                </Link>
            </main>
        );
    }

    if (response.status === 404) notFound();

    if (!response.ok) {
        return (
            <main className="mx-auto max-w-4xl px-6 py-10">
                <p role="alert" className="text-destructive">Unable to load this discussion.</p>
                <Link href="/collaborative-hub" className="mt-4 inline-block text-secondary hover:underline">
                    Back to Collaborative Hub
                </Link>
            </main>
        );
    }

    const post = (await response.json()) as ForumPost;

    return (
        <main className="min-h-screen bg-background px-6 py-10 text-foreground">
            <div className="mx-auto max-w-4xl space-y-6">
                <Link href="/collaborative-hub" className="text-sm font-medium text-secondary hover:underline">
                    ← Back to Collaborative Hub
                </Link>

                <header>
                    <p className="text-sm text-muted-foreground">Course discussion · {normalizedCourseId}</p>
                    <h1 className="font-heading mt-2 text-3xl font-bold">Discussion Thread</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        This is a read-only view of the conversation.
                    </p>
                </header>

                <ThreadPost post={post} />

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
                    <h2 className="text-lg font-semibold text-slate-900">Join this conversation</h2>
                    <p className="mt-2 text-sm text-slate-700">
                        Sign in and save this course to contribute to the discussion.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <Link href="/auth/signin" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                            Sign In
                        </Link>
                        <Link href="/auth/signup" className="rounded-md border border-primary px-4 py-2 text-sm font-semibold text-primary">
                            Create Account
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
