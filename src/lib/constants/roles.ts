import type { UserRole } from "@/lib/types/database.types";

/**
 * The single source for how a platform role (`profiles.role`) displays —
 * used to be duplicated (and drift out of sync) across ProfileHeader.tsx and
 * AdminPlatformPageClient.tsx; a fleet_manager badge showed "מנהל צי" in one
 * place and "לקוח פרטי עסקי" in the other. This is deliberately a different
 * thing from an org membership's own role label (organization_members.role
 * reuses the same `user_role` enum values, but means something else in that
 * context — a contractor pilot's *permission level inside one org*, not
 * their global account type — see OrgPageClient's own ROLE_LABELS).
 */
export const ROLE_LABEL: Record<UserRole, string> = {
  pilot_hobby: "לקוח פרטי",
  pilot_pro: "לקוח פרטי עסקי",
  fleet_manager: "מנהל צי",
  dispatcher_admin: "מוקדן תיאום",
};
