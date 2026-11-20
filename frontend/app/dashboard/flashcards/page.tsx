
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Course, SetData, SetPayload } from "@/lib/types/flashcard";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Delete01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

async function flashcardRequest(
  path = "",
  init: RequestInit = {}
): Promise<Response> {
  const userId = localStorage.getItem("user_id");
  if (!userId) throw new Error("Please sign in to use flashcards.");

  const response = await fetch(
    `/api/flashcards${path}?user_id=${encodeURIComponent(userId)}`,
    {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const detail =
      typeof data === "object" && data !== null && "detail" in data
        ? data.detail
        : null;
    throw new Error(
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail
              .map((item) =>
                typeof item === "object" &&
                item !== null &&
                "msg" in item &&
                typeof item.msg === "string"
                  ? item.msg
                  : null
              )
              .filter((message): message is string => message !== null)
              .join("; ")
          : "Unable to save or load flashcards. Please try again."
    );
  }

  return response;
}

async function getFlashcardSet(setId: string): Promise<SetData> {
  const response = await flashcardRequest(`/${encodeURIComponent(setId)}`);
  return (await response.json()) as SetData;
}

async function getSavedCourses(): Promise<Course[]> {
  const response = await flashcardRequest("/courses");
  return (await response.json()) as Course[];
}

async function saveFlashcardSet(
  setId: string | undefined,
  payload: SetPayload
): Promise<SetData> {
  const response = await flashcardRequest(
    setId ? `/${encodeURIComponent(setId)}` : "",
    {
      method: setId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    }
  );
  return (await response.json()) as SetData;
}

type Draft = {
  key: string;
  flashcard_id?: number;
  question: string;
  answer: string;
};

const blank = (): Draft => ({
  key: crypto.randomUUID(),
  question: "",
  answer: "",
});

export default function FlashcardsPage({
  setId,
}: {
  setId?: string;
}) {
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cards, setCards] = useState<Draft[]>([
    { key: "initial", question: "", answer: "" },
  ]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = descriptionRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [description]);

  useEffect(() => {
    let active = true;
    Promise.all([
      getSavedCourses(),
      setId ? getFlashcardSet(setId) : Promise.resolve(null),
    ])
      .then(([availableCourses, set]) => {
        if (!active) return;
        setCourses(availableCourses);

        if (set) {
          setCourseId(set.course_id);
          setTitle(set.title);
          setDescription(set.description ?? "");
          setCards(
            set.cards.map((card) => ({
              ...card,
              key: String(card.flashcard_id),
            }))
          );
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [setId]);

  function change(
    key: string,
    field: "question" | "answer",
    value: string
  ) {
    setCards((prev) =>
      prev.map((card) =>
        card.key === key ? { ...card, [field]: value } : card
      )
    );
  }

  function move(cardKey: string, delta: number) {
    setCards((prev) => {
      const currentIndex = prev.findIndex((card) => card.key === cardKey);
      const nextIndex = currentIndex + delta;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      [next[currentIndex], next[nextIndex]] = [
        next[nextIndex],
        next[currentIndex],
      ];
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (
      !courseId ||
      !title.trim() ||
      cards.some((card) => !card.question.trim() || !card.answer.trim())
    ) {
      setError(
        "Choose a course, enter a title, and complete both sides of every card."
      );
      return;
    }

    const payload: SetPayload = {
      course_id: courseId,
      title: title.trim(),
      description,
      cards: cards.map(({ flashcard_id, question, answer }) => ({
        flashcard_id,
        question: question.trim(),
        answer: answer.trim(),
      })),
    };

    setBusy(true);

    try {
      const result = await saveFlashcardSet(setId, payload);

      router.push(`/dashboard/flashcards/${result.flashcardsets_id}/study`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">Create</p>
            <h1 className="text-3xl font-bold">
              {setId ? "Edit Flashcard Set" : "Create Flashcard Set"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/flashcards/library"
              className="text-sm underline"
            >
              <Button variant="secondary" size="s">
                Go to Flashcard Library
              </Button>
            </Link>
          </div>
        </header>

        <Separator />

        {loading && <p role="status">Loading your saved courses…</p>}
        {!loading && !error && courses.length === 0 && (
          <p>
            Save a course before creating flashcards.{" "}
            <Link className="underline" href="/courses/course_search">
              Find a course
            </Link>
          </p>
        )}

        <form onSubmit={save} className="space-y-5">
          <fieldset
            disabled={busy || loading || courses.length === 0}
            className="space-y-5 disabled:opacity-60"
          >
            <Card>
              <CardHeader>
                <CardTitle>FlashCard Details</CardTitle>
                <CardDescription>
                  Create a new flashcard set by selecting a course, adding a
                  title, and providing a description to organize your study
                  materials.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="course_id"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Course Number
                    </label>
                    <select
                      required
                      value={courseId}
                      onChange={(e) => setCourseId(e.target.value)}
                      className="mt-1 w-full rounded border p-3"
                    >
                      <option value="">Select a saved course</option>
                      {courses.map((course) => (
                        <option
                          key={course.course_id}
                          value={course.course_id}
                        >
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="subject"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Title
                    </label>
                    <input
                      required
                      maxLength={200}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="mt-1 w-full rounded border p-3"
                    />
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <label
                    htmlFor="description"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    Description
                  </label>
                  <textarea
                    ref={descriptionRef}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-16 w-full resize-none overflow-hidden rounded-md border border-input bg-white px-3 py-2 text-sm text-gray-900"
                    placeholder="Briefly describe the topics, key concepts, or learning objectives covered in this flashcard set..."
                  />
                </div>

                {error && (
                  <p className="text-sm font-medium text-destructive">
                    {error}
                  </p>
                )}
              </CardContent>
            </Card>

            {cards.map((card, index) => (
              <Card key={card.key} className="gap-2 rounded-xl ring-0">
                <CardHeader
                  key={`${card.key}-${index}`}
                  className="flex flex-row items-center justify-between gap-3"
                >
                  <CardTitle>Card {index + 1}</CardTitle>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => move(card.key, -1)}
                      aria-label={`Move card ${index + 1} up`}
                      title="Move up"
                      className="inline-flex size-8 items-center justify-center rounded border text-muted-foreground hover:bg-muted disabled:opacity-40"
                    >
                      <HugeiconsIcon
                        icon={ArrowUp01Icon}
                        size={16}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      disabled={index === cards.length - 1}
                      onClick={() => move(card.key, 1)}
                      aria-label={`Move card ${index + 1} down`}
                      title="Move down"
                      className="inline-flex size-8 items-center justify-center rounded border text-muted-foreground hover:bg-muted disabled:opacity-40"
                    >
                      <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        size={16}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      disabled={cards.length === 1}
                      onClick={() =>
                        setCards((prev) =>
                          prev.filter((item) => item.key !== card.key)
                        )
                      }
                      aria-label={`Delete card ${index + 1}`}
                      title="Delete card"
                      className="inline-flex size-8 items-center justify-center rounded border text-destructive hover:bg-destructive/10 disabled:opacity-40"
                    >
                      <HugeiconsIcon
                        icon={Delete01Icon}
                        size={16}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Term
                      <textarea
                        required
                        rows={2}
                        value={card.question}
                        onChange={(e) =>
                          change(card.key, "question", e.target.value)
                        }
                        className="mt-0.5 min-h-16 w-full resize-none overflow-hidden rounded-md border border-input bg-white p-3 text-gray-900"
                        placeholder="Place term or question"
                      />
                    </label>

                    <label className="text-sm font-medium text-muted-foreground">
                      Definition
                      <textarea
                        required
                        rows={2}
                        value={card.answer}
                        onChange={(e) =>
                          change(card.key, "answer", e.target.value)
                        }
                        className="mt-0.5 min-h-16 w-full resize-none overflow-hidden rounded-md border border-input bg-white p-3 text-gray-900"
                        placeholder="Place definition or explanation"
                      />
                    </label>
                  </div>
                </CardContent>
              </Card>
            ))}

            {error && (
              <p role="alert" className="text-red-600">
                {error}
              </p>
            )}

            <div className="flex items-center justify-start gap-3">
              <Button
                type="button"
                onClick={() => setCards((prev) => [...prev, blank()])}
                variant="outline"
                size="s"
              >
                + Add card
              </Button>
              <Button
                type="submit"
                disabled={busy}
                variant="secondary"
                size="s"
              >
                {busy ? "Saving…" : "Save and study"}
              </Button>
            </div>
          </fieldset>
        </form>
      </div>
    </main>
  );
}
