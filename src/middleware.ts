import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match every request path except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     * - static asset extensions
     * - /models — face-api.js's static weight files (manifest .json + extensionless
     *   shard files), served from public/models and fetched directly by the browser;
     *   no session cookie to check and no page to redirect to, so running them through
     *   auth middleware is pure overhead at best (a 401/redirect body in place of the
     *   JSON manifest for a logged-out tab, breaking the face-match feature, at worst)
     * - the cron API routes, which authenticate via CRON_SECRET instead of a user session
     * - the public partner API routes, which authenticate via a per-layer API key (see
     *   src/lib/api-keys/verify.ts) instead of a browser session — a partner calling
     *   these has no Supabase cookie at all, so redirecting them to /auth/login is wrong.
     */
    "/((?!_next/static|_next/image|favicon.ico|models/|api/cron|api/public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
