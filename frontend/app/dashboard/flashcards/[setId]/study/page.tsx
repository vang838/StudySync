"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import type { Rating, SetData } from "@/lib/types/flashcard";

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

async function submitFlashcardRating(
  setId: string,
  cardId: number,
  rating: Rating
): Promise<void> {
  await flashcardRequest(
    `/${encodeURIComponent(setId)}/cards/${cardId}/rating`,
    {
      method: "PUT",
      body: JSON.stringify({ rating }),
    }
  );
}

const ratings: { value: Rating; label: string }[] = [
  { value: "easy", label: "Easy to understand" },
  { value: "practice", label: "Need more practice" },
  { value: "hard", label: "Hard to understand" },
];

export default function FlashcardStudyPage({
  params,
}: {
  params: Promise<{ setId: string }>;
}) {
  const { setId } = use(params);
  const [set, setSet] = useState<SetData | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [selected, setSelected] = useState<Rating | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState<Record<Rating, number>>({ easy: 0, practice: 0, hard: 0 });
  const saving = useRef(false);
  const flipButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let active = true;
    getFlashcardSet(setId).then((data) => { if (active) setSet(data); })
      .catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [setId]);
  const card = set?.cards[index];
  const complete = set !== null && index >= set.cards.length;

  async function next() {
    if (!card || !selected || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await submitFlashcardRating(setId, card.flashcard_id, selected);
      setCounts((prev) => ({ ...prev, [selected]: prev[selected] + 1 }));
      setIndex((prev) => prev + 1);
      setFlipped(false);
      setSelected(null);
      flipButton.current?.focus();
    } catch (e) { setError((e as Error).message); }
    finally { saving.current = false; setBusy(false); }
  }

  return <main className="min-h-0 flex-1 overflow-y-auto p-6 md:p-10">
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <Link href="/dashboard/flashcards/library" className="underline">← Flashcard library</Link>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      {!set && !error && <p role="status">Loading study session…</p>}
      {set && <>
        <h1 className="break-words text-3xl font-bold">{set.title}</h1>
        {complete ? <section className="space-y-5 rounded-xl border p-6" aria-live="polite">
          <h2 className="text-2xl font-semibold">Session complete</h2>
          <p>You reviewed {set.cards.length} cards. Your ratings have been saved.</p>
          <ul className="space-y-2">{ratings.map((rating) => <li key={rating.value}>{rating.label}: {counts[rating.value]}</li>)}</ul>
          <div className="flex flex-wrap gap-4">
            <button className="rounded-lg bg-primary px-5 py-2 text-primary-foreground" onClick={() => { setIndex(0); setFlipped(false); setSelected(null); setCounts({ easy: 0, practice: 0, hard: 0 }); }}>Study again</button>
            <Link className="rounded-lg border px-5 py-2" href={`/dashboard/flashcards/${setId}`}>View all cards</Link>
          </div>
        </section> : card && <>
          <p aria-live="polite">Card {index + 1} of {set.cards.length}</p>
          <progress className="h-2 w-full" value={index} max={set.cards.length} aria-label="Cards reviewed" />
          <button ref={flipButton} type="button" disabled={busy} aria-label={`Showing ${flipped ? "back" : "front"}. Flip card.`} aria-pressed={flipped}
            onClick={() => setFlipped((prev) => !prev)} className="flex min-h-72 w-full flex-col items-center justify-center gap-6 rounded-2xl border bg-card p-8 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            <span className="text-sm uppercase tracking-widest text-muted-foreground">{flipped ? "Back · Answer" : "Front · Question"}</span>
            <span className="w-full whitespace-pre-wrap break-words text-2xl" aria-live="polite">{flipped ? card.answer : card.question}</span>
            <span className="text-sm text-muted-foreground">Click or press Enter / Space to flip</span>
          </button>
          {flipped && <fieldset disabled={busy} className="space-y-3">
            <legend className="mb-3 font-semibold">How well did you understand this card?</legend>
            <div className="flex flex-wrap gap-3">{ratings.map((rating) => <label key={rating.value} className={`cursor-pointer rounded-lg border px-4 py-3 ${selected === rating.value ? "border-primary bg-primary text-primary-foreground" : ""}`}>
              <input className="mr-2" type="radio" name="rating" value={rating.value} checked={selected === rating.value} onChange={() => setSelected(rating.value)} />{rating.label}
            </label>)}</div>
          </fieldset>}
          <button disabled={!selected || busy} onClick={next} className="rounded-lg bg-primary px-6 py-3 text-primary-foreground disabled:opacity-50">{busy ? "Saving rating…" : index === set.cards.length - 1 ? "Finish session" : "Next card →"}</button>
        </>}
      </>}
    </div>
  </main>;
}
