"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type CourseMember = {
  user_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email?: string;
};

type CourseMembersSectionProps = {
  courseId: string;
};

export default function CourseMembersSection({ courseId }: CourseMembersSectionProps) {
  const [members, setMembers] = useState<CourseMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadMembers = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}/members`);
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.detail ?? `Failed to load course members (HTTP ${response.status})`);
        }

        const data = (await response.json()) as CourseMember[];
        setMembers(Array.isArray(data) ? data : []);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load course members.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadMembers();
  }, [courseId]);

  const filteredMembers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return members;
    }

    return members.filter((member) => member.full_name.toLowerCase().includes(normalizedSearch));
  }, [members, searchTerm]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>Search the course community and open a student profile.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name"
            className="w-full"
          />
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        {loading && <p className="text-sm text-muted-foreground">Loading members...</p>}

        {!loading && !error && filteredMembers.length === 0 && (
          <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
            {members.length === 0 ? "No members have saved this course yet." : "No members match your search."}
          </div>
        )}

        {!loading && !error && filteredMembers.length > 0 && (
          <div className="space-y-3">
            {filteredMembers.map((member) => (
              <Link key={member.user_id} href={`/users/${member.user_id}`} className="block">
                <div className="rounded-md border border-border/60 bg-card p-3 transition hover:border-secondary hover:shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-sm font-semibold text-secondary">
                      {member.first_name.charAt(0)}
                      {member.last_name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{member.full_name}</p>
                      <p className="text-xs text-muted-foreground">View profile</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
