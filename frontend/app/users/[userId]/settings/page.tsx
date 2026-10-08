"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type UserProfile = {
  user_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
};

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
useEffect(() => {
    const loadProfile = async () => {
        setLoading(true);
        setError(null);
  
        try {
          const { userId } = await params;
          const userResponse = await fetch(`/api/users/${encodeURIComponent(userId)}`);
  
          if (!userResponse.ok) {
            const body = await userResponse.json().catch(() => ({}));
            throw new Error(body?.detail ?? `Failed to load user profile (HTTP ${userResponse.status})`);
          }
  
          const userData = (await userResponse.json()) as UserProfile;
          setUser(userData);
          setFirstName(userData.first_name);
          setLastName(userData.last_name);
          setEmail(userData.email);
        } catch (loadError) {
          const message = loadError instanceof Error ? loadError.message : "Unable to load profile.";
          setError(message);
        } finally {
          setLoading(false);
        }
      };
  
    void loadProfile();
}, [params]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const { userId } = await params;
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        detail?: string;
        message?: string;
        user?: UserProfile;
      };
      if (!response.ok) {
        throw new Error(body?.detail ?? `Failed to save profile (HTTP ${response.status})`);
      }

      if (!body.user) {
        throw new Error("Profile response did not include the updated user.");
      }

      const updatedUser = body.user;
      setUser(updatedUser);
      setFirstName(updatedUser.first_name);
      setLastName(updatedUser.last_name);
      setEmail(updatedUser.email);
      setSaveSuccess(body.message ?? "Profile saved.");
    } catch (saveError) {
      setSaveError(saveError instanceof Error ? saveError.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitPassword = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaveError(null);
        setSaveSuccess("");

        if (!email) {
            setError("Missing email. Please return to the forgot password page.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        try {
            const res = await fetch(`/api/auth/resetpassword`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.detail ?? "Unable to reset password.");
                return;
            }

            setError("");
            setSaveSuccess(data.message || "Password reset successfully.");
        } catch {
            setError("Network error. Please try again.");
        }
    }

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
            <p className="text-sm font-medium text-muted-foreground">StudySync Settings</p>
            <h1 className="font-heading text-3xl font-bold">Account Settings</h1>
          </div>
        </header>

        <Separator />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-8">
          <section className="space-y-6 lg:col-span-8">
            <form onSubmit={handleSubmit}>
              <Card>
                <CardHeader>
                  <CardTitle>Profile Details</CardTitle>
                  <CardDescription>Basic account information for this member.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="w-full">
                      <label htmlFor="first-name" className="text-xs font-medium tracking-wide text-muted-foreground">
                        First Name
                      </label>
                      <Input
                        id="first-name"
                        className="mt-1 w-full max-w-[420px]"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        required
                        maxLength={75}
                      />
                    </div>
                    <div className="w-full">
                      <label htmlFor="last-name" className="text-xs font-medium tracking-wide text-muted-foreground">
                        Last Name
                      </label>
                      <Input
                        id="last-name"
                        className="mt-1 w-full max-w-[420px]"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        required
                        maxLength={75}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-xs font-medium tracking-wide text-muted-foreground">
                      Email
                    </label>
                    <Input
                      id="email"
                      className="mt-1 w-full max-w-[420px]"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>
                  {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
                  {saveSuccess && <p role="status" className="text-sm text-green-700">{saveSuccess}</p>}
                  <div className="flex justify-end">
                    <Button type="submit" variant="secondary" size="icon-xlg" disabled={saving}>
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
            <form onSubmit={handleSubmitPassword}>
                <Card>
                <CardHeader>
                    <CardTitle>Set Password</CardTitle>
                    <CardDescription>After setting a password, you can also use email to sign in.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="w-full">
                        <label htmlFor="first-name" className="block text-xs font-medium tracking-wide text-muted-foreground">
                            Password
                        </label>
                        <Input
                            type="password"
                            id="password"
                            className="mt-1 w-full max-w-[420px]"
                            placeholder="New Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        </div>
                        <div className="w-full">
                        <label htmlFor="last-name" className="block text-xs font-medium tracking-wide text-muted-foreground">
                            Confirm Password
                        </label>
                        <Input
                            type="password"
                            id="confirmPassword"
                            className="mt-1 w-full max-w-[420px]"
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                        </div>
                    </div>
                    {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
                    {saveSuccess && <p role="status" className="text-sm text-green-700">{saveSuccess}</p>}
                    <div className="flex justify-end mt-5">
                        <Button type="submit" variant="secondary" size="icon-xlg" disabled={saving}>
                        {saving ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </CardContent>
                </Card>
            </form>
          </section>

        </div>
      </div>
    </main>
  );
}
