import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import CourseForumSection from "@/components/course-overview/CourseForumSection";

export default async function CourseForumThreadPage({
  params,
}: {
  params: Promise<{ courseId: string; postId: string }>;
}) {
  const { courseId, postId } = await params;
  const parsedPostId = Number(postId);

  if (!courseId || !Number.isFinite(parsedPostId) || parsedPostId <= 0) {
    return <div>Invalid forum thread route.</div>;
  }

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">Course Workspace</p>
            <h1 className="font-heading text-3xl font-bold">Discussion Thread</h1>
            <p className="text-sm text-muted-foreground">Course ID: {courseId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/courses/${encodeURIComponent(courseId)}`}>
              <Button variant="secondary" size="s">Back to Course Overview</Button>
            </Link>
            <Link href="/courses/course_search">
              <Button size="s">Course Search</Button>
            </Link>
          </div>
        </header>

        <Separator />

        <CourseForumSection courseId={courseId} focusPostId={parsedPostId} />
      </div>
    </main>
  );
}
