"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SetData } from "@/lib/types/flashcard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

async function listFlashcardSets(): Promise<SetData[]> {
  const response = await flashcardRequest();
  return (await response.json()) as SetData[];
}

export default function FlashcardLibrary() {
  const [sets, setSets] = useState<SetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    listFlashcardSets()
      .then((data) => {
        if (active) setSets(data);
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
  }, []);

  const visible = sets.filter((set) =>
    `${set.title} ${set.description ?? ""} ${set.course_id}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">
              StudySync Flashcards
            </p>
            <h1 className="font-heading text-3xl font-bold">
              Your Flashcard Sets
            </h1>
          </div>
          <Link href="/dashboard/flashcards">
            <Button>+ Create flashcards</Button>
          </Link>
        </header>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>Search Flashcard Sets</CardTitle>
            <CardDescription>
              Search by set title, description, or course number.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="search"
              aria-label="Search flashcard sets"
              placeholder="Search flashcards..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full"
            />
          </CardContent>
        </Card>

        {loading && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading flashcards…
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        {!loading && !error && sets.length === 0 && (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No flashcard sets yet. Create a set to start studying.
            </CardContent>
          </Card>
        )}
        {!loading && !error && sets.length > 0 && visible.length === 0 && (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No sets match your search.
            </CardContent>
          </Card>
        )}
        {!loading && !error && visible.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              {visible.length} flashcard set{visible.length === 1 ? "" : "s"}
            </p>
            <section
              aria-label="Flashcard sets"
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
            >
              {visible.map((set) => (
                <Card key={set.flashcardsets_id} className="h-full">
                  <CardHeader>
                    <CardDescription>
                      {set.course_id} · {set.cards.length}{" "}
                      {set.cards.length === 1 ? "card" : "cards"}
                    </CardDescription>
                    <CardTitle className="break-words">
                      <Link
                        href={`/dashboard/flashcards/${set.flashcardsets_id}`}
                        className="hover:underline"
                      >
                        {set.title}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {set.description || "No description provided."}
                    </p>
                  </CardContent>
                  <CardFooter className="flex flex-nowrap justify-center gap-2">
                    <Link
                      href={`/dashboard/flashcards/${set.flashcardsets_id}/study`}
                    >
                      <Button size="s">Study</Button>
                    </Link>
                    <Link
                      href={`/dashboard/flashcards/${set.flashcardsets_id}/edit`}
                    >
                      <Button variant="outline" size="s">
                        Edit set
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
