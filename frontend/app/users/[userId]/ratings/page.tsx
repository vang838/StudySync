"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type UserProfile = {
  user_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
};

type ProfessorReview = {
  review_id: number;
  professor: string;
  course_id: string;
  user_id: number;
  rating: number;
  feedback: string;
  created_at: string;
};

export default function UserRatingsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [reviews, setReviews] = useState<ProfessorReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const { userId } = await params;
      setLoading(true);
      setError(null);

      try {
        const [userResponse, reviewsResponse] = await Promise.all([
          fetch(`/api/users/${encodeURIComponent(userId)}`),
          fetch(`/api/professor-reviews/users/${encodeURIComponent(userId)}`),
        ]);

        if (!userResponse.ok) {
          const body = await userResponse.json().catch(() => ({}));
          throw new Error(body?.detail ?? `Failed to load user profile (HTTP ${userResponse.status})`);
        }
        if (!reviewsResponse.ok) {
          throw new Error(`Failed to load ratings (HTTP ${reviewsResponse.status})`);
        }

        const userData = (await userResponse.json()) as UserProfile;
        const reviewData = (await reviewsResponse.json()) as ProfessorReview[];
        setUser(userData);
        setReviews(reviewData);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load profile.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [params]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading profile...</p>;
  }

  if (error) {
    return <p className="text-sm font-medium text-destructive">{error}</p>;
  }

  if (!user) {
    return <p className="text-sm text-muted-foreground">No profile data found.</p>;
  }

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">StudySync Ratings</p>
            <h1 className="font-heading text-3xl font-bold">Your Ratings</h1>
          </div>
        </header>

        <Separator/>

        <div>
          <section className="mx-auto w-full max-w-md space-y-4">
            {reviews.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  You haven&apos;t written any professor reviews yet.
                  <Link href="/professors" className="ml-1 text-foreground underline">
                    Find a professor
                  </Link>
                </CardContent>
              </Card>
            ) : (
              reviews.map((review) => (
                <Card key={review.review_id}>
                  <CardHeader>
                    <CardTitle>
                      {review.professor} 
                    </CardTitle>
                    <Separator/>
                    <CardDescription>
                      {review.course_id} · {review.rating}/5 ·{" "}
                      {new Date(review.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1 overflow-y-auto">
                    <p className="text-sm">
                      {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </p>
                    <p className="mt-2 text-sm">{review.feedback}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
