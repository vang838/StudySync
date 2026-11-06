"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Course, SetData, SetPayload } from "@/lib/types/flashcard";

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

  function moveCard(index: number, direction: number) {
    const destination = index + direction;
    if (destination < 0 || destination >= cards.length) return;

    setCards((current) => {
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [
        reordered[destination],
        reordered[index],
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
    <main className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6 pb-12">
        <Link href="/dashboard/flashcards/library" className="text-sm underline">
          ← Flashcard library
        </Link>
        <h1 className="text-3xl font-bold">Edit flashcard set</h1>

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
            <label className="block">
              Course
              <select
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
            </label>

            <label className="block">
              Title
              <input
                required
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 w-full rounded border p-3"
              />
            </label>

            <label className="block">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-1 w-full rounded border p-3"
              />
            </label>

            <h2 className="text-xl font-semibold">Cards ({cards.length})</h2>

            {cards.map((card, index) => (
              <section key={card.key} className="space-y-3 rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <strong>Card {index + 1}</strong>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveCard(index, -1)}
                      className="rounded border px-3 py-1 disabled:opacity-40"
                    >
                      <span aria-hidden="true">↑</span>
                      <span className="sr-only">Move card {index + 1} up</span>
                    </button>
                    <button
                      type="button"
                      disabled={index === cards.length - 1}
                      onClick={() => moveCard(index, 1)}
                      className="rounded border px-3 py-1 disabled:opacity-40"
                    >
                      <span aria-hidden="true">↓</span>
                      <span className="sr-only">
                        Move card {index + 1} down
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={cards.length === 1}
                      onClick={() =>
                        setCards((current) =>
                          current.filter((item) => item.key !== card.key)
                        )
                      }
                      className="rounded border px-3 py-1 text-red-600 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <label className="block">
                  Front (question)
                  <textarea
                    required
                    value={card.question}
                    onChange={(event) =>
                      changeCard(card.key, "question", event.target.value)
                    }
                    className="mt-1 w-full rounded border p-3"
                  />
                </label>

                <label className="block">
                  Back (answer)
                  <textarea
                    required
                    value={card.answer}
                    onChange={(event) =>
                      changeCard(card.key, "answer", event.target.value)
                    }
                    className="mt-1 w-full rounded border p-3"
                  />
                </label>
              </section>
            ))}

            <button
              type="button"
              onClick={() => setCards((current) => [...current, createDraft()])}
              className="rounded border px-4 py-2"
            >
              + Add card
            </button>

            {error && (
              <p role="alert" className="text-red-600">
                {error}
              </p>
            )}

            <div>
              <button
                disabled={busy || loading}
                className="rounded bg-blue-800 px-6 py-3 text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save and study"}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </main>
  );
}
