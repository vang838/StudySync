"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import type { Rating, SetData } from "@/lib/types/flashcard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
  const [counts, setCounts] = useState<Record<Rating, number>>({
    easy: 0,
    practice: 0,
    hard: 0,
  });
  const saving = useRef(false);
  const flipButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    getFlashcardSet(setId)
      .then((data) => {
        if (active) setSet(data);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });

    return () => {
      active = false;
    };
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">
              StudySync Flashcards
            </p>
            <h1 className="break-words font-heading text-3xl font-bold">
              {set?.title ?? "Study flashcards"}
            </h1>
          </div>
          <Link href="/dashboard/flashcards/library">
            <Button variant="secondary" size="s">
                Go to Flashcard Library
            </Button>
          </Link>
        </header>

        <Separator />

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        {!set && !error && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading study session…
          </p>
        )}

        {set && complete && (
          <Card aria-live="polite">
            <CardHeader>
              <CardTitle>Session complete</CardTitle>
              <CardDescription>
                You reviewed {set.cards.length} cards. Your ratings have been
                saved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {ratings.map((rating) => (
                  <li key={rating.value}>
                    {rating.label}: {counts[rating.value]}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  setIndex(0);
                  setFlipped(false);
                  setSelected(null);
                  setCounts({ easy: 0, practice: 0, hard: 0 });
                }}
              >
                Study again
              </Button>
              <Link href={`/dashboard/flashcards/${setId}`}>
                <Button variant="outline">View all cards</Button>
              </Link>
            </CardFooter>
          </Card>
        )}

        {set && !complete && card && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>
                  Card {index + 1} of {set.cards.length}
                </CardTitle>
                <CardDescription>
                  Select the card to reveal its answer. Use Enter or Space to
                  flip it.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <progress
                  className="h-2 w-full accent-primary"
                  value={index}
                  max={set.cards.length}
                  aria-label="Cards reviewed"
                />
              </CardContent>
            </Card>

            <Card className="overflow-visible bg-transparent p-0 ring-0">
              <div className="[perspective:1200px]">
                <button
                  ref={flipButton}
                  type="button"
                  disabled={busy}
                  aria-label={`Card ${index + 1}. ${flipped ? "Answer" : "Question"}: ${flipped ? card.answer : card.question}. Flip to ${flipped ? "question" : "answer"}.`}
                  aria-pressed={flipped}
                  onClick={() => setFlipped((prev) => !prev)}
                  className="block w-full rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-wait"
                >
                  <span
                    className="grid min-h-72 w-full transition-transform duration-500 motion-reduce:transition-none [transform-style:preserve-3d]"
                    style={{
                      transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="col-start-1 row-start-1 flex min-h-72 flex-col items-center justify-center gap-6 rounded-xl border bg-card p-8 text-card-foreground shadow-sm [backface-visibility:hidden]"
                    >
                      <span className="text-sm uppercase tracking-widest text-muted-foreground">
                        Front · Question
                      </span>
                      <span className="w-full whitespace-pre-wrap break-words text-center text-2xl">
                        {card.question}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Click or press Enter / Space to flip
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="col-start-1 row-start-1 flex min-h-72 flex-col items-center justify-center gap-6 rounded-xl border bg-card p-8 text-card-foreground shadow-sm [transform:rotateY(180deg)] [backface-visibility:hidden]"
                    >
                      <span className="text-sm uppercase tracking-widest text-muted-foreground">
                        Back · Answer
                      </span>
                      <span className="w-full whitespace-pre-wrap break-words text-center text-2xl">
                        {card.answer}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Click or press Enter / Space to flip back
                      </span>
                    </span>
                  </span>
                </button>
              </div>
            </Card>

            {flipped && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    How well did you understand this card?
                  </CardTitle>
                  <CardDescription>
                    Your rating is saved when you continue.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <fieldset
                    disabled={busy}
                    className="flex flex-wrap gap-3"
                  >
                    <legend className="sr-only">
                      Choose how well you understood this card
                    </legend>
                    {ratings.map((rating) => (
                      <label
                        key={rating.value}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-4 py-3 text-sm transition-colors ${
                          selected === rating.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        <input
                          type="radio"
                          name="rating"
                          value={rating.value}
                          checked={selected === rating.value}
                          onChange={() => setSelected(rating.value)}
                        />
                        {rating.label}
                      </label>
                    ))}
                  </fieldset>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-start">
              <Button disabled={!selected || busy} onClick={next}>
                {busy
                  ? "Saving rating…"
                  : index === set.cards.length - 1
                    ? "Finish session"
                    : "Next card →"}
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
