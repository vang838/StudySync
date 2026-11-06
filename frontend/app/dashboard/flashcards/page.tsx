
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Course, SetData, SetPayload } from "@/lib/types/flashcard";

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
  const [cards, setCards] = useState<Draft[]>([{ key: "initial", question: "", answer: "" }]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      getSavedCourses(),
      setId ? getFlashcardSet(setId) : Promise.resolve(null),
    ]).then(([availableCourses, set]) => {
      if (!active) return;
      setCourses(availableCourses);
      if (set) {
        setCourseId(set.course_id);
        setTitle(set.title);
        setDescription(set.description ?? "");
        setCards(set.cards.map((c) => ({ ...c, key: String(c.flashcard_id) })));
      }
    }).catch((e: Error) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setId]);

  function change(
    key: string,
    field: "question" | "answer",
    value: string
  ) {
    setCards((prev) =>
      prev.map((c) =>
        c.key === key ? { ...c, [field]: value } : c
      )
    );
  }

  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= cards.length) return;

    setCards((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (
      !courseId ||
      !title.trim() ||
      cards.some(
        (c) => !c.question.trim() || !c.answer.trim()
      )
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

      router.push(
        `/dashboard/flashcards/${result.flashcardsets_id}/study`
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <Link href="/dashboard/flashcards/library" className="text-sm underline">← Flashcard library</Link>
      <h1 className="text-3xl font-bold">
        {setId
          ? "Edit flashcard set"
          : "Create flashcard set"}
      </h1>

      {loading && <p role="status">Loading your saved courses…</p>}
      {!loading && !error && courses.length === 0 && <p>Save a course before creating flashcards. <Link className="underline" href="/courses/course_search">Find a course</Link></p>}
      <form onSubmit={save} className="space-y-5">
      <fieldset disabled={busy || loading || courses.length === 0} className="space-y-5 disabled:opacity-60">
        <label className="block">
          Course
          <select
            required
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="mt-1 w-full rounded border p-3"
          >
            <option value="">Select a saved course</option>
            {courses.map((c) => (
              <option
                key={c.course_id}
                value={c.course_id}
              >
                {c.title}
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
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded border p-3"
          />
        </label>

        <label className="block">
          Description
          <textarea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            className="mt-1 w-full rounded border p-3"
          />
        </label>

        <h2 className="text-xl font-semibold">
          Cards ({cards.length})
        </h2>

        {cards.map((c, i) => (
          <section
            key={c.key}
            className="space-y-3 rounded-xl border p-4"
          >
            <div className="flex items-center justify-between">
              <strong>Card {i + 1}</strong>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="rounded border px-3 py-1 disabled:opacity-40"
                >
                  <span aria-hidden="true">↑</span><span className="sr-only">Move card {i + 1} up</span>
                </button>

                <button
                  type="button"
                  disabled={i === cards.length - 1}
                  onClick={() => move(i, 1)}
                  className="rounded border px-3 py-1 disabled:opacity-40"
                >
                  <span aria-hidden="true">↓</span><span className="sr-only">Move card {i + 1} down</span>
                </button>

                <button
                  type="button"
                  disabled={cards.length === 1}
                  onClick={() =>
                    setCards((prev) =>
                      prev.filter((x) => x.key !== c.key)
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
                value={c.question}
                onChange={(e) =>
                  change(c.key, "question", e.target.value)
                }
                className="mt-1 w-full rounded border p-3"
              />
            </label>

            <label className="block">
              Back (answer)
              <textarea
                required
                value={c.answer}
                onChange={(e) =>
                  change(c.key, "answer", e.target.value)
                }
                className="mt-1 w-full rounded border p-3"
              />
            </label>
          </section>
        ))}

        <button
          type="button"
          onClick={() =>
            setCards((prev) => [...prev, blank()])
          }
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
            disabled={busy}
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
