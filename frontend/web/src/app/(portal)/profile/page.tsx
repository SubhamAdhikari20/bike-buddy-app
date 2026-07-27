"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/auth/session-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, type AuthSession } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const { session, refresh, logout } = useSession();

  if (!session) return null;

  return (
    <ProfileForm
      key={session.user.id}
      session={session}
      refresh={refresh}
      logout={logout}
      redirectToLogin={() => router.replace("/login")}
    />
  );
}

function ProfileForm({
  session,
  refresh,
  logout,
  redirectToLogin,
}: {
  session: AuthSession;
  refresh: () => Promise<AuthSession | null>;
  logout: () => Promise<void>;
  redirectToLogin: () => void;
}) {
  const [fullName, setFullName] = useState(session.profile.fullName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(session.profile.phoneNumber ?? "");
  const [bio, setBio] = useState(session.profile.bio ?? "");
  const [profilePictureUrl, setProfilePictureUrl] = useState(
    session.profile.profilePictureUrl ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await api.patch<AuthSession["profile"]>("/auth/profile", {
        fullName,
        phoneNumber: phoneNumber || null,
        bio: bio || null,
        profilePictureUrl: profilePictureUrl || null,
      });
      await refresh();
      setNotice(response.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the profile.");
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    const confirmed = window.confirm(
      "Delete your profile and account access? Active bookings and owner listings must be cleared first. Historical booking/payment records may be retained for integrity.",
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete<{ deleted: boolean; retainedRecordsNotice?: string }>("/auth/account");
      await logout();
      redirectToLogin();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the account.");
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage the contact details displayed for your Bike Buddy account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Signed in as {session.user.email} · {session.user.role}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={3} maxLength={20} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone number</Label>
              <Input id="phoneNumber" type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">About</Label>
              <Textarea id="bio" rows={4} maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profilePictureUrl">Profile image URL</Label>
              <Input id="profilePictureUrl" type="url" placeholder="https://…" value={profilePictureUrl} onChange={(event) => setProfilePictureUrl(event.target.value)} />
            </div>
            {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
            {notice && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-200" role="status">{notice}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {session.user.role !== "admin" && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>Delete account</CardTitle>
            <CardDescription>
              This removes account access and profile data. Historical booking and payment records may remain without your active profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="destructive" disabled={busy} onClick={deleteAccount}>
              Delete my account
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
