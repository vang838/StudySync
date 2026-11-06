"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import type { SetData } from "@/lib/types/flashcard";

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
          : "Unable to load flashcards. Please try again."
    );
  }

  return response;
}

async function getFlashcardSet(setId: string): Promise<SetData> {
  const response = await flashcardRequest(`/${encodeURIComponent(setId)}`);
  return (await response.json()) as SetData;
}

export default function FlashcardSetPage({
  params,
}: {
  params: Promise<{ setId: string }>;
}) {
  const { setId } = use(params);
  const [set, setSet] = useState<SetData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getFlashcardSet(setId)
      .then((data) => {
        if (active) setSet(data);
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message);
      });

    return () => {
      active = false;
    };
  }, [setId]);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-6 pb-12">
        <Link className="underline" href="/dashboard/flashcards/library">
          ← Flashcard library
        </Link>
        {error && <p role="alert" className="text-red-600">{error}</p>}
        {!set && !error && <p role="status">Loading set…</p>}
        {set && (
          <>
            <header className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {set.course_id} · {set.cards.length} cards
              </p>
              <h1 className="break-words text-3xl font-bold">{set.title}</h1>
              <p className="whitespace-pre-wrap break-words">
                {set.description}
              </p>
              <div className="flex gap-4">
                <Link
                  className="rounded-lg bg-primary px-5 py-2 text-primary-foreground"
                  href={`/dashboard/flashcards/${setId}/study`}
                >
                  Study set
                </Link>
                <Link
                  className="rounded-lg border px-5 py-2"
                  href={`/dashboard/flashcards/${setId}/edit`}
                >
                  Edit cards
                </Link>
              </div>
            </header>
            <h2 className="text-xl font-semibold">Cards in this set</h2>
            <ol className="space-y-4">
              {set.cards.map((card, index) => (
                <li
                  key={card.flashcard_id}
                  className="rounded-xl border p-5"
                >
                  <h3 className="mb-3 font-semibold">Card {index + 1}</h3>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm text-muted-foreground">Front</dt>
                      <dd className="whitespace-pre-wrap break-words">
                        {card.question}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Back</dt>
                      <dd className="whitespace-pre-wrap break-words">
                        {card.answer}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </main>
  );
}
