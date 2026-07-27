"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { useSession } from "@/components/auth/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type AuthSession } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, refresh, logout } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session?.user.role === "admin") router.replace("/admin/dashboard");
    if (session?.user.role === "owner") router.replace("/owner/dashboard");
  }, [router, session]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await api.post<AuthSession & { token?: string }>(
        "/auth/login",
        { email, password },
      );
      if (response.data.user.role === "renter") {
        await logout();
        setError(
          "Renter accounts use the Bike Buddy mobile app. This portal is for owners and administrators.",
        );
        return;
      }
      const current = await refresh();
      if (!current) throw new Error("The secure session could not be verified.");
      router.replace(
        current.user.role === "admin"
          ? "/admin/dashboard"
          : "/owner/dashboard",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  const notice =
    searchParams.get("notice") === "renter"
      ? "Renter accounts use the Bike Buddy mobile app."
      : searchParams.get("notice") === "registered"
        ? "Owner account created. Your verification status is visible in the portal."
        : searchParams.get("notice") === "reset"
          ? "Password reset. Sign in with your new password."
          : null;

  return (
    <AuthShell
      title="Bike Buddy Portal"
      description="Secure access for bike owners and administrators."
      footer={
        <>
          New bike owner?{" "}
          <Link className="font-medium text-blue-700 hover:underline dark:text-blue-300" href="/register">
            Create an owner account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {notice && (
          <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/50 dark:text-blue-200" role="status">
            {notice}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              className="pl-9"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300" href="/forgot-password">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              className="pl-9"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              maxLength={20}
            />
          </div>
        </div>
        {error && (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="h-10 w-full bg-amber-500 text-slate-950 hover:bg-amber-400">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell title="Bike Buddy Portal" description="Loading secure sign in…"><p className="text-center text-sm text-muted-foreground" role="status">Loading…</p></AuthShell>}>
      <LoginForm />
    </Suspense>
  );
}
