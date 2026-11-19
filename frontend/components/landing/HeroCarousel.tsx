
"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowRight01Icon,
    BookOpen01Icon,
    Calendar03Icon,
    CheckmarkCircle01Icon,
    FileTextIcon,
    Upload01Icon,
} from "@hugeicons/core-free-icons";

const slides = [
    { title: "AI Study Assistant", subtitle: "Explore answers grounded in your course materials.", kind: "assistant" },
    { title: "Learning Workflow", subtitle: "Go from study materials to focused practice.", kind: "workflow" },
    { title: "Feature Workspace", subtitle: "Everything you need in one learning space.", kind: "workspace" },
] as const;

type SlideKind = (typeof slides)[number]["kind"];

function SlidePreview({ kind }: { kind: SlideKind }) {
    if (kind === "assistant") return (
        <div className="space-y-3 rounded-xl bg-slate-50 p-3 text-xs">
            <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-white p-2">
                <HugeiconsIcon icon={FileTextIcon} size={20} className="text-secondary" />
                <div>
                    <p className="font-semibold">Cell Structure Lecture.pdf</p>
                    <p className="text-[10px] text-muted-foreground">Illustrative document</p>
                </div>
            </div>

            <p className="ml-auto max-w-[85%] rounded-xl bg-blue-100 p-3 text-foreground">
                What does the cell membrane do?
            </p>

            <div className="rounded-xl border border-blue-100 bg-white p-3 leading-5 text-foreground">
                <p>It regulates what enters and leaves a cell and helps maintain a stable internal environment.</p>
                <p className="mt-2 text-[10px] font-semibold text-secondary">
                    Example citation: Lecture notes, pp. 3–4
                </p>
            </div>
        </div>
    );

    if (kind === "workflow") return (
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1 rounded-xl bg-slate-50 p-3">
            {[
                { title: "Upload", icon: Upload01Icon },
                { title: "Study", icon: BookOpen01Icon },
                { title: "Practice", icon: CheckmarkCircle01Icon },
            ].map((step, index) => (
                <div className="contents" key={step.title}>
                    {index > 0 && <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="text-secondary" />}
                    <div className="rounded-lg border border-blue-100 bg-white px-1 py-5 text-center shadow-sm">
                        <HugeiconsIcon icon={step.icon} size={25} className="mx-auto text-secondary" />
                        <p className="mt-2 text-[11px] font-semibold">{step.title}</p>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3">
            {[
                { title: "AI Assistant", icon: BookOpen01Icon },
                { title: "Flashcards", icon: FileTextIcon },
                { title: "Practice Exams", icon: CheckmarkCircle01Icon },
                { title: "Planner", icon: Calendar03Icon },
            ].map((tool) => (
                <div key={tool.title} className="rounded-lg border border-blue-100 bg-white p-4 text-center shadow-sm">
                    <HugeiconsIcon icon={tool.icon} size={24} className="mx-auto text-secondary" />
                    <p className="mt-2 text-[11px] font-semibold">{tool.title}</p>
                </div>
            ))}
        </div>
    );
}

export default function HeroCarousel() {
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        if (paused) return;

        const timer = window.setInterval(() => {
            setActive((index) => (index + 1) % slides.length);
        }, 6000);

        return () => window.clearInterval(timer);
    }, [paused, active]);

    const move = (step: number) => {
        setActive((index) => (index + step + slides.length) % slides.length);
    };

    return (
        <section
            aria-label="Explore StudySync features"
            aria-roledescription="carousel"
            className="relative h-[410px] min-w-0 overflow-hidden md:overflow-visible"
        >
            {slides.map((slide, index) => {
                const offset = (index - active + slides.length) % slides.length;
                const position = offset === 0 ? 0 : offset === 1 ? 1 : -1;

                return (
                    <article
                        key={slide.kind}
                        role="group"
                        aria-roledescription="slide"
                        aria-label={`${index + 1} of ${slides.length}: ${slide.title}`}
                        aria-hidden={position !== 0}
                        className={`absolute left-1/2 top-[47%] w-[85%] max-w-[390px] rounded-2xl border border-blue-200 bg-white p-5 shadow-xl transition-[transform,opacity] duration-500 ease-out ${position !== 0 ? "hidden md:block" : ""}`}
                        style={{
                            transform: `translate(-50%, -50%) translateX(${position * 57}%) scale(${position === 0 ? 1 : 0.83})`,
                            opacity: position === 0 ? 1 : 0.68,
                            zIndex: position === 0 ? 20 : 10,
                        }}
                    >
                        <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                            Option {String.fromCharCode(65 + index)}
                        </p>
                        <h3 className="font-heading mt-2 text-xl font-bold">{slide.title}</h3>
                        <p className="mb-4 mt-2 min-h-10 text-sm text-muted-foreground">{slide.subtitle}</p>
                        <SlidePreview kind={slide.kind} />
                    </article>
                );
            })}

            <button
                type="button"
                onClick={() => move(-1)}
                aria-label="Previous feature"
                className="absolute left-0 top-[47%] z-30 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-blue-200 bg-white text-secondary shadow-sm hover:bg-blue-50"
            >
                ←
            </button>

            <button
                type="button"
                onClick={() => move(1)}
                aria-label="Next feature"
                className="absolute right-0 top-[47%] z-30 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-blue-200 bg-white text-secondary shadow-sm hover:bg-blue-50"
            >
                →
            </button>

            <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-3">
                {slides.map((slide, index) => (
                    <button
                        key={slide.kind}
                        type="button"
                        onClick={() => setActive(index)}
                        aria-label={`Show ${slide.title}`}
                        aria-current={active === index ? "true" : undefined}
                        className={`size-2.5 rounded-full ${active === index ? "bg-secondary" : "bg-slate-300"}`}
                    />
                ))}

                <button
                    type="button"
                    onClick={() => setPaused((value) => !value)}
                    aria-label={paused ? "Resume automatic rotation" : "Pause automatic rotation"}
                    title={paused ? "Play" : "Pause"}
                    className="ml-1 flex size-8 items-center justify-center rounded-full border border-blue-200 bg-white text-secondary shadow-sm transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                >
                    <span aria-hidden="true" className="text-sm">
                        {paused ? "▶" : "Ⅱ"}
                    </span>
                </button>
            </div>
        </section>
    );
}
