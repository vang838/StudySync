"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import type { SetData } from "@/lib/types/flashcard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">
              StudySync Flashcards
            </p>
            <h1 className="break-words font-heading text-3xl font-bold">
              {set?.title ?? "Flashcard Set"}
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
            Loading set…
          </p>
        )}

        {set && (
          <>
            <Card>
              <CardHeader>
                <CardDescription>
                  {set.course_id} · {set.cards.length}{" "}
                  {set.cards.length === 1 ? "card" : "cards"}
                </CardDescription>
                <CardTitle className="break-words">{set.title}</CardTitle>
                {set.description && (
                  <CardDescription className="whitespace-pre-wrap break-words">
                    {set.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Link
                  href={`/dashboard/flashcards/${setId}/study`}
                >
                  <Button>Study set</Button>
                </Link>
                <Link
                  href={`/dashboard/flashcards/${setId}/edit`}
                >
                  <Button variant="outline">Edit cards</Button>
                </Link>
              </CardContent>
            </Card>

            <section aria-label="Cards in this set" className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
                  SET CONTENTS
                </p>
                <h2 className="mt-1 font-heading text-2xl font-semibold">
                  Cards in this set
                </h2>
              </div>
              <div className="grid gap-4">
                {set.cards.map((card, index) => (
                  <Card key={card.flashcard_id}>
                    <CardHeader>
                      <CardTitle>Card {index + 1}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <dl className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                          <dt className="text-sm font-medium text-muted-foreground">
                            Term
                          </dt>
                          <dd className="whitespace-pre-wrap break-words">
                            {card.question}
                          </dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-sm font-medium text-muted-foreground">
                            Definition
                          </dt>
                          <dd className="whitespace-pre-wrap break-words">
                            {card.answer}
                          </dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
