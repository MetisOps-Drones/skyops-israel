"use client";

import { MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authorityContacts, isMobileNumber } from "@/lib/coordination/authority-contacts";
import { formatLocalPhone, whatsAppChatLink } from "@/lib/coordination/message";
import type { CoordinationAuthority } from "@/hooks/useCoordinationAuthorities";

/**
 * Every number of one authority, each under its own label ("מגדל פיקוח", "תיאום טיסות"), with the
 * number itself and — next to it — a WhatsApp button for a mobile number or a call button for a
 * landline. Admin-only data, same as the rest of the coordination desk.
 */
export function AuthorityContactList({ authority }: { authority: CoordinationAuthority }) {
  const contacts = authorityContacts(authority);
  return (
    <div className="mt-1 flex flex-col gap-1.5">
      {contacts.map((c, i) => (
        <div key={`${c.phone}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
          {c.label && <span className="min-w-20 font-medium">{c.label}</span>}
          <span dir="ltr" className="text-muted-foreground">
            {formatLocalPhone(c.phone)}
          </span>
          {isMobileNumber(c.phone) ? (
            <Button
              size="sm"
              variant="outline"
              asChild
              className="h-7 border-success/40 px-2 text-success hover:bg-success/10 hover:text-success"
            >
              <a
                href={whatsAppChatLink(c.phone)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`פתיחת שיחה בוואטסאפ — ${c.label || authority.name}`}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                וואטסאפ
              </a>
            </Button>
          ) : (
            <Button size="sm" variant="ghost" asChild className="h-7 px-2">
              <a href={`tel:${c.phone}`} aria-label={`חיוג — ${c.label || authority.name}`}>
                <Phone className="h-3.5 w-3.5" />
                חיוג
              </a>
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
