import { Metadata } from "next";
import CourseOverview from "@/components/course-overview/CourseOverview";

export const metadata: Metadata = {
  title: "Course Overview",
  description: "Central hub for all materials, discussions, and information related to a specific course.",
};

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  if (!courseId) {
    return <div>Error: Course ID not provided.</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-10">
      <header>
        <h1 className="text-4xl font-bold text-gray-900">Course Overview: {courseId}</h1>
        <p className="text-lg text-gray-600 mt-2">Your central hub for everything related to this course.</p>
      </header>

      <CourseOverview courseId={courseId} />
    </div>
  );
}
