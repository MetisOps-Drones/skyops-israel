"use client";

import { MessageCircle } from "lucide-react";
import { useCoordinationAuthorities } from "@/hooks/useCoordinationAuthorities";
import { formatLocalPhone, whatsAppChatLink } from "@/lib/coordination/message";

/**
 * One-tap WhatsApp chats with every coordination authority that has a WhatsApp number (e.g. the
 * Hatzor tower) — pinned at the top of the coordination desk so the coordinator doesn't have to
 * open a specific request first to reach them. Admin-only data (RLS), same as the rest of /ops.
 */
export function WhatsAppQuickLinks() {
  const { data: authorities = [] } = useCoordinationAuthorities();
  const withWhatsApp = authorities.filter((a) => a.whatsapp_phone);
  if (withWhatsApp.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">וואטסאפ לתיאום:</span>
      {withWhatsApp.map((a) => (
        <a
          key={a.id}
          href={whatsAppChatLink(a.whatsapp_phone!)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`פתיחת צ'אט וואטסאפ עם ${a.name}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1.5 text-sm font-medium text-success transition-colors hover:bg-success/20"
        >
          <MessageCircle className="h-4 w-4 shrink-0" />
          {a.name}
          <span dir="ltr" className="font-normal">
            {formatLocalPhone(a.whatsapp_phone!)}
          </span>
        </a>
      ))}
    </div>
  );
}
