"use client";

import Image from "next/image";
import Link from "next/link";
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    UserIcon
} from "@hugeicons/core-free-icons";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { useState, useEffect, useRef } from "react";

type UserProfile = {
    user_id: number;
    first_name: string;
    password_needs_update: boolean;
};

type NotificationItem = {
    notification_id: number;
    type: string;
    title: string;
    message: string;
    link: string | null;
    is_read: boolean;
    created_at: string;
};

function getNotificationPreview(message: string, maxLength = 64) {
    const normalized = message.replace(/\s+/g, " ").trim();
    return normalized.length > maxLength
        ? `${normalized.slice(0, maxLength).trimEnd()}...`
        : normalized;
}

function splitForumReplyPreview(notification: NotificationItem) {
    if (notification.type !== "forum_reply") {
        return { username: null, preview: getNotificationPreview(notification.message) };
    }

    const separatorIndex = notification.message.indexOf(": ");
    if (separatorIndex < 0) {
        return { username: null, preview: getNotificationPreview(notification.message) };
    }

    return {
        username: notification.message.slice(0, separatorIndex),
        preview: getNotificationPreview(notification.message.slice(separatorIndex + 2)),
    };
}

export default function Header() {

    const [isHovered, setIsHovered] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [toast, setToast] = useState<NotificationItem | null>(null);
    const seenNotificationIds = useRef<Set<number>>(new Set());
    const toastTimeout = useRef<number | null>(null);
    const [userId, setUserId] = useState<number | null>(null);
    const [passwordNeedsUpdate, setPasswordNeedsUpdate] = useState(false);

    useEffect(() => {
        const storedUserId = localStorage.getItem("user_id");
        const isAuthenticated = localStorage.getItem("auth_session") === "authenticated";

        if (!storedUserId || !isAuthenticated) {
            localStorage.removeItem("user_id");
            return;
        }

        fetch(`/api/users/${encodeURIComponent(storedUserId)}`, { cache: "no-store" })
            .then((res) => {
                if (!res.ok) throw new Error("Could not load user");
                return res.json();
            })
            .then((user: UserProfile) => {
                setUserId(user.user_id);
                setPasswordNeedsUpdate(user.password_needs_update === true);
            })
            .catch(() => {
                setUserId(null);
                setPasswordNeedsUpdate(false);
            });

    }, []);

    useEffect(() => {
        if (userId === null) return;

        const refreshSecurityStatus = async () => {
            try {
                const response = await fetch(`/api/users/${userId}`, { cache: "no-store" });
                if (!response.ok) return;

                const user = (await response.json()) as UserProfile;
                setPasswordNeedsUpdate(user.password_needs_update === true);
            } catch {
                // Preserve the previous security status if refreshing fails.
            }
        };

        window.addEventListener("focus", refreshSecurityStatus);
        window.addEventListener("studysync:password-updated", refreshSecurityStatus);

        return () => {
            window.removeEventListener("focus", refreshSecurityStatus);
            window.removeEventListener("studysync:password-updated", refreshSecurityStatus);
        };
    }, [userId]);

    useEffect(() => {
        if (userId === null) return;

        let stopped = false;
        const loadNotifications = async () => {
            try {
                const response = await fetch("/api/notifications", { cache: "no-store" });
                if (!response.ok) return;
                const next = (await response.json()) as NotificationItem[];
                if (stopped) return;

                if (seenNotificationIds.current.size === 0) {
                    seenNotificationIds.current = new Set(next.map((item) => item.notification_id));
                } else {
                    const newest = next
                        .filter((item) => !item.is_read && !seenNotificationIds.current.has(item.notification_id))
                        .sort((a, b) => b.notification_id - a.notification_id)[0];
                    if (newest) {
                        seenNotificationIds.current.add(newest.notification_id);
                        setToast(newest);
                    }
                }
                setNotifications(next);
            } catch {
                // Notifications are supplementary and should not interrupt normal navigation.
            }
        };

        void loadNotifications();
        const interval = window.setInterval(loadNotifications, 15000);
        return () => {
            stopped = true;
            window.clearInterval(interval);
            if (toastTimeout.current !== null) window.clearTimeout(toastTimeout.current);
        };
    }, [userId]);

    useEffect(() => {
        if (!toast) return;

        toastTimeout.current = window.setTimeout(() => {
            setToast(null);
            toastTimeout.current = null;
        }, 5000);

        return () => {
            if (toastTimeout.current !== null) {
                window.clearTimeout(toastTimeout.current);
                toastTimeout.current = null;
            }
        };
    }, [toast]);

    async function logout() {
        await fetch("/api/auth/logout", { method: "POST" });
        localStorage.removeItem("user_id");
        localStorage.removeItem("auth_session");
        window.location.replace("/auth/signin");
    }

    async function openNotification(notification: NotificationItem) {
        if (!notification.is_read) {
            await fetch(`/api/notifications/${notification.notification_id}/read`, { method: "POST" });
            setNotifications((current) =>
                current.map((item) =>
                    item.notification_id === notification.notification_id
                        ? { ...item, is_read: true }
                        : item
                )
            );
        }
        setIsNotificationsOpen(false);
        if (notification.link) window.location.assign(notification.link);
    }

    async function deleteNotification(notificationId: number) {
        const response = await fetch(`/api/notifications/${notificationId}`, { method: "DELETE" });
        if (!response.ok) return;
        setNotifications((current) =>
            current.filter((notification) => notification.notification_id !== notificationId)
        );
    }

    function toggleNotifications() {
        setIsNotificationsOpen((open) => !open);
    }

    const unreadCount = notifications.filter((notification) => !notification.is_read).length
        + (passwordNeedsUpdate ? 1 : 0);

    return (
        <header
            className="relative z-50 grid h-16 w-full grid-cols-[1fr_auto_1fr] items-center border-b-4 border-amber-400 bg-white px-8 text-foreground">
            {toast && (
                <div
                    role="status"
                    className="absolute left-1/2 top-full z-[100] mt-2 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-amber-400 bg-white px-6 py-5 text-center shadow-lg notification-slide-in"
                >
                    {(() => {
                        const preview = splitForumReplyPreview(toast);
                        return (
                            <>
                                <p className="text-sm font-semibold text-foreground">{toast.title}</p>
                                {preview.username && <p className="mt-1 text-xs font-medium text-foreground">{preview.username}</p>}
                                <p className="mt-1 truncate text-xs text-muted-foreground">{preview.preview}</p>
                            </>
                        );
                    })()}
                </div>
            )}

            <Link href="/dashboard" aria-label="Go to StudySync main page" className="justify-self-start">
                <Image className="-translate-y-2" src="/StudySync.png" alt="StudySync logo" width={125} height={50} priority />
            </Link>

            {/* Options in the middle */}
            <NavigationMenu className="max-w-none justify-self-center -translate-y-2">
                <NavigationMenuList className="flex items-center gap-6">
                    <NavigationMenuItem>
                        <NavigationMenuLink href="/courses/course_search" className="py-2 text-sm text-foreground">
                            Course Search
                        </NavigationMenuLink>
                    </NavigationMenuItem>

                    <NavigationMenuItem>
                        <NavigationMenuLink href="/professors" className="py-2 text-sm text-foreground">
                            Professor Search
                        </NavigationMenuLink>
                    </NavigationMenuItem>

                    <NavigationMenuItem>
                        <NavigationMenuLink href="/collaborative-hub" className="py-2 text-sm text-foreground">
                            Collaborative Hub
                        </NavigationMenuLink>
                    </NavigationMenuItem>
                </NavigationMenuList>
            </NavigationMenu>

            {/* Notifications and user profile */}
            <div className="relative z-50 justify-self-end -translate-y-2 flex items-center gap-3">
                {userId !== null && (
                    <div className="relative">
                        <button
                            type="button"
                            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread or requiring attention` : ""}`}
                            aria-expanded={isNotificationsOpen}
                            aria-haspopup="true"
                            onClick={toggleNotifications}
                            className="relative rounded-full p-1 hover:bg-muted"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                            {unreadCount > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                                    {unreadCount > 99 ? "99+" : unreadCount}
                                </span>
                            )}
                        </button>

                        {isNotificationsOpen && (
                            <div className="fixed right-4 top-16 z-[100] w-[min(560px,calc(100vw-2rem))] pt-3">
                                <Card className="w-full shadow-lg" size="sm">
                                    <CardContent className="max-h-[calc(100vh-6rem)] overflow-y-auto p-2">
                                        <p className="px-2 py-2 text-sm font-semibold">Notifications</p>

                                        {passwordNeedsUpdate && userId !== null && (
                                            <Link
                                                href={`/users/${userId}/settings`}
                                                onClick={() => setIsNotificationsOpen(false)}
                                                className="mb-2 block rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-amber-950 transition hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                                            >
                                                <span className="block text-sm font-semibold">
                                                    Your password needs an update.
                                                </span>
                                                <span className="mt-1 block text-xs">
                                                    Please choose a stronger password with an uppercase letter and special character.
                                                </span>
                                                <span className="mt-2 block text-xs font-semibold underline">
                                                    Update your password
                                                </span>
                                            </Link>
                                        )}

                                        {notifications.length === 0 && !passwordNeedsUpdate ? (
                                            <p className="px-2 py-4 text-sm text-muted-foreground">
                                                You have no notifications.
                                            </p>
                                        ) : notifications.map((notification) => (
                                            <div
                                                key={notification.notification_id}
                                                className={`group flex items-stretch gap-2 rounded-md transition hover:bg-muted ${notification.is_read ? "opacity-70" : "bg-amber-50"}`}
                                            >
                                                {(() => {
                                                    const preview = splitForumReplyPreview(notification);
                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => void openNotification(notification)}
                                                            className="w-0 min-w-0 flex-1 overflow-hidden rounded-md px-3 py-3 text-left"
                                                        >
                                                            <span className="block truncate text-sm font-medium">{notification.title}</span>
                                                            {preview.username && (
                                                                <span className="mt-1 block truncate text-xs font-medium text-foreground">{preview.username}</span>
                                                            )}
                                                            <span className="mt-1 block truncate text-xs text-muted-foreground">{preview.preview}</span>
                                                        </button>
                                                    );
                                                })()}
                                                <button
                                                    type="button"
                                                    aria-label={`Delete ${notification.title}`}
                                                    onClick={() => void deleteNotification(notification.notification_id)}
                                                    className="mr-2 self-center flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg leading-none text-muted-foreground hover:bg-background hover:text-foreground"
                                                >
                                                    <span aria-hidden="true">×</span>
                                                </button>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </div>
                )}

                <NavigationMenu className="max-w-none">
                    <NavigationMenuList>
                        <NavigationMenuItem>
                            <div
                                className="relative"
                                onMouseEnter={() => setIsHovered(true)}
                                onMouseLeave={() => setIsHovered(false)}
                            >
                                <HugeiconsIcon icon={UserIcon} size={20} strokeWidth={2} />

                                {isHovered && (
                                    <div className="absolute right-0 top-full z-50 w-48 pt-2">
                                        <Card className="w-full shadow-md" size="sm">
                                            <CardContent className="grid gap-0.5 p-1">
                                                {userId !== null && (
                                                    <Link href={`/users/${userId}/student_profile`}
                                                        className="rounded-sm px-3 py-2 text-left text-sm hover:bg-muted">
                                                        Profile
                                                    </Link>
                                                )}
                                                {userId !== null && (
                                                    <Link href={`/users/${userId}/settings`}
                                                        className="rounded-sm px-3 py-2 text-left text-sm hover:bg-muted">
                                                        Settings
                                                    </Link>
                                                )}
                                                {userId !== null && (
                                                    <Link href={`/users/${userId}/uploads`}
                                                        className="rounded-sm px-3 py-2 text-left text-sm hover:bg-muted">
                                                        Uploads
                                                    </Link>
                                                )}
                                                {userId !== null && (
                                                    <Link href={`/users/${userId}/ratings`}
                                                        className="rounded-sm px-3 py-2 text-left text-sm hover:bg-muted">
                                                        My Ratings
                                                    </Link>
                                                )}
                                                {userId !== null ? (
                                                    <button type="button" onClick={logout}
                                                        className="rounded-sm px-3 py-2 text-left text-sm hover:bg-muted">
                                                        Log Out
                                                    </button>
                                                ) : (
                                                    <Link href="/auth/signin"
                                                        className="rounded-sm px-3 py-2 text-left text-sm hover:bg-muted">
                                                        Sign In
                                                    </Link>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}
                            </div>
                        </NavigationMenuItem>
                    </NavigationMenuList>
                </NavigationMenu>
            </div>

        </header>
    );
}

export { Header }
