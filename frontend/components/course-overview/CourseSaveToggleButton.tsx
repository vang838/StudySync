"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface CourseSaveToggleButtonProps {
  courseId: string;
}

const CourseSaveToggleButton = ({ courseId }: CourseSaveToggleButtonProps) => {
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const getCurrentUserId = useCallback(() => {
    const rawUserId = window.localStorage.getItem("user_id");
    const parsedUserId = Number(rawUserId ?? "1");
    return Number.isFinite(parsedUserId) && parsedUserId > 0 ? parsedUserId : 1;
  }, []);

  const toggleSave = useCallback(async () => {
    if (saving) {
      return;
    }

    setSaving(true);
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}/save?user_id=${userId}`, {
        method: isSaved ? "DELETE" : "POST",
      });
      if (!response.ok) {
        return;
      }
      setIsSaved((previous) => !previous);
    } finally {
      setSaving(false);
    }
  }, [courseId, getCurrentUserId, isSaved, saving]);

  useEffect(() => {
    let isActive = true;

    async function loadSavedState() {
      try {
        const userId = getCurrentUserId();
        const response = await fetch(`/api/courses/saved?user_id=${userId}`);
        if (!isActive) {
          return;
        }
        if (!response.ok) {
          setIsSaved(false);
          return;
        }

        const savedCourses = await response.json();
        if (!isActive) {
          return;
        }
        const savedIds = Array.isArray(savedCourses)
          ? savedCourses
              .map((course: { course_id?: string; id?: string }) => course.course_id ?? course.id)
              .filter((value): value is string => typeof value === "string")
          : [];
        setIsSaved(savedIds.includes(courseId));
      } catch {
        if (isActive) {
          setIsSaved(false);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadSavedState();

    return () => {
      isActive = false;
    };
  }, [courseId, getCurrentUserId]);

  return (
    <Button
      variant={isSaved ? "default" : "outline"}
      size="s"
      onClick={() => {
        void toggleSave();
      }}
      disabled={loading || saving}
    >
      {loading ? "Loading..." : isSaved ? "Saved" : "Save Course"}
    </Button>
  );
};

export default CourseSaveToggleButton;
