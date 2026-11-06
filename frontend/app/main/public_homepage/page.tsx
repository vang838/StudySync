import Link from "next/link";
import Header from "@/components/ui/header";
import Footer from "@/components/ui/footer";
import {Button} from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {HugeiconsIcon} from "@hugeicons/react";
import {
    ArrowRight01Icon,
    BookOpen01Icon,
    Calendar03Icon,
    CheckmarkCircle01Icon,
    FileTextIcon,
    Search01Icon,
} from "@hugeicons/core-free-icons";

const features = [
    {title: "Find your courses", description: "Search courses and save the ones you want to follow.", href: "/courses/course_search", icon: Search01Icon},
    {title: "Study together", description: "Share notes, ask questions, and learn with your classmates.", href: "/collaborative-hub", icon: CheckmarkCircle01Icon},
    {title: "Stay organized", description: "Keep study sessions and materials in one focused workspace.", href: "/auth/signin", icon: Calendar03Icon},
];

export default function PublicHomepage() {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <Header/>
            <main className="flex-1 px-6 py-12 md:px-10 md:py-16">
                <div className="mx-auto flex max-w-6xl flex-col gap-14">
                    <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-widest text-secondary">
                                Your student workspace
                            </p>
                            <h1 className="font-heading mt-3 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
                                Make every study session count.
                            </h1>
                            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                                StudySync brings courses, materials, planning, and collaboration together so you can spend less time searching and more time learning.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3">
                                <Button asChild size="lg">
                                    <Link href="/auth/signin">Sign in to your dashboard</Link>
                                </Button>
                                <Button asChild variant="outline" size="lg">
                                    <Link href="/auth/signup">Create an account</Link>
                                </Button>
                            </div>
                        </div>
                        <Card className="border-secondary/20 bg-card shadow-sm">
                            <CardHeader>
                                <p className="text-xs font-semibold uppercase tracking-widest text-secondary">A snapshot of your day</p>
                                <CardTitle className="text-2xl">Keep momentum going</CardTitle>
                                <CardDescription>Static sample data previews the dashboard before you sign in.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3">
                                {[
                                    ["BIO 201", "Human Biology", "72%"],
                                    ["MATH 240", "Statistics & Probability", "48%"],
                                    ["HIST 108", "World History", "85%"],
                                ].map(([code, name, progress]) => (
                                    <div key={code} className="rounded-xl bg-background p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-semibold text-secondary">{code}</p>
                                                <p className="font-medium">{name}</p>
                                            </div>
                                            <span className="text-sm font-semibold">{progress}</span>
                                        </div>
                                        <div className="mt-3 h-2 rounded-full bg-muted">
                                            <div className="h-2 rounded-full bg-secondary" style={{width: progress}}/>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </section>

                    <section>
                        <div className="mb-5">
                            <p className="text-xs font-semibold uppercase tracking-widest text-secondary">Everything in one place</p>
                            <h2 className="font-heading mt-1 text-2xl font-bold">Start where you need to</h2>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            {features.map((feature) => (
                                <Link key={feature.title} href={feature.href} className="group">
                                    <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-secondary group-hover:shadow-sm">
                                        <CardContent className="flex h-full flex-col gap-4 p-6">
                                            <span className="flex size-11 items-center justify-center rounded-xl bg-background text-secondary">
                                                <HugeiconsIcon icon={feature.icon} size={22}/>
                                            </span>
                                            <div className="flex-1">
                                                <CardTitle className="text-lg">{feature.title}</CardTitle>
                                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                                            </div>
                                            <span className="flex items-center gap-1 text-sm font-semibold text-secondary">
                                                Explore <HugeiconsIcon icon={ArrowRight01Icon} size={16}/>
                                            </span>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </section>

                    <section className="grid gap-4 sm:grid-cols-3">
                        {[
                            ["3", "Saved courses", BookOpen01Icon],
                            ["3", "Recent uploads", FileTextIcon],
                            ["5", "Upcoming tasks", CheckmarkCircle01Icon],
                        ].map(([value, label, icon]) => (
                            <div key={label as string} className="flex items-center gap-4 rounded-xl border border-foreground/10 bg-card p-5">
                                <HugeiconsIcon icon={icon} size={22} className="text-secondary"/>
                                <div>
                                    <p className="text-2xl font-bold">{value}</p>
                                    <p className="text-sm text-muted-foreground">{label}</p>
                                </div>
                            </div>
                        ))}
                    </section>
                </div>
            </main>
            <Footer/>
        </div>
    );
}