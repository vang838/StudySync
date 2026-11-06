"use client";

import {useState} from "react";

type MaterialType = "exam" | "guide";
type FilterType = "all" | MaterialType;

type StudyMaterial = {
    id: number;
    title: string;
    course: string;
    type: MaterialType;
    description: string;
    date: string;
};

// Sample data for testing the interface
const recentMaterials: StudyMaterial[] = [
    {
        id: 1,
        title: "Biology Chapter 4 — Practice Exam",
        course: "BIO 201",
        type: "exam",
        description: "20 questions · Medium difficulty",
        date: "Oct 21, 2026",
    },
    {
        id: 2,
        title: "Statistics Chapter 3 — Study Guide",
        course: "MATH 240",
        type: "guide",
        description: "Detailed study guide",
        date: "Oct 19, 2026",
    },
    {
        id: 3,
        title: "World History — Practice Exam",
        course: "HIST 108",
        type: "exam",
        description: "15 questions · Easy difficulty",
        date: "Oct 17, 2026",
    },
];

export default function RecentStudyMaterials() {
    const [filter, setFilter] = useState<FilterType>("all");

    const filteredMaterials = recentMaterials.filter(
        (material) =>
            filter === "all" || material.type === filter
    );

    return (
        <section className="space-y-5">
            {/* Heading */}
            <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
                    YOUR LIBRARY
                </p>

                <h2 className="font-heading mt-1 text-xl font-semibold">
                    Recent Study Materials
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                    Pick up where you left off with your exams and study guides.
                </p>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-card p-5 md:p-6">

                {/* Filter buttons */}
                <div className="mb-5 flex flex-wrap gap-2">
                    {[
                        {id: "all" as const, label: "All"},
                        {id: "exam" as const, label: "Exams"},
                        {id: "guide" as const, label: "Study Guides"},
                    ].map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => setFilter(option.id)}
                            aria-pressed={filter === option.id}
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                                filter === option.id
                                    ? "bg-secondary text-secondary-foreground"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {/* Materials list */}
                <div className="divide-y divide-foreground/10">
                    {filteredMaterials.length === 0 ? (
                        <p className="py-5 text-sm text-muted-foreground">
                            No materials found.
                        </p>
                    ) : (
                        filteredMaterials.map((material) => (
                            <div
                                key={material.id}
                                className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                            >
                                {/* Icon */}
                                <div
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                                    {material.type === "exam" ? (
                                        <svg
                                            width="22"
                                            height="22"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.7"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <rect x="5" y="4" width="14" height="17" rx="2"/>
                                            <path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h3"/>
                                        </svg>
                                    ) : (
                                        <svg
                                            width="22"
                                            height="22"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.7"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1"/>
                                            <path d="M12 6c3-2 6-2 9-1v14c-3-1-6-1-9 1"/>
                                            <path d="M12 6v14"/>
                                        </svg>
                                    )}
                                </div>

                                {/* Material information */}
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-medium">
                                        {material.title}
                                    </h3>

                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {material.course} · {material.description}
                                    </p>
                                </div>

                                {/* Date */}
                                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {material.date}
                </span>
                            </div>
                        ))
                    )}
                </div>

                <p className="mt-5 text-xs text-muted-foreground">
                    Sample materials shown for demonstration.
                </p>
            </div>
        </section>
    );
}
