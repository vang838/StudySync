import Footer from "@/components/ui/footer";
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
import { Skeleton } from "@/components/ui/skeleton";
export default function PublicHomepage()
{
    return(
        <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
              <div className="mx-auto flex max-w-6xl flex-col gap-10 pb-10">
              <header className="flex items-center gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-muted-foreground">StudySync UI</p>
                  <h1 className="font-heading text-3xl font-bold">Component preview</h1>
                </div>
              </header>

              <p className="max-w-2xl text-muted-foreground">
                Use the sidebar toggle to test the responsive navigation shell.
              </p>



              <Separator />

              <section className="flex flex-col gap-4">
                <h2 className="font-heading text-xl font-semibold">Buttons</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <Button>Continue</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="line">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Delete</Button>
                  <Button variant="link">Learn more</Button>
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>Sign in form</CardTitle>
                    <CardDescription>Use Input and Button together in a reusable form.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <Input size="xxl" placeholder="Email address" type="email" />
                    <Input placeholder="Password" type="password" />
                  </CardContent>
                  <CardFooter>
                    <Button>Sign in</Button>
                  </CardFooter>
                </Card>

                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Study session</CardTitle>
                    <CardDescription>Card layout with an action area.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex items-center justify-between rounded-xl bg-muted p-4">
                      <span className="font-medium">Biology review</span>
                      <span className="text-sm text-muted-foreground">25 min</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-muted p-4">
                      <span className="font-medium">Flashcards</span>
                      <span className="text-sm text-muted-foreground">12 cards</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full">Open session</Button>
                  </CardFooter>
                </Card>
              </section>

              <section className="flex flex-col gap-4">
                <h2 className="font-heading text-xl font-semibold">Loading state</h2>
                <Card>
                  <CardContent className="flex flex-col gap-4 pt-6">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-10 w-32" />
                  </CardContent>
                </Card>
              </section>
              <Footer></Footer>
            </div>
          </main>
        
    );
}