import { Fragment, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Mail, Search, Inbox as InboxIcon, Swords, Building2, Shield, User as UserIcon, DollarSign, Cpu, Trash2, Archive, ArchiveRestore, CheckCheck, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListInboxMessages,
  useGetInboxMessage,
  useMarkAllInboxRead,
  useToggleInboxArchive,
  useDeleteInboxMessage,
  getListInboxMessagesQueryKey,
  getGetInboxMessageQueryKey,
  getGetMyProfileQueryKey,
} from "@workspace/api-client-react";
import type { InboxMessage } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageBanner } from "@/components/PageBanner";

type Category = "attack" | "property" | "gang" | "personal" | "financial" | "system";
type Priority = "urgent" | "high" | "normal" | "low";

const CATEGORIES: { id: Category | "all"; icon: typeof InboxIcon; key: string }[] = [
  { id: "all", icon: InboxIcon, key: "inbox.cat.all" },
  { id: "attack", icon: Swords, key: "inbox.cat.attack" },
  { id: "property", icon: Building2, key: "inbox.cat.property" },
  { id: "gang", icon: Shield, key: "inbox.cat.gang" },
  { id: "personal", icon: UserIcon, key: "inbox.cat.personal" },
  { id: "financial", icon: DollarSign, key: "inbox.cat.financial" },
  { id: "system", icon: Cpu, key: "inbox.cat.system" },
];

const PRIORITY_STYLE: Record<Priority, string> = {
  urgent: "bg-destructive/15 text-destructive border-destructive/40",
  high: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  normal: "bg-blue-500/15 text-blue-400 border-blue-500/40",
  low: "bg-muted text-muted-foreground border-border",
};

const CATEGORY_ICON: Record<Category, typeof InboxIcon> = {
  attack: Swords,
  property: Building2,
  gang: Shield,
  personal: UserIcon,
  financial: DollarSign,
  system: Cpu,
};

