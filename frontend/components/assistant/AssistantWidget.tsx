
"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type SyntheticEvent,
} from "react";

import { useParams, usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Clock01Icon, NoteEditIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 420;

type InternalCitation = {
  source_type: "internal";
  evidence_id: string | null;
  claim_ids: string[];
  document_id: string;
  page_start: number | null;
  page_end: number | null;
  section_title: string | null;
};

type ExternalCitation = {
  source_type: "external";
  evidence_id: string | null;
  claim_ids: string[];
  provider: string;
  title: string | null;
  url: string;
};

type Citation = InternalCitation | ExternalCitation;

type ClaimEvidenceAssociation = {
  evidence_id: string;
  relationship: "supports" | "contradicts" | "irrelevant";
  confidence: number;
};

type GeneratedClaim = {
  claim_id: string;
  text: string;
  evidence: ClaimEvidenceAssociation[];
  has_agreement: boolean;
  has_conflict: boolean;
  is_insufficient: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "general" | "course";
  evidenceStatus?: "not_applicable" | "sufficient" | "conflicting" | "insufficient";
  citations?: Citation[];
  claims?: GeneratedClaim[];
};

type ChatResponse = {
  chat_id: string;
  conversation_id: string;
  answer: string;
  mode: "general" | "course";
  evidence_status: "not_applicable" | "sufficient" | "conflicting" | "insufficient";
  citations: Citation[];
  claims: GeneratedClaim[];
};

type ChatConversationSummary = {
  conversation_id: string;
  course_id: string | null;
  title: string;
  updated_at: string;
};

type ChatConversationListResponse = {
  items: ChatConversationSummary[];
  has_more: boolean;
};

type ChatConversationDetail = {
  conversation_id: string;
  course_id: string | null;
  turns: Array<ChatResponse & {
    question: string;
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  }>;
};

type SavedCourse = {
  course_id: string;
  title: string;
};

function internalCitationLabel(citation: InternalCitation) {
  const location = citation.page_start
    ? citation.page_end && citation.page_end !== citation.page_start
      ? `pages ${citation.page_start}-${citation.page_end}`
      : `page ${citation.page_start}`
    : null;

  return [citation.section_title, location, `document ${citation.document_id}`]
    .filter(Boolean)
    .join(" · ");
}

function CitationList({ citations, claim }: { citations: Citation[]; claim: GeneratedClaim }) {
  const claimCitations = citations.filter((citation) =>
    citation.claim_ids.includes(claim.claim_id)
  );

  if (claimCitations.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-t border-border/60 pt-2 text-xs">
      <div className="font-medium">Sources</div>
      <ol className="mt-1 list-decimal space-y-1 pl-4 text-muted-foreground">
        {claimCitations.map((citation, index) => {
          const relationship = claim.evidence.find(
            (association) => association.evidence_id === citation.evidence_id
          )?.relationship;

          return (
            <li key={citation.evidence_id ?? `${citation.source_type}-${index}`}>
              <span className={relationship === "contradicts" ? "font-medium text-amber-700 dark:text-amber-400" : "font-medium"}>
                {relationship === "contradicts" ? "Conflicts" : "Supports"}
              </span>
              {" — "}
              {citation.source_type === "external" ? (
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {citation.title ?? citation.url}
                </a>
              ) : (
                internalCitationLabel(citation)
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AssistantMessageContent({ message }: { message: ChatMessage }) {
  const claims = message.claims ?? [];
  const hasUnresolvedClaim = claims.some((claim) => claim.is_insufficient);

  if (claims.length === 0) {
    return <div>{message.content}</div>;
  }

  if (hasUnresolvedClaim) {
    return (
      <>
        <div>{message.content}</div>
        {message.evidenceStatus === "conflicting" && claims.map((claim) => (
          <div key={claim.claim_id} className="mt-3 border-t border-border/60 pt-2">
            <div className="text-xs font-medium">Disputed claim</div>
            <div className="mt-1">{claim.text}</div>
            <CitationList citations={message.citations ?? []} claim={claim} />
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="space-y-3">
      {claims.map((claim) => (
        <div key={claim.claim_id}>
          <div>{claim.text}</div>
          <CitationList citations={message.citations ?? []} claim={claim} />
        </div>
      ))}
    </div>
  );
}

export default function AssistantWidget() {
  const pathname = usePathname();
  const params = useParams<{ courseId?: string }>();
  const courseId = params.courseId ? decodeURIComponent(params.courseId) : undefined;

  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hintLevel, setHintLevel] = useState(1);
  const [activeQuestion, setActiveQuestion] = useState("");
  const [activeCourseId, setActiveCourseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    courseId ?? ""
  );

  const conversationIdRef = useRef<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const requestVersionRef = useRef(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [histories, setHistories] = useState<ChatConversationSummary[]>([]);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyRequestVersionRef = useRef(0);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  useEffect(() => {
    // A route-selected course starts a separate conversation.
    conversationIdRef.current = null;
    requestVersionRef.current += 1;
    historyRequestVersionRef.current += 1;

    /* eslint-disable react-hooks/set-state-in-effect */
    setActiveConversationId(null);
    setSelectedCourseId(courseId ?? "");
    setMessages([]);
    setInput("");
    setLoading(false);
    setHintLevel(1);
    setActiveQuestion("");
    setActiveCourseId("");
    setError(null);
    setHistoryOpen(false);
    setHistoryLoading(false);
    setRestoring(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [courseId]);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    async function fetchSavedCourses() {
      try {
        const userId = Number(localStorage.getItem("user_id"));

        if (!Number.isInteger(userId) || userId < 1) {
          throw new Error("Invalid user ID.");
        }

        const response = await fetch(
          `/api/courses/saved?user_id=${userId}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Failed to load saved courses.");
        }

        const data: SavedCourse[] = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid saved courses response.");
        }

        if (!controller.signal.aborted) {
          setSavedCourses(data);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Unable to load saved courses.", error);
        setSavedCourses([]);
      }
    }

    void fetchSavedCourses();

    return () => controller.abort();
  }, [open]);

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

  function resetConversation() {
    requestVersionRef.current += 1;
    historyRequestVersionRef.current += 1;
    setHistoryOpen(false);
    setHistoryLoading(false);
    setHistoryError(null);
    conversationIdRef.current = null;
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setLoading(false);
    setHintLevel(1);
    setActiveQuestion("");
    setActiveCourseId("");
    setError(null);
  }

  async function loadHistoryPage(offset: number, append = false) {
    const requestVersion = ++historyRequestVersionRef.current;
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const response = await fetch(`/api/chat/conversations?limit=20&offset=${offset}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Unable to load history (${response.status}).`);

      const data: ChatConversationListResponse = await response.json();
      if (historyRequestVersionRef.current !== requestVersion) return;
      setHistories((current) => append ? [...current, ...data.items] : data.items);
      setHistoryHasMore(data.has_more);
    } catch (error) {
      if (historyRequestVersionRef.current !== requestVersion) return;
      console.error("Unable to load chat history.", error);
      setHistoryError("Unable to load conversations. Please try again.");
    } finally {
      if (historyRequestVersionRef.current === requestVersion) setHistoryLoading(false);
    }
  }

  function toggleHistory() {
    if (loading || restoring) return;
    if (historyOpen) {
      historyRequestVersionRef.current += 1;
      setHistoryLoading(false);
      setHistoryOpen(false);
      return;
    }

    setHistoryOpen(true);
    void loadHistoryPage(0);
  }

  async function restoreConversation(item: ChatConversationSummary) {
    if (loading || restoring || historyLoading) return;
    const requestVersion = ++requestVersionRef.current;
    historyRequestVersionRef.current += 1;
    setRestoring(true);
    setHistoryError(null);

    try {
      const response = await fetch(`/api/chat/conversations/${encodeURIComponent(item.conversation_id)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Unable to load conversation (${response.status}).`);

      const data: ChatConversationDetail = await response.json();
      if (requestVersionRef.current !== requestVersion) return;
      if (data.conversation_id !== item.conversation_id || !Array.isArray(data.turns)) {
        throw new Error("Invalid conversation response.");
      }

      const restoredMessages: ChatMessage[] = data.turns.flatMap((turn) =>
        turn.messages.flatMap((message, index): ChatMessage[] => {
          if (message.role !== "user" && message.role !== "assistant") return [];
          return [{
            id: `${turn.chat_id}-${index}`,
            role: message.role,
            content: message.content,
            ...(message.role === "assistant" ? {
              mode: turn.mode,
              evidenceStatus: turn.evidence_status,
              citations: turn.citations,
              claims: turn.claims,
            } : {}),
          }];
        })
      );

      conversationIdRef.current = data.conversation_id;
      setActiveConversationId(data.conversation_id);
      setSelectedCourseId(data.course_id ?? "");
      setMessages(restoredMessages);
      setInput("");
      setHintLevel(1);
      setActiveQuestion("");
      setActiveCourseId("");
      setError(null);
      setHistoryOpen(false);
    } catch (error) {
      if (requestVersionRef.current !== requestVersion) return;
      console.error("Unable to restore conversation.", error);
      setHistoryError("Unable to open that conversation. Please try again.");
    } finally {
      if (requestVersionRef.current === requestVersion) setRestoring(false);
    }
  }

  function handleCourseChange(nextCourseId: string) {
    if (nextCourseId === selectedCourseId) return;
    resetConversation();
    setSelectedCourseId(nextCourseId);
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
    if (!question || loading) return;

    const requestVersion = requestVersionRef.current;
    const questionMessageId = crypto.randomUUID();
    const selectedCourse = selectedCourseId;

    setError(null);
    setLoading(true);
    setHintLevel(1);
    setActiveQuestion("");

    setMessages((current) => [
      ...current,
      {
        id: questionMessageId,
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
          ...(conversationIdRef.current ? { conversation_id: conversationIdRef.current } : {}),
          ...(selectedCourse ? { course_id: selectedCourse, hint_level: 1 } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(`Assistant request failed (${response.status}).`);
      }

      const data: ChatResponse = await response.json();
      if (requestVersionRef.current !== requestVersion) return;
      if (!data.conversation_id) throw new Error("Missing conversation ID.");

      conversationIdRef.current = data.conversation_id;
      setActiveConversationId(data.conversation_id);
      setActiveQuestion(question);
      setActiveCourseId(selectedCourse);

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          mode: data.mode,
          evidenceStatus: data.evidence_status,
          citations: data.citations,
          claims: data.claims,
        },
      ]);
    } catch (error) {
      if (requestVersionRef.current !== requestVersion) return;

      console.error("Unable to generate assistant response.", error);
      setMessages((current) => current.filter((message) => message.id !== questionMessageId));
      setInput(question);
      setError("Failed to get a response. Please try again.");
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setLoading(false);
      }
    }
  }

  async function handleNextHint() {
    const conversationId = conversationIdRef.current;

    if (loading || !activeQuestion || !activeCourseId || !conversationId || hintLevel >= 4) {
      return;
    }

    const requestVersion = requestVersionRef.current;
    const nextLevel = hintLevel + 1;

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          question: activeQuestion,
          conversation_id: conversationId,
          hint_level: nextLevel,
          course_id: activeCourseId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Assistant request failed (${response.status}).`);
      }

      const data: ChatResponse = await response.json();
      if (requestVersionRef.current !== requestVersion) return;
      if (data.conversation_id !== conversationId) throw new Error("Conversation ID mismatch.");

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          mode: data.mode,
          evidenceStatus: data.evidence_status,
          citations: data.citations,
          claims: data.claims,
        },
      ]);

      setHintLevel(nextLevel);
    } catch (error) {
      if (requestVersionRef.current !== requestVersion) return;

      console.error("Unable to generate next hint.", error);
      setError("Failed to get the next hint. Please try again.");
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setLoading(false);
      }
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
          className={`@container fixed right-0 top-0 z-50 flex h-screen flex-col border-l bg-background shadow-xl ${resizing ? "select-none" : ""
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

          <div className="border-b p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="min-w-0 truncate font-semibold">StudySync AI</h2>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant={historyOpen ? "secondary" : "ghost"}
                  size="icon"
                  aria-label={historyOpen ? "Back to chat" : "Show chat history"}
                  title={historyOpen ? "Back to chat" : "Chat history"}
                  aria-pressed={historyOpen}
                  onClick={toggleHistory}
                  disabled={loading || restoring}
                >
                  <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="New Chat"
                  title="New Chat"
                  onClick={resetConversation}
                  disabled={loading || restoring}
                  className="@min-[440px]:w-auto @min-[440px]:px-3"
                >
                  <HugeiconsIcon icon={NoteEditIcon} strokeWidth={2} aria-hidden="true" />
                  <span className="hidden @min-[440px]:inline">New Chat</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Close assistant"
                  title="Close assistant"
                  onClick={() => setOpen(false)}
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} aria-hidden="true" />
                </Button>
              </div>
            </div>
            <select
              aria-label="Select course context"
              title="Changing courses starts a new chat"
              value={selectedCourseId}
              onChange={(event) => handleCourseChange(event.target.value)}
              disabled={loading || restoring}
              className="mt-3 w-full min-w-0 rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              <option value="">General</option>
              {courseId && !savedCourses.some((course) => course.course_id === courseId) && (
                <option value={courseId}>{courseId}</option>
              )}
              {selectedCourseId && selectedCourseId !== courseId && !savedCourses.some(
                (course) => course.course_id === selectedCourseId
              ) && <option value={selectedCourseId}>{selectedCourseId}</option>}
              {savedCourses.map((course) => (
                <option key={course.course_id} value={course.course_id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {historyOpen ? (
              <section aria-label="Conversation history" className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">Recent conversations</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Refresh chat history"
                    aria-label="Refresh chat history"
                    disabled={historyLoading || restoring}
                    onClick={() => void loadHistoryPage(0)}
                  >
                    <HugeiconsIcon icon={Clock01Icon} aria-hidden="true" />
                  </Button>
                </div>

                {historyError && <p role="alert" className="text-sm text-destructive">{historyError}</p>}
                {historyLoading && histories.length === 0 && (
                  <p role="status" className="text-sm text-muted-foreground">Loading conversations...</p>
                )}
                {!historyLoading && histories.length === 0 && !historyError && (
                  <p className="text-sm text-muted-foreground">No saved conversations yet.</p>
                )}

                {histories.map((item) => (
                  <button
                    key={item.conversation_id}
                    type="button"
                    onClick={() => void restoreConversation(item)}
                    disabled={historyLoading || restoring}
                    aria-current={activeConversationId === item.conversation_id ? "true" : undefined}
                    className="w-full min-w-0 rounded-lg border border-input p-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 aria-[current=true]:border-secondary"
                  >
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {item.course_id ?? "General"} · {new Date(item.updated_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}

                {historyHasMore && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={historyLoading || restoring}
                    onClick={() => void loadHistoryPage(histories.length, true)}
                  >
                    {historyLoading ? "Loading..." : "Load older conversations"}
                  </Button>
                )}
                {restoring && <p role="status" className="text-sm text-muted-foreground">Opening conversation...</p>}
              </section>
            ) : messages.length === 0 ? (
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
                  {message.evidenceStatus === "conflicting" && (
                    <div className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                      Conflicting evidence detected
                    </div>
                  )}
                  {message.evidenceStatus === "insufficient" && (
                    <div className="mt-2 text-xs font-medium text-muted-foreground">
                      Evidence was insufficient
                    </div>
                  )}
                  <AssistantMessageContent message={message} />
                </div>
              ))
            )}

            {!historyOpen && loading && (
              <div
                role="status"
                className="mr-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"
              >
                Thinking...
              </div>
            )}

            {!historyOpen && error && (
              <div
                role="alert"
                className="mr-auto max-w-[85%] rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}
          </div>

          {!historyOpen && <div className="border-t p-4">
            {activeQuestion && activeCourseId && hintLevel < 4 && !loading && (
              <Button
                type="button"
                variant="outline"
                onClick={handleNextHint}
                className="mb-3 w-full"
              >
                Next Hint (Level {hintLevel + 1})
              </Button>
            )}

            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask a question..."
                aria-label="Ask the AI assistant"
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none"
              />

              <Button type="submit" disabled={!input.trim() || loading} className="w-auto shrink-0 px-4">
                {loading ? "Thinking..." : "Send"}
              </Button>
            </form>
          </div>}
        </aside>
      )}
    </>
  );
}
