"use client";

import { use, useEffect, useRef, useState, type FormEvent } from "react";
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

type Draft = {
  key: string;
  flashcard_id?: number;
  question: string;
  answer: string;
};

async function flashcardRequest(
  path: string,
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
          : "Unable to load or save this flashcard set. Please try again."
    );
  }

  return response;
}

async function loadFlashcardSet(setId: string): Promise<SetData> {
  const response = await flashcardRequest(`/${encodeURIComponent(setId)}`);
  return (await response.json()) as SetData;
}

async function loadSavedCourses(): Promise<Course[]> {
  const response = await flashcardRequest("/courses");
  return (await response.json()) as Course[];
}

async function updateFlashcardSet(
  setId: string,
  payload: SetPayload
): Promise<SetData> {
  const response = await flashcardRequest(`/${encodeURIComponent(setId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return (await response.json()) as SetData;
}

function createDraft(): Draft {
  return {
    key: crypto.randomUUID(),
    question: "",
    answer: "",
  };
}

export default function EditFlashcardsPage({
  params,
}: {
  params: Promise<{ setId: string }>;
}) {
  const { setId } = use(params);
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cards, setCards] = useState<Draft[]>([]);
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

    Promise.all([loadSavedCourses(), loadFlashcardSet(setId)])
      .then(([availableCourses, set]) => {
        if (!active) return;
        setCourses(availableCourses);
        setCourseId(set.course_id);
        setTitle(set.title);
        setDescription(set.description ?? "");
        setCards(
          set.cards.map((card) => ({
            ...card,
            key: String(card.flashcard_id),
          }))
        );
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [setId]);

  function changeCard(
    key: string,
    field: "question" | "answer",
    value: string
  ) {
    setCards((current) =>
      current.map((card) =>
        card.key === key ? { ...card, [field]: value } : card
      )
    );
  }

  function moveCard(cardKey: string, direction: number) {
    setCards((current) => {
      const currentIndex = current.findIndex((card) => card.key === cardKey);
      const destination = currentIndex + direction;
      if (
        currentIndex < 0 ||
        destination < 0 ||
        destination >= current.length
      ) {
        return current;
      }

      const reordered = [...current];
      [reordered[currentIndex], reordered[destination]] = [
        reordered[destination],
        reordered[currentIndex],
      ];
      return reordered;
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (
      !courseId ||
      !title.trim() ||
      cards.length === 0 ||
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
      const updatedSet = await updateFlashcardSet(setId, payload);
      router.push(
        `/dashboard/flashcards/${updatedSet.flashcardsets_id}/study`
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save this flashcard set. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">Edit</p>
            <h1 className="text-3xl font-bold">Edit Flashcard Set</h1>
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

        {loading && <p role="status">Loading flashcard set…</p>}
        {!loading && !error && courses.length === 0 && (
          <p>
            Save a course before editing flashcards.{" "}
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
                  Edit the course, title, and description for this flashcard
                  set.
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
                      id="course_id"
                      required
                      value={courseId}
                      onChange={(event) => setCourseId(event.target.value)}
                      className="mt-1 w-full rounded border p-3"
                    >
                      <option value="">Select a saved course</option>
                      {courses.map((course) => (
                        <option key={course.course_id} value={course.course_id}>
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
                      id="subject"
                      required
                      maxLength={200}
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
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
                    id="description"
                    ref={descriptionRef}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="min-h-16 w-full resize-none overflow-hidden rounded-md border border-input bg-white px-3 py-2 text-sm text-gray-900"
                    placeholder="Briefly describe the topics, key concepts, or learning objectives covered in this flashcard set..."
                  />
                </div>
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
                      onClick={() => moveCard(card.key, -1)}
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
                      onClick={() => moveCard(card.key, 1)}
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
                        setCards((current) =>
                          current.filter((item) => item.key !== card.key)
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
                        onChange={(event) =>
                          changeCard(card.key, "question", event.target.value)
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
                        onChange={(event) =>
                          changeCard(card.key, "answer", event.target.value)
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
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <div className="flex items-center justify-start gap-3">
              <Button
                type="button"
                onClick={() =>
                  setCards((current) => [...current, createDraft()])
                }
                variant="outline"
                size="s"
              >
                + Add card
              </Button>
              <Button
                type="submit"
                disabled={busy || loading}
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
