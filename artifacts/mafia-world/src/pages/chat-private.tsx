import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { ChatWindow } from "@/components/ChatWindow";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Partner { id: number; username: string }

export default function PrivateChatPage() {
  const { t } = useI18n();
  const [, params] = useRoute("/chat/private/:playerId");
  const playerId = params?.playerId ? parseInt(params.playerId) : NaN;
  const [partner, setPartner] = useState<Partner | null>(null);

  useEffect(() => {
    if (!Number.isFinite(playerId)) return;
    let active = true;
    fetch(`/api/chat/private/${playerId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((d) => { if (active && d) setPartner((d as { partner: Partner | null }).partner); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [playerId]);

  if (!Number.isFinite(playerId)) {
    return <div className="text-muted-foreground">{t("chat.invalidPartner")}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/chat">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />{t("common.back")}</Button>
        </Link>
        <MessageCircle className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-heading font-bold uppercase tracking-wider">
          {t("chat.privateWith")} {partner?.username ?? `#${playerId}`}
        </h1>
      </div>
      <ChatWindow channel="private" partnerId={playerId} />
    </div>
  );
}
