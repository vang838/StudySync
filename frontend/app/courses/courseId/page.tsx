// frontend/app/courses/[courseId]/page.tsx
import { Metadata } from "next";
import CourseOverview from "@/components/course-overview/CourseOverview";

// Generate static metadata for the page. You might need to adjust this
// based on how you fetch course data.
export const metadata: Metadata = {
  title: "Course Overview",
  description: "Central hub for all materials, discussions, and information related to a specific course.",
};

export default function CourseDetailPage({ params }: { params: { courseId: string } }) {
  const courseId = params.courseId;

  // In a real application, you would fetch the course data here:
  // const { courseInfo, professor, materials, forumPosts } = await getCourseData(courseId);
  
  if (!courseId) {
    return <div>Error: Course ID not provided.</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-10">
      <header>
        <h1 className="text-4xl font-bold text-gray-900">Course Overview: {courseId}</h1>
        <p className="text-lg text-gray-600 mt-2">Your central hub for everything related to this course.</p>
      </header>

      {/* Main component handling the layout */}
      <CourseOverview courseId={courseId} />
    </div>
  );
}