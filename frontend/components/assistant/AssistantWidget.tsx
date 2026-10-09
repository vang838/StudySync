"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type SyntheticEvent,
} from "react";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 420;

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "general" | "course";
};

type ChatResponse = {
  answer: string;
  mode: "general" | "course";
};

export default function AssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  useEffect(() => {
    const assistantWidth = open
      ? `min(${width}px, 66.6667vw)`
      : "0px";

    document.documentElement.style.setProperty(
      "--assistant-width",
      assistantWidth
    );

    return () => {
      document.documentElement.style.removeProperty("--assistant-width");
    };
  }, [open, width]);

  if (pathname.startsWith("/auth")) {
    return null;
  }

  function handleResizeStart(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStartX.current = event.clientX;
    resizeStartWidth.current = width;
    setResizing(true);
  }

  function handleResize(event: PointerEvent<HTMLDivElement>) {
    if (!resizing) {
      return;
    }

    const nextWidth =
      resizeStartWidth.current + resizeStartX.current - event.clientX;
    const maxWidth = window.innerWidth * (2 / 3);
    const minWidth = Math.min(MIN_WIDTH, maxWidth);

    setWidth(Math.min(maxWidth, Math.max(minWidth, nextWidth)));
  }

  function handleResizeEnd(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setResizing(false);
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const question = input.trim();

    if (!question) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
      },
    ]);

    setInput("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          question,
        }),
      });

      if (!response.ok) {
        throw new Error("Assistant request failed");
      }

      const data: ChatResponse = await response.json();

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          mode: data.mode,
        },
      ]);
    } catch (error) {
      console.error("Unable to generate assistant response.", error);
    }
  }

  return (
    <>
      {!open && (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 shadow-lg"
        >
          Ask AI
        </Button>
      )}

      {open && (
        <aside
          className={`fixed right-0 top-0 z-50 flex h-screen flex-col border-l bg-background shadow-xl ${resizing ? "select-none" : ""
            }`}
          style={{
            width: `${width}px`,
            maxWidth: "66.6667vw",
          }}
        >
          <div
            role="separator"
            aria-label="Resize AI assistant"
            aria-orientation="vertical"
            onPointerDown={handleResizeStart}
            onPointerMove={handleResize}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="absolute left-0 top-0 z-10 h-full w-2 -translate-x-1 cursor-ew-resize touch-none hover:bg-border/70"
          />

          <div className="flex items-start justify-between border-b p-4">
            <div>
              <h2 className="font-semibold">StudySync AI</h2>
              <p className="text-sm text-muted-foreground">
                Context: Auto
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                Ask questions about your studies, coursework, or anything else you need help with.
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${message.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto bg-muted"
                    }`}
                >
                  {message.content}
                </div>
              ))
            )}
          </div>

          <div className="border-t p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask a question..."
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none"
              />

              <Button type="submit" disabled={!input.trim()}>
                Send
              </Button>
            </form>
          </div>
        </aside>
      )}
    </>
  );
}