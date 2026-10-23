"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type FlashcardDraft = {
  id: number;
  term: string;
  definition: string;
};

export default function CreateFlashCard() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cards, setCards] = useState<FlashcardDraft[]>([
    { id: 1, term: "", definition: "" },
    { id: 2, term: "", definition: "" },
  ]);
  const [nextCardId, setNextCardId] = useState(3);

  const updateCard = (
    id: number,
    field: "term" | "definition",
    value: string,
  ) => {
    setCards((current) =>
      current.map((card) =>
        card.id === id ? { ...card, [field]: value } : card,
      ),
    );
  };

  const addCard = () => {
    setCards((current) => [
      ...current,
      { id: nextCardId, term: "", definition: "" },
    ]);
    setNextCardId((current) => current + 1);
  };

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-8 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              StudySync Study Tools
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              Create Flashcards
            </h1>
          </div>
        </header>

        <Separator />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-8">
            <section className="space-y-6 lg:col-span-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Flashcard Set Details</CardTitle>
                        <CardDescription>Give your set a name and an optional description.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                           <label htmlFor="title" className="text-sm font-medium text-muted-foreground">Title</label>
                           <Input
                                id="title"
                                className="w-full"
                                placeholder="Introduction to Computer Science"
                                required
                            />     
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="description" className="text-sm font-medium text-muted-foreground">Description</label>
                            <textarea
                                id="set-description"
                                rows={3}
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                placeholder="Add a description for this set"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            />
                        </div>
                    </CardContent>
                </Card>
            </section>
        </div>

        <section className="space-y-5">
          {cards.map((card, index) => (
            <article
              key={card.id}
              className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm md:p-6"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {index + 1}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor={`term-${card.id}`} className="block text-sm font-medium text-muted-foreground">
                    Term
                  </label>
                  <Input
                    id={`term-${card.id}`}
                    value={card.term}
                    onChange={(event) =>
                      updateCard(card.id, "term", event.target.value)
                    }
                    placeholder="Enter term"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`definition-${card.id}`} className="text-sm font-medium text-muted-foreground">
                    Definition
                  </label>
                  <textarea
                    id={`definition-${card.id}`}
                    value={card.definition}
                    onChange={(event) =>
                      updateCard(card.id, "definition", event.target.value)
                    }
                    placeholder="Enter definition"
                    rows={1}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </article>
          ))}
        </section>

        <div className="flex justify-center">
          <Button
            type="button"
            variant="secondary"
            onClick={addCard}
            className="rounded-full px-8"
          >
            Add a card
          </Button>
        </div>
      </div>
    </main>
  );
}