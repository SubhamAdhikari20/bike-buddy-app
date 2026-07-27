"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { useSession } from "@/components/auth/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, type AuthSession } from "@/lib/api";

export default function RegisterOwnerPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirmation = String(form.get("confirmation"));
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post<AuthSession & { token?: string }>("/auth/register/owner", {
        fullName: String(form.get("fullName")).trim(),
        email: String(form.get("email")).trim(),
        phoneNumber: String(form.get("phoneNumber")).trim(),
        password,
        bio: String(form.get("bio")).trim() || null,
      });
      await refresh();
      router.replace("/owner/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create owner account"
      description="List and manage bikes from the owner portal."
      footer={
        <>
          Already registered?{" "}
          <Link className="font-medium text-blue-700 hover:underline dark:text-blue-300" href="/login">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" autoComplete="name" minLength={3} maxLength={20} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" name="email" type="email" autoComplete="email" maxLength={50} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phoneNumber">Phone number</Label>
          <Input id="phoneNumber" name="phoneNumber" type="tel" autoComplete="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} aria-describedby="phone-help" required />
          <p id="phone-help" className="text-xs text-muted-foreground">Enter exactly 10 digits.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">About you <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea id="bio" name="bio" maxLength={500} rows={3} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={20} aria-describedby="password-help" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmation">Confirm password</Label>
            <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={20} required />
          </div>
        </div>
        <p id="password-help" className="text-xs text-muted-foreground">
          Use 8–20 characters with uppercase, lowercase, a number and @$!%*?&.
        </p>
        {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" disabled={busy} className="h-10 w-full bg-amber-500 text-slate-950 hover:bg-amber-400">
          {busy ? "Creating account…" : "Create owner account"}
        </Button>
      </form>
    </AuthShell>
  );
}
