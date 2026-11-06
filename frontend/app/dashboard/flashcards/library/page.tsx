"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
          : "Unable to save or load flashcards. Please try again."
    );
  }

  return response;
}

async function listFlashcardSets(): Promise<SetData[]> {
  const response = await flashcardRequest();
  return (await response.json()) as SetData[];
}

export default function FlashcardLibrary() 
{
  const [sets, setSets] = useState<SetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    listFlashcardSets().then((data) => { if (active) setSets(data); })
      .catch((e: Error) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = sets.filter((set) => `${set.title} ${set.description ?? ""} ${set.course_id}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm text-muted-foreground">Library</p><h1 className="text-3xl font-bold">Your flashcard sets</h1></div>
          <Link href="/dashboard/flashcards" className="rounded-lg bg-primary px-5 py-3 text-primary-foreground">+ Create flashcards</Link>
        </header>

        <label className="block">Search by title, description, or course
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="mt-2 w-full rounded-lg border p-3" />
        </label>

        {loading && <p role="status">Loading flashcards…</p>}
        {error && <p role="alert" className="text-red-600">{error}</p>}
        {!loading && !error && !sets.length && <p>No flashcard sets yet. Create a set to start studying.</p>}
        {!loading && sets.length > 0 && !visible.length && <p>No sets match your search.</p>}
        
        <section aria-label="Flashcard sets" className="grid gap-4 md:grid-cols-2">
          {visible.map((set) => <article key={set.flashcardsets_id} className="space-y-4 rounded-xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{set.course_id} · {set.cards.length} cards</p>
            <h2 className="break-words text-xl font-semibold"><Link className="underline" href={`/dashboard/flashcards/${set.flashcardsets_id}`}>{set.title}</Link></h2>
            <p className="whitespace-pre-wrap break-words text-muted-foreground">{set.description}</p>
            
            <div className="flex gap-4">
              <Link className="underline" href={`/dashboard/flashcards/${set.flashcardsets_id}/study`}>Study</Link>
              <Link className="underline" href={`/dashboard/flashcards/${set.flashcardsets_id}/edit`}>Edit set</Link>
            </div>
            
          </article>)}
        </section>

      </div>
    </main>
  );
}
