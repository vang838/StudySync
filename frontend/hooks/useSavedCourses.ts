"use client";

import {useSyncExternalStore} from "react";

// Same fallback courses used by your dashboard
export type SavedCourse = {
    code: string;
    name: string;
    progress: number;
};

const defaultCourses: SavedCourse[] = [
    {code: "BIO 201", name: "Human Biology", progress: 72},
    {
        code: "MATH 240",
        name: "Statistics & Probability",
        progress: 48,
    },
    {code: "HIST 108", name: "World History", progress: 85},
];

let cachedRaw: string | null = null;
let cachedCourses: SavedCourse[] = defaultCourses;

function getSnapshot(): SavedCourse[] {
    if (typeof window === "undefined") {
        return defaultCourses;
    }

    try {
        const raw = window.localStorage.getItem("saved_courses");

        if (!raw) {
            cachedRaw = null;
            cachedCourses = defaultCourses;
            return defaultCourses;
        }

        if (raw === cachedRaw) {
            return cachedCourses;
        }

        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed)) {
            const validCourses = parsed.filter(
                (course): course is SavedCourse =>
                    typeof course?.code === "string" &&
                    typeof course?.name === "string" &&
                    typeof course?.progress === "number"
            );

            cachedRaw = raw;
            cachedCourses = validCourses;
            return cachedCourses;
        }
    } catch (error) {
        console.warn("Unable to load saved courses.", error);
    }

    return defaultCourses;
}

function subscribe(callback: () => void) {
    const handleChange = () => callback();

    window.addEventListener("storage", handleChange);
    window.addEventListener("saved-courses-updated", handleChange);

    return () => {
        window.removeEventListener("storage", handleChange);
        window.removeEventListener("saved-courses-updated", handleChange);
    };
}

export function useSavedCourses() {
    return useSyncExternalStore(
        subscribe,
        getSnapshot,
        () => defaultCourses
    );
}
