import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import { Send, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useGetMyProfile } from "@workspace/api-client-react";

export type ChatChannel = "global" | "gang" | "city" | "private";

interface ChatMessage {
  id: number;
  channel: ChatChannel;
  body: string;
  senderId: number;
  senderUsername: string;
  senderLevel: number;
  senderGangId: number | null;
  senderGangName: string | null;
  senderGangRank: string | null;
  recipientId: number | null;
  recipientUsername: string | null;
  createdAt: string;
}

interface ChatListResponse {
  messages: ChatMessage[];
  partner?: { id: number; username: string } | null;
}

const POLL_INTERVAL_MS = 3000;
const MAX_LENGTH = 500;

function endpointFor(channel: ChatChannel, partnerId?: number): string {
  if (channel === "private") return `/api/chat/private/${partnerId}`;
  return `/api/chat/${channel}`;
}

export function ChatWindow({ channel, partnerId, disabled, disabledReason }: {
  channel: ChatChannel;
  partnerId?: number;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: me } = useGetMyProfile();
  const [body, setBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const queryKey = ["chat", channel, partnerId ?? null];

  const { data, isLoading } = useQuery<ChatListResponse>({
    queryKey,
    enabled: !disabled,
    refetchInterval: POLL_INTERVAL_MS,
    queryFn: async () => {
      const res = await fetch(endpointFor(channel, partnerId), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load chat");
      return res.json() as Promise<ChatListResponse>;
    },
  });

  const send = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(endpointFor(channel, partnerId), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" })) as { error?: string };
        throw new Error(err.error ?? "Failed to send message");
      }
      return res.json();
    },
    onSuccess: () => {
      setBody("");
      stickToBottomRef.current = true;
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => {
      toast({ title: t("chat.sendFailed"), description: e.message, variant: "destructive" });
    },
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/chat/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey }); },
  });

  // Auto-scroll to bottom when new messages arrive, but only if user was already at the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [data?.messages?.length]);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > MAX_LENGTH || send.isPending || disabled) return;
    send.mutate(trimmed);
  }

  const messages = data?.messages ?? [];
  const dateLocale = language === "ar" ? arLocale : undefined;
  const remaining = MAX_LENGTH - body.length;

  return (
    <div className="flex flex-col h-[60vh] min-h-[420px] border border-border rounded-lg bg-card overflow-hidden">
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-4 space-y-3">
        {disabled ? (
          <div className="text-center text-muted-foreground text-sm py-8">{disabledReason ?? t("chat.disabled")}</div>
        ) : isLoading ? (
          <div className="text-center text-muted-foreground text-sm py-8">{t("common.loading")}</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">{t("chat.empty")}</div>
        ) : (
          messages.map(m => {
            const isMe = me?.id === m.senderId;
            return (
              <div key={m.id} className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${isMe ? "bg-primary/15 border border-primary/30" : "bg-secondary/40 border border-border/50"}`}>
                  <div className="flex items-center gap-2 mb-1 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{m.senderUsername}</span>
                    <span>L{m.senderLevel}</span>
                    {m.senderGangName && (
                      <span className="text-primary/80">
                        [{m.senderGangName}{m.senderGangRank ? ` · ${m.senderGangRank}` : ""}]
                      </span>
                    )}
                    <span>· {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true, locale: dateLocale })}</span>
                    {isMe && (
                      <button
                        onClick={() => del.mutate(m.id)}
                        className="hover:text-destructive transition-colors"
                        title={t("chat.delete")}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap break-words leading-snug">{m.body}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={onSubmit} className="border-t border-border p-3 bg-background/50">
        <div className="flex gap-2">
          <Textarea
            value={body}
            onChange={e => setBody(e.target.value.slice(0, MAX_LENGTH))}
            placeholder={t("chat.placeholder")}
            rows={2}
            disabled={disabled || send.isPending}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            className="flex-1 resize-none bg-card"
          />
          <Button type="submit" disabled={disabled || send.isPending || body.trim().length === 0}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-[11px] text-muted-foreground mt-1 text-right">
          {remaining} / {MAX_LENGTH}
        </div>
      </form>
    </div>
  );
}
