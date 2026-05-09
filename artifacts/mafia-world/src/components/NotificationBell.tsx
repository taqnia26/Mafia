import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import { useI18n } from "@/lib/i18n";

interface Notification {
  id: number;
  type: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  unreadCount: number;
  notifications: Notification[];
}

async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await fetch("/api/notifications", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json() as Promise<NotificationsResponse>;
}

async function markAllRead(): Promise<void> {
  await fetch("/api/notifications/mark-read", {
    method: "POST",
    credentials: "include",
  });
}

async function markOneRead(id: number): Promise<void> {
  await fetch(`/api/notifications/${id}/read`, {
    method: "POST",
    credentials: "include",
  });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { dir, language } = useI18n();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const markAllMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: markOneRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  function handleOpen() {
    const isOpening = !open;
    setOpen(isOpening);
    if (isOpening && unreadCount > 0) {
      markAllMutation.mutate();
    }
  }

  function handleNotificationClick(n: Notification) {
    if (!n.read) {
      markOneMutation.mutate(n.id);
    }
    setOpen(false);
    navigate(n.link);
  }

  function handleMarkAll(e: React.MouseEvent) {
    e.stopPropagation();
    markAllMutation.mutate();
  }

  const dateLocale = language === "ar" ? arLocale : undefined;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-2 w-80 rounded-lg border border-border bg-card shadow-lg overflow-hidden ${
            dir === "rtl" ? "left-0" : "right-0"
          }`}
          style={{ top: "100%" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-secondary transition-colors flex flex-col gap-0.5 ${
                    !n.read ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm leading-snug ${!n.read ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {n.message}
                    </span>
                    {!n.read && (
                      <span className="mt-1 shrink-0 w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.createdAt), {
                      addSuffix: true,
                      locale: dateLocale,
                    })}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
