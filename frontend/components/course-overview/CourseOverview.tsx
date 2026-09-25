import React from 'react';

interface CourseOverviewProps {
  courseId: string;
}

const CourseOverview: React.FC<CourseOverviewProps> = ({ courseId }) => {
  // NOTE: In a production application, all data (course info, professor, etc.) 
  // should be fetched and passed down as props here, rather than using placeholders.
  
  // Example placeholder data structure:
  const dummyCourseData = {
    info: "Welcome to the comprehensive overview for this course. Here you will find all necessary materials and discussions.",
    professor: "Dr. Evelyn Reed, Ph.D.",
    materials: ["Syllabus (PDF)", "Lecture Slides (PPT)", "Reading List (DOCX)"],
    forumPosts: ["Discussion: Initial Questions", "Assignment 1 Help"],
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 1. Course Information */}
      <section className="lg:col-span-2 space-y-6 p-6 border rounded-lg bg-white shadow-lg">
        <div className="border-b pb-4 mb-4">
          <h2 className="text-3xl font-semibold text-indigo-700">📚 Course Information</h2>
          <p className="text-gray-700 mt-2">{dummyCourseData.info}</p>
        </div>

        {/* 2. Professor Details */}
        <div className="border-b pb-4 mb-4">
          <h2 className="text-2xl font-semibold text-indigo-700">👨‍🏫 Professor</h2>
          <p className="text-xl text-gray-800">{dummyCourseData.professor}</p>
        </div>

        {/* 3. Uploaded Materials */}
        <div>
          <h2 className="text-2xl font-semibold text-indigo-700">📂 Materials</h2>
          <ul className="list-disc list-inside space-y-1 mt-2">
            {dummyCourseData.materials.map((material, index) => (
              <li key={index} className="text-gray-600 hover:text-indigo-500 cursor-pointer">{material}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Forum & Sidebar */}
      <aside className="lg:col-span-1 space-y-8">
        
        {/* Forum */}
        <section className="p-6 border rounded-lg bg-white shadow-lg">
          <h2 className="text-2xl font-semibold text-indigo-700">💬 Discussion Forum</h2>
          <div className="space-y-3 mt-4">
            {dummyCourseData.forumPosts.map((post, index) => (
                <div key={index} className="text-sm p-2 bg-gray-50 rounded hover:bg-indigo-50 cursor-pointer transition">
                    {post}
                </div>
            ))}
          </div>
          <button className="mt-4 w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">
            View All Threads
          </button>
        </section>

        {/* Quick Quick Start Card */}
        <div className="p-6 border rounded-lg bg-yellow-50 shadow-lg">
            <h3 className="text-xl font-semibold text-yellow-800">Start Here</h3>
            <p className="text-sm mt-2">Check the syllabus and introduce yourself in the forum!</p>
        </div>
      </aside>
    </div>
  );
}

export default CourseOverview;