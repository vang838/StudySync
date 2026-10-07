"use client";

import { useRef, useState, type PointerEvent } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 420;

export default function AssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

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
          className={`fixed right-0 top-0 z-50 flex h-screen flex-col border-l bg-background shadow-xl ${
            resizing ? "select-none" : ""
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

          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Ask questions about your studies, coursework, or anything else you need help with.
          </div>

          <div className="border-t p-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask a question..."
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none"
              />

              <Button type="button" disabled>
                Send
              </Button>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}