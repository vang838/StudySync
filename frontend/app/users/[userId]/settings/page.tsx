
"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getPasswordRules, isStrongPassword } from "@/lib/passwordRules";

type UserProfile = {
  user_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
};

type NotificationPreferences = {
  forum_replies: boolean;
  study_tasks: boolean;
  study_materials: boolean;
  challenges: boolean;
  course_file_uploads: boolean;
  saved_course_posts: boolean;
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
  const [passwordToast, setPasswordToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [passwordValidationAttempted, setPasswordValidationAttempted] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);
  const passwordTooWeak = passwordValidationAttempted && !isStrongPassword(password);
  const passwordsMismatch = passwordValidationAttempted && password !== confirmPassword;

  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    forum_replies: true,
    study_tasks: true,
    study_materials: true,
    challenges: true,
    course_file_uploads: true,
    saved_course_posts: true,
  });
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [notificationSettingsError, setNotificationSettingsError] = useState<string | null>(null);

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

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch("/api/notifications/preferences", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Unable to load notification settings.");
        }
        setNotificationPreferences(await response.json() as NotificationPreferences);
      } catch (loadError) {
        setNotificationSettingsError(loadError instanceof Error ? loadError.message : "Unable to load notification settings.");
      }
    };

    void loadPreferences();
  }, []);

  useEffect(() => {
    if (!passwordToast) return;

    const timeout = window.setTimeout(() => setPasswordToast(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [passwordToast]);

  const updateNotificationPreference = async (key: keyof NotificationPreferences, enabled: boolean) => {
    const nextPreferences = { ...notificationPreferences, [key]: enabled };
    setNotificationPreferences(nextPreferences);
    setSavingNotifications(true);
    setNotificationSettingsError(null);

    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPreferences),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? "Unable to save notification settings.");
      }
      setNotificationPreferences(await response.json() as NotificationPreferences);
    } catch (saveError) {
      setNotificationPreferences(notificationPreferences);
      setNotificationSettingsError(saveError instanceof Error ? saveError.message : "Unable to save notification settings.");
    } finally {
      setSavingNotifications(false);
    }
  };

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
    setPasswordToast(null);
    setSaveError(null);
    setSaveSuccess(null);
    setPasswordValidationAttempted(true);

    if (password !== confirmPassword) {
      confirmPasswordInputRef.current?.focus();
      return;
    }

    if (!isStrongPassword(password)) {
      passwordInputRef.current?.focus();
      return;
    }

    if (!email) {
      setPasswordToast({ type: "error", message: "Unable to update password: account email is missing." });
      return;
    }

    try {
      const { userId } = await params;
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { detail?: string; message?: string };

      if (!response.ok) {
        setPasswordToast({ type: "error", message: data.detail ?? "Unable to update password." });
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setPasswordValidationAttempted(false);
      setPasswordToast({ type: "success", message: "Password updated successfully." });
      window.dispatchEvent(new Event("studysync:password-updated"));
    } catch {
      setPasswordToast({ type: "error", message: "Network error. Please try again." });
    }
  };

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

            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Choose which in-app notifications you want to receive.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {([
                  ["forum_replies", "Forum replies", "When someone replies to your forum post."],
                  ["study_tasks", "Study tasks", "When a study task is approaching."],
                  ["study_materials", "Generated study materials", "When generated study material is ready."],
                  ["challenges", "Challenge completions", "When a challenge is completed."],
                  ["course_file_uploads", "Course file uploads", "When a new file is uploaded to a saved course."],
                  ["saved_course_posts", "Saved course posts", "When a new post is made in a saved course."],
                ] as const).map(([key, label, description]) => (
                  <div key={key} className="flex items-center justify-between gap-4 rounded-lg border border-foreground/10 px-4 py-3">
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notificationPreferences[key]}
                      aria-label={label}
                      disabled={savingNotifications}
                      onClick={() => void updateNotificationPreference(key, !notificationPreferences[key])}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${notificationPreferences[key] ? "bg-secondary" : "bg-input"}`}
                    >
                      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${notificationPreferences[key] ? "left-6" : "left-1"}`} />
                    </button>
                  </div>
                ))}
                {notificationSettingsError && <p role="alert" className="text-sm text-destructive">{notificationSettingsError}</p>}
              </CardContent>
            </Card>

            <form onSubmit={handleSubmitPassword}>
              <Card>
                <CardHeader>
                  <CardTitle>Set Password</CardTitle>
                  <CardDescription>After setting a password, you can also use email to sign in.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="w-full">
                      <label htmlFor="password" className="block text-xs font-medium tracking-wide text-muted-foreground">
                        Password
                      </label>
                      <Input
                        type="password"
                        id="password"
                        ref={passwordInputRef}
                        autoComplete="new-password"
                        aria-invalid={passwordTooWeak}
                        aria-describedby={passwordTooWeak ? "password-requirements password-error" : "password-requirements"}
                        className="mt-1 w-full max-w-[420px]"
                        placeholder="New Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <ul id="password-requirements" className="mt-2 space-y-1 text-xs">
                        {getPasswordRules(password).map((rule) => (
                          <li key={rule.label} className={rule.valid ? "text-green-700" : "text-red-600"}>
                            {rule.valid ? "✓" : "✕"} {rule.label}
                          </li>
                        ))}
                      </ul>
                      {passwordTooWeak && (
                        <p id="password-error" role="alert" className="mt-2 text-xs font-medium text-destructive">
                          Password does not meet all requirements.
                        </p>
                      )}
                    </div>
                    <div className="w-full">
                      <label htmlFor="confirmPassword" className="block text-xs font-medium tracking-wide text-muted-foreground">
                        Confirm Password
                      </label>
                      <Input
                        type="password"
                        id="confirmPassword"
                        ref={confirmPasswordInputRef}
                        autoComplete="new-password"
                        aria-invalid={passwordsMismatch}
                        aria-describedby={passwordsMismatch ? "confirm-password-error" : undefined}
                        className="mt-1 w-full max-w-[420px]"
                        placeholder="Confirm Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                      {passwordsMismatch && (
                        <p id="confirm-password-error" role="alert" className="mt-2 text-xs font-medium text-destructive">
                          Passwords do not match.
                        </p>
                      )}
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

      {passwordToast && (
        <div
          role={passwordToast.type === "error" ? "alert" : "status"}
          className={`notification-slide-in fixed right-4 top-20 z-[100] w-[min(420px,calc(100vw-2rem))] rounded-lg border bg-background px-4 py-3 text-foreground shadow-lg ${passwordToast.type === "error" ? "border-red-300" : "border-green-300"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${passwordToast.type === "error" ? "text-destructive" : "text-green-700"}`}>
                {passwordToast.type === "error" ? "Password Update Failed" : "Password Updated"}
              </p>
              <p className="mt-1 text-sm">{passwordToast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setPasswordToast(null)}
              aria-label="Dismiss password notification"
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-secondary"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
