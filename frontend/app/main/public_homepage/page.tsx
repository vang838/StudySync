
import Image from "next/image";
import Link from "next/link";
import Footer from "@/components/ui/footer";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import HeroCarousel from "@/components/landing/HeroCarousel";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowRight01Icon,
    BookOpen01Icon,
    Calendar03Icon,
    CheckmarkCircle01Icon,
    FileTextIcon,
    Upload01Icon,
} from "@hugeicons/core-free-icons";

const features = [
    { title: "AI Study Assistant", description: "Explore questions and answers grounded in your course materials.", href: "/auth/signup", icon: BookOpen01Icon },
    { title: "Study Tools", description: "Practice with flashcards, exams, and study guides built around your learning.", href: "/auth/signup", icon: FileTextIcon },
    { title: "Collaboration", description: "Find classmates, exchange resources, and learn together.", href: "/collaborative-hub", icon: CheckmarkCircle01Icon },
];

const steps = [
    { title: "Add materials", description: "Upload lecture notes, readings, and course documents.", icon: Upload01Icon },
    { title: "Ask and explore", description: "Use your materials to explore topics with the AI assistant.", icon: BookOpen01Icon },
    { title: "Practice", description: "Reinforce what you've learned with study tools.", icon: CheckmarkCircle01Icon },
];

export default function PublicHomepage() {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <header className="border-b-[3px] border-amber-400 bg-white">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3 md:px-10">
                    <Link href="/" aria-label="StudySync home">
                        <Image src="/StudySync.png" alt="StudySync logo" width={155} height={45} priority />
                    </Link>
                    <nav aria-label="Primary navigation" className="flex flex-wrap items-center gap-4 text-sm md:gap-6">
                        <Link className="hover:text-secondary" href="/courses/course_search">Course Search</Link>
                        <Link className="hover:text-secondary" href="/professors">Professor Search</Link>
                        <Link className="hover:text-secondary" href="/collaborative-hub">Collaborative Hub</Link>
                    </nav>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <Link className="rounded-lg border border-secondary px-4 py-2 text-secondary hover:bg-blue-50" href="/auth/signin">
                            Sign In
                        </Link>
                        <Link className="rounded-lg bg-secondary px-4 py-2 text-white hover:brightness-95" href="/auth/signup">
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1">
                <section className="overflow-hidden bg-gradient-to-br from-white via-blue-50/60 to-sky-100/80 px-6 py-12 md:px-10 md:py-20">
                    <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
                                Your study partner
                            </p>
                            <h1 className="font-heading mt-5 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
                                Study smarter.<br />
                                Achieve more.<br />
                                <span className="text-secondary">Stay in sync.</span>
                            </h1>
                            <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground">
                                StudySync brings courses, notes, AI-powered study tools, planning, and collaboration together so you can learn smarter, stay organized, and achieve your goals.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
                                <Link href="/auth/signup" className="rounded-lg bg-secondary px-6 py-3 text-white shadow-sm hover:brightness-95">
                                    Get Started →
                                </Link>
                                <Link href="/auth/signin" className="rounded-lg border border-secondary bg-white px-6 py-3 text-secondary hover:bg-blue-50">
                                    Sign In
                                </Link>
                            </div>
                        </div>
                        <HeroCarousel />
                    </div>
                </section>

                <section id="features" className="scroll-mt-8 px-6 py-14 md:px-10">
                    <div className="mx-auto max-w-7xl">
                        <p className="text-xs font-semibold uppercase tracking-widest text-secondary">All-in-one learning</p>
                        <h2 className="font-heading mt-2 text-3xl font-bold">Everything you need to study</h2>
                        <div className="mt-7 grid gap-4 md:grid-cols-3">
                            {features.map((feature) => (
                                <Link key={feature.title} href={feature.href} className="group rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">
                                    <Card className="h-full border-slate-200 bg-white shadow-sm transition group-hover:-translate-y-0.5 group-hover:border-secondary group-hover:shadow-md motion-reduce:transform-none">
                                        <CardContent className="flex h-full items-start gap-4 p-6">
                                            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-secondary">
                                                <HugeiconsIcon icon={feature.icon} size={25} />
                                            </span>
                                            <div>
                                                <CardTitle className="text-lg">{feature.title}</CardTitle>
                                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                                                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-secondary">
                                                    Learn more <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="how-it-works" className="bg-blue-50/80 px-6 py-14 md:px-10">
                    <div className="mx-auto max-w-7xl">
                        <p className="text-xs font-semibold uppercase tracking-widest text-secondary">Get started in minutes</p>
                        <h2 className="font-heading mt-2 text-3xl font-bold">How StudySync Works</h2>
                        <div className="mt-7 grid gap-4 md:grid-cols-3">
                            {steps.map((step, index) => (
                                <div key={step.title} className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-white">
                                            {index + 1}
                                        </span>
                                        <HugeiconsIcon icon={step.icon} size={24} className="text-secondary" />
                                        <h3 className="font-semibold">{step.title}</h3>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="showcase" className="px-6 py-16 md:px-10">
                    <div className="mx-auto max-w-7xl">
                        <p className="text-xs font-semibold uppercase tracking-widest text-secondary">See what you can do</p>
                        <h2 className="font-heading mt-2 text-3xl font-bold">Explore StudySync in action</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                            A preview of the tools available in your learning workspace.
                        </p>

                        <div className="mt-7 grid gap-5 lg:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="rounded-xl bg-indigo-50 p-5">
                                    <div className="flex items-center justify-between text-xs font-semibold">
                                        <span>Flashcards</span>
                                        <span className="text-secondary">Example</span>
                                    </div>
                                    <div className="mt-4 rounded-xl border border-indigo-100 bg-white px-5 py-10 text-center text-sm font-semibold shadow-sm">
                                        What is homeostasis?
                                    </div>
                                </div>
                                <h3 className="font-heading mt-5 text-lg font-bold">Flashcards</h3>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    Review important concepts with focused study cards.
                                </p>
                                <Link href="/auth/signup" className="mt-3 inline-block text-sm font-semibold text-secondary">
                                    Get started →
                                </Link>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="space-y-3 rounded-xl bg-blue-50 p-4 text-xs">
                                    <p className="font-semibold">Example study group</p>
                                    <p className="max-w-[85%] rounded-lg bg-white p-3">
                                        Can someone explain active transport?
                                    </p>
                                    <p className="ml-auto max-w-[85%] rounded-lg bg-blue-200/60 p-3">
                                        I can share a summary of the lecture.
                                    </p>
                                </div>
                                <h3 className="font-heading mt-5 text-lg font-bold">Collaborative study</h3>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    Share ideas and resources with classmates.
                                </p>
                                <Link href="/collaborative-hub" className="mt-3 inline-block text-sm font-semibold text-secondary">
                                    Explore hub →
                                </Link>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-xs">
                                    <p className="font-semibold">Organize your learning</p>
                                    {[
                                        { name: "Course materials", icon: BookOpen01Icon },
                                        { name: "Study guides", icon: FileTextIcon },
                                        { name: "Study planner", icon: Calendar03Icon },
                                    ].map((item) => (
                                        <div key={item.name} className="flex items-center gap-3 rounded-lg bg-white p-3">
                                            <HugeiconsIcon icon={item.icon} size={18} className="text-secondary" />
                                            {item.name}
                                        </div>
                                    ))}
                                </div>
                                <h3 className="font-heading mt-5 text-lg font-bold">Course organization</h3>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    Keep course materials and study plans in one place.
                                </p>
                                <Link href="/auth/signup" className="mt-3 inline-block text-sm font-semibold text-secondary">
                                    Get started →
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}