export default function InboxPage() {
  const { t, dir, language } = useI18n();
  const [, navigate] = useLocation();
  const [, params] = useRoute<{ id: string }>("/inbox/:id");
  const selectedId = params?.id ? parseInt(params.id, 10) : null;
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const listParams = useMemo(() => ({
    ...(category !== "all" ? { category } : {}),
    ...(unreadOnly ? { unreadOnly: "true" as const } : {}),
    ...(showArchived ? { archived: "true" as const } : { archived: "false" as const }),
    ...(search.trim() ? { search: search.trim() } : {}),
    page: 1,
    limit: 50,
  }), [category, unreadOnly, showArchived, search]);

  const { data: list, isLoading } = useListInboxMessages(listParams, {
    query: { queryKey: getListInboxMessagesQueryKey(listParams), refetchInterval: 30000 },
  });

  const { data: detail } = useGetInboxMessage(selectedId ?? 0, {
    query: {
      queryKey: getGetInboxMessageQueryKey(selectedId ?? 0),
      enabled: !!selectedId,
    },
  });

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
    void queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
  }

  const markAllMutation = useMarkAllInboxRead({
    mutation: { onSuccess: invalidateAll },
  });
  const archiveMutation = useToggleInboxArchive({
    mutation: { onSuccess: invalidateAll },
  });
  const deleteMutation = useDeleteInboxMessage({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        if (selectedId) navigate("/inbox");
      },
    },
  });

  const messages = list?.messages ?? [];
  const categoryCounts = list?.categoryCounts ?? {};
  const dateLocale = language === "ar" ? arLocale : undefined;

  function selectMessage(m: InboxMessage) {
    navigate(`/inbox/${m.id}`);
    if (!m.isRead) {
      // detail fetch auto-marks read; keep cache fresh
      setTimeout(invalidateAll, 250);
    }
  }

  return (
    <div className="space-y-4" dir={dir}>
      <PageBanner
        image="/banners/chat.webp"
        title={t("inbox.title")}
        subtitle={t("inbox.subtitle")}
      />

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] lg:grid-cols-[220px_360px_1fr] gap-4">
        {/* Sidebar: categories */}
        <Card className="p-2 h-fit">
          <div className="space-y-1">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const counts = c.id === "all"
                ? Object.values(categoryCounts).reduce(
                    (acc, v) => ({ total: acc.total + v.total, unread: acc.unread + v.unread }),
                    { total: 0, unread: 0 },
                  )
                : categoryCounts[c.id] ?? { total: 0, unread: 0 };
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  data-testid={`btn-inbox-cat-${c.id}`}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    active ? "bg-primary/10 text-primary" : "hover:bg-secondary text-foreground/80"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left rtl:text-right">{t(c.key)}</span>
                  {counts.unread > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 h-4">{counts.unread}</Badge>
                  )}
                </button>
              );
            })}
          </div>
          <div className="border-t border-border my-2" />
          <div className="px-2 py-1 space-y-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
              {t("inbox.unreadOnly")}
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              {t("inbox.showArchived")}
            </label>
          </div>
        </Card>

        {/* Message list */}
        <Card className="p-0 overflow-hidden flex flex-col h-[70vh]">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2 rtl:left-auto rtl:right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("inbox.search")}
                className="pl-8 rtl:pl-3 rtl:pr-8 h-9"
                data-testid="input-inbox-search"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={(list?.unreadCount ?? 0) === 0 || markAllMutation.isPending}
              onClick={() => markAllMutation.mutate()}
              data-testid="btn-inbox-mark-all-read"
            >
              <CheckCheck className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
              {t("inbox.markAllRead")}
            </Button>
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground text-sm">…</div>
            ) : messages.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">{t("inbox.empty")}</div>
            ) : (
              <ul className="divide-y divide-border">
                {messages.map((m) => {
                  const isSelected = m.id === selectedId;
                  const subject = language === "ar" ? m.subjectAr : m.subjectEn;
                  const body = language === "ar" ? m.bodyAr : m.bodyEn;
                  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 120);
                  const CatIcon = CATEGORY_ICON[m.category as Category] ?? InboxIcon;
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => selectMessage(m)}
                        data-testid={`btn-inbox-msg-${m.id}`}
                        className={`w-full text-left rtl:text-right px-3 py-3 hover:bg-secondary/60 transition-colors flex gap-3 ${
                          isSelected ? "bg-secondary" : !m.isRead ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="shrink-0 mt-0.5">
                          <CatIcon className={`w-5 h-5 ${!m.isRead ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {!m.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                            <span className={`flex-1 text-sm truncate ${!m.isRead ? "font-semibold" : ""}`}>
                              {subject}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 h-4 ${PRIORITY_STYLE[m.priority as Priority]}`}
                            >
                              {t(`inbox.priority.${m.priority}`)}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">
                            {snippet}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{t(`inbox.cat.${m.category}`)}</span>
                            <span>{formatDistanceToNow(new Date(m.createdAt), { addSuffix: true, locale: dateLocale })}</span>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </Card>

        {/* Detail */}
        <Card className="p-4 lg:col-span-1 md:col-span-2 lg:row-auto md:row-start-3 lg:row-start-auto h-[70vh] overflow-hidden flex flex-col">
          {!detail ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <Mail className="w-10 h-10 opacity-40" />
                <span>{t("inbox.selectMessage")}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">
                      {t(`inbox.cat.${detail.category}`)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${PRIORITY_STYLE[detail.priority as Priority]}`}
                    >
                      {t(`inbox.priority.${detail.priority}`)}
                    </Badge>
                  </div>
                  <h2 className="text-lg font-heading font-bold truncate">
                    {language === "ar" ? detail.subjectAr : detail.subjectEn}
                  </h2>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(detail.createdAt), { addSuffix: true, locale: dateLocale })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    title={detail.isArchived ? t("inbox.unarchive") : t("inbox.archive")}
                    onClick={() => archiveMutation.mutate({ id: detail.id })}
                    data-testid="btn-inbox-archive"
                  >
                    {detail.isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title={t("inbox.delete")}
                    onClick={() => deleteMutation.mutate({ id: detail.id })}
                    data-testid="btn-inbox-delete"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1 mt-3">
                <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                  {language === "ar" ? detail.bodyAr : detail.bodyEn}
                </div>
                {detail.metadata && Object.keys(detail.metadata).length > 0 && (
                  <div className="mt-4 rounded-md border border-border bg-secondary/40 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-mono">
                      {t("inbox.metadata")}
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-mono">
                      {Object.entries(detail.metadata).map(([k, v]) => (
                        <Fragment key={k}>
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="text-foreground break-all">
                            {typeof v === "object" ? JSON.stringify(v) : String(v)}
                          </dd>
                        </Fragment>
                      ))}
                    </dl>
                  </div>
                )}
                {detail.actionLink && (
                  <div className="mt-4">
                    <Button
                      size="sm"
                      onClick={() => navigate(detail.actionLink!)}
                      data-testid="btn-inbox-action"
                    >
                      <ExternalLink className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
                      {language === "ar"
                        ? (detail.actionLabelAr ?? detail.actionLabelEn ?? t("inbox.openAction"))
                        : (detail.actionLabelEn ?? detail.actionLabelAr ?? t("inbox.openAction"))}
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
