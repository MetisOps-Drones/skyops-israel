"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithPassword, type AuthActionResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OAuthButtons } from "./OAuthButtons";

const initialState: AuthActionResult = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "מתחבר..." : label}
    </Button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [signInState, signInAction] = useFormState(signInWithPassword, initialState);

  useEffect(() => {
    if (signInState.success) {
      router.push("/map");
      router.refresh();
    }
  }, [signInState.success, router]);

  return (
    <div className="flex flex-col gap-4">
      <OAuthButtons />
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">או</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={signInAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">אימייל</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" dir="ltr" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">סיסמה</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" dir="ltr" />
        </div>
        {signInState.error && <p className="text-sm text-destructive">{signInState.error}</p>}
        <SubmitButton label="התחבר" />
      </form>

      <p className="text-center text-sm text-muted-foreground">
        עדיין אין לכם חשבון?{" "}
        <Link href="/auth/signup" className="font-medium text-primary underline">
          הרשמה
        </Link>
      </p>
    </div>
  );
}
