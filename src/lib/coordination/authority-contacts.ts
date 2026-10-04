import type { Tables } from "@/lib/types/database.types";

export interface AuthorityContact {
  /** What this number is for — "מגדל פיקוח", "תיאום טיסות". */
  label: string;
  phone: string;
}

type AuthorityContactSource = Pick<Tables<"coordination_authorities">, "contacts" | "phone" | "backup_phone" | "whatsapp_phone">;

/** The authority's labeled numbers; falls back to the legacy phone / backup / whatsapp columns for a row that has no list yet. */
export function authorityContacts(a: AuthorityContactSource): AuthorityContact[] {
  const list = Array.isArray(a.contacts)
    ? (a.contacts as unknown[]).flatMap((c) => {
        const item = c as { label?: unknown; phone?: unknown };
        return typeof item?.phone === "string" && item.phone.trim()
          ? [{ label: typeof item.label === "string" ? item.label : "", phone: item.phone.trim() }]
          : [];
      })
    : [];
  if (list.length > 0) return list;
  return [
    { label: "טלפון", phone: a.phone },
    ...(a.backup_phone ? [{ label: "גיבוי", phone: a.backup_phone }] : []),
    ...(a.whatsapp_phone && a.whatsapp_phone !== a.phone ? [{ label: "וואטסאפ", phone: a.whatsapp_phone }] : []),
  ];
}

/** Israeli mobile numbers (05X) are the ones WhatsApp can reach; a landline (0X) can only be called. */
export function isMobileNumber(phone: string): boolean {
  return /^05/.test(phone.replace(/\D/g, ""));
}
