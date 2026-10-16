
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

type Course = {
  course_id: string;
  title: string;
  subject?: string;
};

export default function UploadDocumentsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [loadingCourses, setLoadingCourses] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadCourses() {
      try {
        const rawUser = localStorage.getItem("studysync_user");

        if (!rawUser) {
          throw new Error("Please sign in first.");
        }

        const user = JSON.parse(rawUser);
        const userId = Number(user.user_id);

        if (!Number.isInteger(userId) || userId <= 0) {
          throw new Error("Invalid user ID.");
        }

        const response = await fetch(
          `/api/courses/saved?user_id=${userId}`
        );

        if (!response.ok) {
          throw new Error("Unable to load saved courses.");
        }

        const data: unknown = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid course data.");
        }

        setCourses(data as Course[]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load saved courses."
        );
      } finally {
        setLoadingCourses(false);
      }
    }

    loadCourses();
  }, []);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!courseId || !title.trim() || !file) {
      setError("Please select a course, enter a title, and choose a file.");
      return;
    }

    const allowedExtensions = [".pdf", ".docx", ".pptx", ".txt"];
    const extension = file.name
      .slice(file.name.lastIndexOf("."))
      .toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      setError("Supported formats: PDF, DOCX, PPTX, and TXT.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError("File size must not exceed 25 MB.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("course_id", courseId);
      formData.append("title", title.trim());
      formData.append("file", file);

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail ?? "Upload failed.");
      }

      setSuccess(
        `Document uploaded successfully. Status: ${result.status}`
      );
      setTitle("");
      setFile(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload failed."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground md:px-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <p className="text-sm text-muted-foreground">
            Document Management
          </p>
          <h1 className="mt-1 text-3xl font-bold">
            Upload Course Documents
          </h1>
          <p className="mt-2 text-muted-foreground">
            Upload your study materials and associate them with
            your saved courses.
          </p>
        </header>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <form onSubmit={handleUpload} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="course" className="block font-medium">
                Course
              </label>

              <select
                id="course"
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                disabled={loadingCourses || uploading}
                required
                className="w-full rounded-md border bg-background p-3"
              >
                <option value="">
                  {loadingCourses
                    ? "Loading courses..."
                    : "Select a saved course"}
                </option>
                {courses.map((course) => (
                  <option key={course.course_id} value={course.course_id}>
                    {course.course_id} - {course.title}
                  </option>
                ))}
              </select>

              {!loadingCourses && courses.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No saved courses found.{" "}
                  <Link href="/courses/course_search" className="underline">
                    Browse Courses
                  </Link>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="title" className="block font-medium">
                Document Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                required
                disabled={uploading}
                placeholder="e.g. Week 3 Lecture Notes"
                className="w-full rounded-md border bg-background p-3"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="file" className="block font-medium">
                Choose File
              </label>
              <input
                id="file"
                type="file"
                accept=".pdf,.docx,.pptx,.txt"
                onChange={(event) =>
                  setFile(event.target.files?.[0] ?? null)
                }
                disabled={uploading}
                required
                className="w-full rounded-md border bg-background p-3"
              />
              <p className="text-sm text-muted-foreground">
                PDF, DOCX, PPTX, or TXT. Maximum 25 MB.
              </p>
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}

            {success && (
              <p role="status" className="text-sm text-green-600">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={uploading || loadingCourses || courses.length === 0}
              className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload Document"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
