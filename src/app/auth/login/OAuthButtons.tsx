"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.62l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M16.36 1.2c.1 1.02-.28 2-.9 2.75-.63.76-1.66 1.35-2.68 1.27-.12-1 .33-2.03.93-2.73.66-.77 1.8-1.35 2.65-1.29ZM20 17.1c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.52-1.54.02-1.94-1-4.02-1-2.09 0-2.53.98-4.06 1.02-1.65.04-2.9-1.68-3.9-3.24-2.12-3.3-2.5-7.18-1.1-9.24.99-1.47 2.55-2.34 4.02-2.34 1.5 0 2.44 1.02 3.68 1.02 1.2 0 1.94-1.02 3.68-1.02 1.31 0 2.7.72 3.69 1.95-1.94 1.06-2.63 3.7-1.34 5.37.41.53.92.9 1 .0Z" />
    </svg>
  );
}

export function OAuthButtons() {
  const [loading, setLoading] = useState<"google" | "apple" | null>(null);

  async function handleOAuth(provider: "google" | "apple") {
    setLoading(provider);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        toast.error(error.message);
        setLoading(null);
      }
      // On success the browser navigates away to the provider — nothing left to do here.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ההתחברות נכשלה");
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" className="w-full" onClick={() => handleOAuth("google")} disabled={loading !== null}>
        {loading === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
        המשך עם Google
      </Button>
      <Button type="button" variant="outline" className="w-full" onClick={() => handleOAuth("apple")} disabled={loading !== null}>
        {loading === "apple" ? <Loader2 className="h-4 w-4 animate-spin" /> : <AppleIcon />}
        המשך עם Apple
      </Button>
    </div>
  );
}
