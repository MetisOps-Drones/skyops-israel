import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Map, BookOpen, GraduationCap, ShieldCheck, Building2, BarChart3, UserCircle, KeyRound, Store, BadgeCheck, LayoutGrid, Handshake, MessagesSquare } from "lucide-react";
import type { UserRole } from "@/lib/types/database.types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** If set, only these roles see this item. Omit to show to everyone. */
  roles?: UserRole[];
  /**
   * Hidden only for a *pure* hobby pilot — pilot_hobby with no org context.
   * A pilot_hobby who's actually contracting for an org (role never got
   * upgraded) still needs these; the distinguishing signal is org
   * membership, not the static profile role.
   */
  hideForPureHobby?: boolean;
  /** Requires active org membership regardless of role (e.g. the freelancer marketplace, org-tier only). */
  orgOnly?: boolean;
  /**
   * Only visible to an active org's fleet manager or a dispatcher_admin — for
   * pages whose actual content gate is exactly that (e.g. analytics), so the
   * nav never shows a link that the page itself will then refuse.
   */
  fleetManagerOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "בקרה ראשית", icon: LayoutDashboard },
  { href: "/map", label: "מפת טיסות", icon: Map },
  { href: "/logs", label: "יומן טיסות", icon: BookOpen, hideForPureHobby: true },
  { href: "/academy", label: "אקדמיה", icon: GraduationCap },
  { href: "/profile", label: "הפרופיל שלי", icon: UserCircle },
  { href: "/org", label: "הארגון שלי", icon: Building2, orgOnly: true },
  { href: "/marketplace", label: "מרקטפלייס מטיסים", icon: Store, orgOnly: true },
  { href: "/marketplace/bookings", label: "הזמנות עבודה", icon: Handshake },
  { href: "/analytics", label: "אנליטיקס", icon: BarChart3, fleetManagerOnly: true },
  { href: "/ops", label: "מוקד תיאום", icon: ShieldCheck, roles: ["dispatcher_admin"] },
  { href: "/admin/platform", label: "ניהול פלטפורמה", icon: LayoutGrid, roles: ["dispatcher_admin"] },
  { href: "/admin/api", label: "API לשותפים", icon: KeyRound, roles: ["dispatcher_admin"] },
  { href: "/admin/pilots", label: "אימות מטיסים", icon: BadgeCheck, roles: ["dispatcher_admin"] },
  { href: "/admin/marketplace", label: "ניטור מרקטפלייס", icon: MessagesSquare, roles: ["dispatcher_admin"] },
];

export function visibleNavItems(
  role: UserRole | null | undefined,
  hasOrg: boolean,
  isFleetManager: boolean = false
): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (item.roles && !(role && item.roles.includes(role))) return false;
    if (item.hideForPureHobby && role === "pilot_hobby" && !hasOrg) return false;
    if (item.orgOnly && !hasOrg) return false;
    if (item.fleetManagerOnly && !isFleetManager && role !== "dispatcher_admin") return false;
    return true;
  });
}
