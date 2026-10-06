"use client";

import { usePathname } from "next/navigation";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export default function AssistantWidget() {
    const pathname = usePathname();

    if (pathname.startsWith("/auth")) {
        return null;
    }

    return (
        <Sheet>
            <SheetTrigger className="fixed bottom-6 right-6 z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90">
                Ask AI
            </SheetTrigger>

            <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>StudySync AI</SheetTitle>
                    <SheetDescription>
                        Context: General
                    </SheetDescription>
                </SheetHeader>

                <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
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
            </SheetContent>
        </Sheet>
    );
}