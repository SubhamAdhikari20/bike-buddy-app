"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/auth/session-provider";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, mediaUrl, type AuthSession } from "@/lib/api";

const acceptedAvatarTypes = ["image/jpeg", "image/png", "image/webp"];
const maxAvatarBytes = 5 * 1024 * 1024;

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
  const [phoneNumber, setPhoneNumber] = useState(
    session.profile.phoneNumber ?? "",
  );
  const [bio, setBio] = useState(session.profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    session.profile.profilePictureUrl ?? null,
  );
  console.log("ProfilePictureUrl:", session.profile.profilePictureUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = (fullName || session.user.email)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const chooseAvatar = (file?: File) => {
    setError(null);
    if (!file) return;
    if (!acceptedAvatarTypes.includes(file.type)) {
      setError("Choose a JPG, PNG or WEBP profile picture.");
      return;
    }
    if (file.size > maxAvatarBytes) {
      setError("Profile pictures must be 5 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarFile(file);
      setAvatarUrl(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let storedAvatarUrl = avatarUrl;
      if (avatarFile) {
        const uploaded = await api.upload(avatarFile, "profile");
        storedAvatarUrl = uploaded.data.url;
      }

      const response = await api.patch<AuthSession>("/auth/profile", {
        fullName,
        phoneNumber,
        bio: bio || null,
        profilePictureUrl: storedAvatarUrl || null,
      });
      await refresh();
      setAvatarFile(null);
      setAvatarUrl(response.data.profile.profilePictureUrl ?? storedAvatarUrl);
      toast.success("Profile updated", { description: response.message });
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Could not update the profile.";
      setError(message);
      toast.error("Profile was not updated", { description: message });
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.delete<{ deleted: boolean }>("/auth/account");
      setDeleteOpen(false);
      await logout();
      toast.success("Account deleted", {
        description: "Your profile and account access were removed.",
      });
      redirectToLogin();
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Could not delete the account.";
      setError(message);
      toast.error("Account was not deleted", { description: message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your avatar and the contact details used in Bike Buddy.
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
          <form onSubmit={save} className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-blue-50 text-xl font-semibold text-blue-800 dark:bg-blue-950">
                {avatarUrl ? (
                  // User avatars can be returned from the local API or Google.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(avatarUrl)}
                    alt={`${fullName || "User"} profile`}
                    className="size-full object-cover"
                  />
                ) : (
                  <span aria-label="Profile initials">{initials || "BB"}</span>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Label
                    htmlFor="profile-avatar"
                    className="inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                  >
                    <ImagePlus className="size-4" aria-hidden="true" />
                    {avatarUrl ? "Change picture" : "Add picture"}
                  </Label>
                  <Input
                    id="profile-avatar"
                    type="file"
                    accept={acceptedAvatarTypes.join(",")}
                    className="sr-only"
                    disabled={busy}
                    onChange={(event) => chooseAvatar(event.target.files?.[0])}
                  />
                  {avatarUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setAvatarFile(null);
                        setAvatarUrl(null);
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or WEBP, up to 5 MB. A square photo works best.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                minLength={3}
                maxLength={60}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">About</Label>
              <Textarea
                id="bio"
                rows={4}
                maxLength={500}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
              />
            </div>
            {error && (
              <p
                className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
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
              This removes account access and profile data. Historical booking
              and payment records may remain without your active profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger
                render={<Button type="button" variant="destructive" />}
              >
                Delete my account
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete your Bike Buddy account?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes your profile and account access. Active
                    bookings and owner listings must be cleared first, and
                    historical transaction records may be retained for
                    integrity.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void deleteAccount()}
                  >
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    {busy ? "Deleting…" : "Delete account"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
