
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type StudyMode = "exam" | "guide";
type Difficulty = "Easy" | "Medium" | "Hard";

const courses = [
  { id: "BIO 201", name: "Human Biology" },
  { id: "MATH 240", name: "Statistics & Probability" },
  { id: "HIST 108", name: "World History" },
];

export default function StudyCenterPage() {
  const [mode, setMode] = useState<StudyMode>("exam");
  const [course, setCourse] = useState("BIO 201");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] =
    useState<Difficulty>("Medium");
  const [questionCount, setQuestionCount] = useState(15);
  const [guideLength, setGuideLength] = useState("Detailed");

  const selectedCourse = courses.find(
    (item) => item.id === course
  );

  const isExam = mode === "exam";

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-8 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-12">

        {/* Header */}
        <header className="space-y-3">
          <Link
            href="/dashboard"
            className="inline-flex text-sm text-muted-foreground transition hover:text-secondary"
          >
            ← Back to dashboard
          </Link>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
              STUDENT WORKSPACE / STUDY TOOLS
            </p>

            <h1 className="font-heading mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Your next study session starts here.
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Prepare for exams, organize important concepts,
              and build personalized learning resources.
            </p>
          </div>
        </header>

        {/* Study mode selection */}
        <section className="space-y-4">
          <div>
            <h2 className="font-heading text-xl font-semibold">
              Choose how you want to study
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Pick a study format to get started.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                id: "exam" as const,
                number: "01",
                title: "Practice Exam",
                description:
                  "Challenge yourself with exam-style questions and test your knowledge.",
                detail: "Practice & assessment",
              },
              {
                id: "guide" as const,
                number: "02",
                title: "Study Guide",
                description:
                  "Organize key ideas, explanations, and definitions into one resource.",
                detail: "Review & understanding",
              },
            ].map((item) => {
              const selected = mode === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  aria-pressed={selected}
                  className="group rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                >
                  <div
                    className={`flex h-full flex-col justify-between rounded-2xl border p-6 transition-all duration-200 ${
                      selected
                        ? "border-secondary bg-secondary/5 shadow-md"
                        : "border-foreground/10 bg-card hover:border-secondary/50 hover:shadow-sm"
                    }`}
                  >
                    <div>
                      <div className="mb-5 flex items-center justify-between">
                        <span className="text-xs font-bold tracking-widest text-secondary">
                          {item.number} / STUDY TOOL
                        </span>

                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border text-sm ${
                            selected
                              ? "border-secondary bg-secondary text-secondary-foreground"
                              : "border-foreground/20"
                          }`}
                        >
                          {selected ? "✓" : ""}
                        </span>
                      </div>

                      <h3 className="font-heading text-xl font-semibold">
                        {item.title}
                      </h3>

                      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-foreground/10 pt-4">
                      <span className="text-xs font-medium text-muted-foreground">
                        {item.detail}
                      </span>

                      <span className="text-sm font-semibold text-secondary">
                        {selected ? "Selected ✓" : "Select →"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Configuration and preview */}
        <section className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,1fr)]">

          {/* Session Settings */}
          <Card className="gap-0">
            <CardHeader className="border-b border-foreground/10">
              <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
                SESSION SETTINGS
              </p>

              <CardTitle className="font-heading text-xl">
                Customize your {isExam ? "exam" : "guide"}
              </CardTitle>

              <p className="text-sm text-muted-foreground">
                Make this study session your own.
              </p>
            </CardHeader>

            <CardContent className="space-y-7 pt-6">

              {/* Course selector */}
              <div className="space-y-2">
                <label
                  htmlFor="study-course"
                  className="block text-sm font-semibold"
                >
                  Course
                </label>

                <div className="relative">
                  <select
                    id="study-course"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-foreground/10 bg-muted/40 px-4 py-4 pr-10 text-sm font-medium text-foreground shadow-sm transition hover:border-secondary/40 hover:bg-muted/60 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                  >
                    {courses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id} — {item.name}
                      </option>
                    ))}
                  </select>

                  {/* Custom dropdown arrow */}
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-muted-foreground">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* Topic input */}
              <div className="space-y-2">
                <label
                  htmlFor="study-topic"
                  className="block text-sm font-semibold"
                >
                  Topic or chapter
                </label>

                <input
                  id="study-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What would you like to focus on?"
                  className="w-full rounded-xl border border-foreground/10 bg-muted/40 px-4 py-4 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground hover:border-secondary/40 hover:bg-muted/60 focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                />

                <p className="text-xs text-muted-foreground">
                  Leave blank to cover all course topics.
                </p>
              </div>

              {/* Difficulty selector */}
              <div className="space-y-3">
                <p className="text-sm font-semibold">
                  Difficulty level
                </p>

                <div className="grid grid-cols-3 gap-2">
                  {(["Easy", "Medium", "Hard"] as const).map(
                    (level) => (
                      <button
                        type="button"
                        key={level}
                        onClick={() => setDifficulty(level)}
                        aria-pressed={difficulty === level}
                        className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                          difficulty === level
                            ? "border-secondary bg-secondary/10 text-foreground"
                            : "border-foreground/10 bg-muted/30 text-muted-foreground hover:border-secondary/40 hover:bg-muted/60"
                        }`}
                      >
                        {level}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Question count / guide length */}
              {isExam ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">
                    Number of questions
                  </p>

                  <div className="grid grid-cols-4 gap-2">
                    {[10, 15, 25, 50].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setQuestionCount(count)}
                        aria-pressed={questionCount === count}
                        className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                          questionCount === count
                            ? "border-secondary bg-secondary/10 text-foreground"
                            : "border-foreground/10 bg-muted/30 text-muted-foreground hover:border-secondary/40 hover:bg-muted/60"
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">
                    Guide detail
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    {["Quick", "Detailed", "Complete"].map(
                      (length) => (
                        <button
                          key={length}
                          type="button"
                          onClick={() => setGuideLength(length)}
                          aria-pressed={guideLength === length}
                          className={`rounded-xl border px-2 py-3 text-sm font-medium transition ${
                            guideLength === length
                              ? "border-secondary bg-secondary/10 text-foreground"
                              : "border-foreground/10 bg-muted/30 text-muted-foreground hover:border-secondary/40 hover:bg-muted/60"
                          }`}
                        >
                          {length}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live session preview */}
          <Card className="gap-0">
            <CardHeader className="border-b border-foreground/10">
              <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
                YOUR SESSION
              </p>

              <CardTitle className="font-heading text-xl">
                Session Preview
              </CardTitle>
            </CardHeader>

            <CardContent className="flex h-full flex-col gap-6 pt-6">
              <div className="rounded-2xl border border-secondary/20 bg-secondary/5 p-5">
                <span className="text-xs font-semibold uppercase tracking-widest text-secondary">
                  {isExam ? "Practice Exam" : "Study Guide"}
                </span>

                <h3 className="font-heading mt-3 text-xl font-bold">
                  {selectedCourse?.name}
                </h3>

                <p className="mt-2 text-sm text-muted-foreground">
                  {topic.trim() || "All course topics"}
                </p>
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    Course
                  </span>
                  <span className="font-medium">{course}</span>
                </div>

                <div className="h-px bg-foreground/10" />

                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    Difficulty
                  </span>
                  <span className="font-medium">
                    {difficulty}
                  </span>
                </div>

                <div className="h-px bg-foreground/10" />

                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {isExam ? "Questions" : "Detail level"}
                  </span>

                  <span className="font-medium">
                    {isExam ? questionCount : guideLength}
                  </span>
                </div>
              </div>

              <div className="mt-auto space-y-3 pt-4">
                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-xl bg-secondary px-5 py-3.5 font-semibold text-secondary-foreground opacity-60"
                >
                  Generate {isExam ? "Practice Exam" : "Study Guide"} →
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  AI generation coming in a future update.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
