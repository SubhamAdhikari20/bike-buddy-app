"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await api.post<{ email: string; expiresInMinutes: number }>(
        "/auth/forgot-password",
        { email },
      );
      setNotice(response.message);
      setStep("reset");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request a code.");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirmation"))) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post<{ reset: boolean }>("/auth/reset-password", {
        email,
        code: String(form.get("code")).trim(),
        password,
      });
      router.replace("/login?notice=reset");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reset the password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Reset password"
      description={
        step === "request"
          ? "Request a one-time code for your account email."
          : `Enter the six-digit code sent to ${email}.`
      }
      footer={<Link className="font-medium text-blue-700 hover:underline dark:text-blue-300" href="/login">Back to sign in</Link>}
    >
      {step === "request" ? (
        <form onSubmit={requestCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Account email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" disabled={busy} className="h-10 w-full">
            {busy ? "Sending code…" : "Send reset code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="space-y-4">
          {notice && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/50 dark:text-blue-200" role="status">{notice}</p>}
          <div className="space-y-2">
            <Label htmlFor="code">Six-digit code</Label>
            <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={20} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmation">Confirm new password</Label>
            <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={20} required />
          </div>
          {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy} className="flex-1">
              {busy ? "Resetting…" : "Reset password"}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setStep("request"); setNotice(null); setError(null); }}>
              Start over
            </Button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
