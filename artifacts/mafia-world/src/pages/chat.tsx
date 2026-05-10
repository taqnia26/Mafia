import { useState } from "react";
import { useGetMyProfile } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChatWindow, type ChatChannel } from "@/components/ChatWindow";
import { Globe, Shield, Building2, MessageCircle } from "lucide-react";

export default function ChatPage() {
  const { t } = useI18n();
  const { data: me } = useGetMyProfile();
  const [tab, setTab] = useState<ChatChannel>("global");
  const inGang = !!me?.gangId;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <MessageCircle className="w-6 h-6 text-primary" />
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("chat.title")}</h1>
      </div>
      <p className="text-sm text-muted-foreground">{t("chat.intro")}</p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ChatChannel)}>
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="global"><Globe className="w-4 h-4 mr-2" />{t("chat.global")}</TabsTrigger>
          <TabsTrigger value="gang" disabled={!inGang}><Shield className="w-4 h-4 mr-2" />{t("chat.gang")}</TabsTrigger>
          <TabsTrigger value="city"><Building2 className="w-4 h-4 mr-2" />{t("chat.city")}</TabsTrigger>
        </TabsList>
        <TabsContent value="global" className="mt-4">
          <ChatWindow channel="global" />
        </TabsContent>
        <TabsContent value="gang" className="mt-4">
          <ChatWindow channel="gang" disabled={!inGang} disabledReason={t("chat.noGang")} />
        </TabsContent>
        <TabsContent value="city" className="mt-4">
          <ChatWindow channel="city" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
