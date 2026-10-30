"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import CourseForumSection from "@/components/course-overview/CourseForumSection";
import CourseMembersSection from "@/components/course-overview/CourseMembersSection";

type CourseDetails = {
  course_id: string;
  title: string;
  description?: string | null;
  professor?: string | null;
  subject: string;
  year: number;
};

type PublishedCourseDocument = {
  document_id: string;
  version_id: string;
  course_id: string;
  title: string;
  is_published: boolean;
  original_filename: string;
  file_size_bytes: number;
  created_at: string;
};

interface CourseOverviewProps {
  courseId: string;
}

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

const supportsPreview = (filename: string): boolean => /\.(pdf|png|jpe?g|webp|gif|svg|txt|csv)$/i.test(filename);

const CourseOverview: React.FC<CourseOverviewProps> = ({ courseId }) => {
  const [course, setCourse] = useState<CourseDetails | null>(null);
  const [documents, setDocuments] = useState<PublishedCourseDocument[]>([]);
  const [activePreviewDocumentId, setActivePreviewDocumentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDocumentDownload = async (courseDocument: PublishedCourseDocument) => {
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(courseDocument.document_id)}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to download file.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = courseDocument.original_filename || courseDocument.title;
      anchor.rel = "noopener";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert("Unable to download this file right now.");
    }
  };

  const togglePreview = (documentId: string) => {
    setActivePreviewDocumentId((current) => (current === documentId ? null : documentId));
  };

  useEffect(() => {
    const loadCourse = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          course_id: courseId,
          published_only: "true",
        });

        const [courseResponse, documentsResponse] = await Promise.all([
          fetch(`/api/courses/${encodeURIComponent(courseId)}`, { cache: "no-store" }),
          fetch(`/api/documents?${params.toString()}`, { cache: "no-store" }),
        ]);

        if (!courseResponse.ok) {
          throw new Error(`Failed to load course data (HTTP ${courseResponse.status})`);
        }
        if (!documentsResponse.ok) {
          const body = await documentsResponse.json().catch(() => ({}));
          throw new Error(body?.detail ?? `Failed to load published course documents (HTTP ${documentsResponse.status})`);
        }

        const courseData = (await courseResponse.json()) as CourseDetails;
        const documentsData = (await documentsResponse.json()) as PublishedCourseDocument[];

        const normalizedDocuments = Array.isArray(documentsData)
          ? [...documentsData].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
          : [];

        setCourse(courseData);
        setDocuments(normalizedDocuments);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load course details.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadCourse();
  }, [courseId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading course overview...</p>;
  }

  if (error) {
    return <p className="text-sm font-medium text-destructive">{error}</p>;
  }

  if (!course) {
    return <p className="text-sm text-muted-foreground">No course data found.</p>;
  }

  const activePreviewDocument = documents.find((document) => document.document_id === activePreviewDocumentId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <aside className="space-y-6 lg:col-span-3">
        <CourseMembersSection courseId={courseId} />
      </aside>

      <section className="space-y-6 lg:col-span-6">
        <Card>
          <CardHeader>
            <CardTitle>{course.title}</CardTitle>
            <CardDescription>{course.course_id} · {course.subject} · {course.year}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{course.description || "No description provided for this course yet."}</p>
            <Separator />
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground">Professor</p>
              {course.professor ? (
                <Link
                  href={`/professors/${encodeURIComponent(course.professor)}`}
                  className="mt-1 inline-block text-base text-primary underline-offset-2 hover:underline"
                >
                  {course.professor}
                </Link>
              ) : (
                <p className="mt-1 text-base text-foreground">TBA</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Materials</CardTitle>
            <CardDescription>Published course files and resources for students and instructors.</CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published materials uploaded yet.</p>
            ) : (
              <div className="space-y-3">
                {documents.map((document) => (
                  <div key={document.document_id} className="rounded-md border border-border/70 bg-muted/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{document.title}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {document.original_filename} · {formatFileSize(document.file_size_bytes)} · {new Date(document.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        Published
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void handleDocumentDownload(document);
                        }}
                        className="inline-flex items-center rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                      >
                        Download
                      </button>
                      {supportsPreview(document.original_filename) && (
                        <button
                          type="button"
                          onClick={() => togglePreview(document.document_id)}
                          className="inline-flex items-center rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          {activePreviewDocumentId === document.document_id ? "Close preview" : "Preview"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <aside className="space-y-6 lg:col-span-3">
        <CourseForumSection courseId={courseId} />
      </aside>

      {activePreviewDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={() => setActivePreviewDocumentId(null)}
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{activePreviewDocument.title}</p>
                <p className="truncate text-xs text-muted-foreground">{activePreviewDocument.original_filename}</p>
              </div>
              <button
                type="button"
                onClick={() => setActivePreviewDocumentId(null)}
                className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-lg leading-none text-foreground hover:bg-muted"
                aria-label="Close preview"
              >
                ×
              </button>
            </div>

            <div className="bg-background">
              {activePreviewDocument.original_filename.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={`/api/documents/${encodeURIComponent(activePreviewDocument.document_id)}?preview=true`}
                  title={activePreviewDocument.title}
                  className="h-[72vh] w-full"
                />
              ) : activePreviewDocument.original_filename.toLowerCase().match(/\.(png|jpe?g|webp|gif|svg)$/) ? (
                <div className="flex h-[72vh] items-center justify-center bg-muted/20 p-4">
                  <Image
                    src={`/api/documents/${encodeURIComponent(activePreviewDocument.document_id)}?preview=true`}
                    alt={activePreviewDocument.title}
                    width={1400}
                    height={1200}
                    unoptimized
                    className="max-h-[70vh] w-auto max-w-full rounded-md object-contain"
                  />
                </div>
              ) : (
                <iframe
                  src={`/api/documents/${encodeURIComponent(activePreviewDocument.document_id)}?preview=true`}
                  title={activePreviewDocument.title}
                  className="h-[72vh] w-full bg-background"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseOverview;
