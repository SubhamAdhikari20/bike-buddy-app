"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Bike,
  CalendarDays,
  Gauge,
  IdCard,
  LifeBuoy,
  Menu,
  ShieldCheck,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { useSession } from "@/components/auth/session-provider";
import { LoadingState } from "@/components/page-state";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NotificationProvider } from "@/components/notifications/notification-provider";

const adminNav = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/admin/owners", label: "Owner verification", icon: ShieldCheck },
  { href: "/admin/kyc", label: "Renter ID review", icon: IdCard },
  { href: "/admin/bikes", label: "Bikes", icon: Bike },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/tickets", label: "Support tickets", icon: LifeBuoy },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: UserRound },
];

const ownerNav = [
  { href: "/owner/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/owner/bikes", label: "My bikes", icon: Bike },
  { href: "/owner/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/owner/damages", label: "Damage reports", icon: Wrench },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, status, logout } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (status === "guest") {
      router.replace("/login");
      return;
    }
    if (!session) return;
    if (pathname.startsWith("/admin") && session.user.role !== "admin") {
      router.replace(
        session.user.role === "owner"
          ? "/owner/dashboard"
          : "/login?notice=renter",
      );
    }
    if (
      (pathname.startsWith("/owner") ||
        pathname === "/profile" ||
        pathname === "/notifications") &&
      !["owner", "admin"].includes(session.user.role)
    ) {
      router.replace("/login?notice=renter");
    }
  }, [pathname, router, session, status]);

  if (status === "loading" || !session) {
    return <LoadingState label="Checking your secure session…" />;
  }

  const nav = session.user.role === "admin" ? adminNav : ownerNav;
  const roleAllowed =
    (pathname.startsWith("/admin") && session.user.role === "admin") ||
    (pathname.startsWith("/owner") && session.user.role === "owner") ||
    (pathname === "/notifications" &&
      ["admin", "owner"].includes(session.user.role)) ||
    pathname === "/profile";
  if (!roleAllowed) return <LoadingState label="Opening the correct portal…" />;

  const signOut = async () => {
    await logout();
    toast.success("Signed out", {
      description: "Your portal session is closed.",
    });
    router.replace("/login");
  };

  const navigation = (
    <>
      <div className="flex items-center gap-3 px-5 py-5 text-lg font-bold">
        <Image
          src="/bike-buddy-logo.png"
          alt=""
          width={36}
          height={36}
          priority
          className="size-9 rounded-lg bg-white object-cover"
        />
        Bike Buddy
      </div>
      <div className="px-5 pb-4 text-xs uppercase tracking-wider text-blue-200">
        {session.user.role === "admin" ? "Admin portal" : "Owner portal"}
      </div>
      <nav aria-label="Portal" className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active =
            item.href === "/profile"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-white text-blue-800"
                  : "text-blue-100 hover:bg-blue-600"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-blue-600 p-4">
        <p className="truncate text-sm font-medium">
          {session.profile.fullName || session.user.email}
        </p>
        <p className="truncate text-xs text-blue-200">{session.user.email}</p>
        <div className="mt-3">
          <ConfirmActionDialog
            triggerLabel="Sign out"
            triggerVariant="ghost"
            triggerClassName="min-h-11 w-full justify-start text-blue-100 hover:bg-blue-600 hover:text-white"
            confirmVariant="default"
            title="Sign out of Bike Buddy?"
            description="You will return to the portal login page. Unsaved form changes will be lost."
            confirmLabel="Sign out"
            onConfirm={signOut}
          />
        </div>
      </div>
    </>
  );

  return (
    <NotificationProvider
      key={session.user.id}
      userId={session.user.id}
      role={session.user.role}
    >
      <div className="min-h-screen bg-muted/30">
        <a
          href="#main-content"
          className="fixed left-3 top-3 z-50 -translate-y-20 rounded-lg bg-background px-4 py-2 font-medium shadow focus:translate-y-0"
        >
          Skip to content
        </a>
        <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-blue-700 text-white lg:flex">
          {navigation}
        </aside>
        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Close navigation"
              onClick={() => setMenuOpen(false)}
            />
            <aside className="relative flex h-full w-[min(20rem,85vw)] flex-col bg-blue-700 text-white shadow-xl">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 text-white hover:bg-blue-600 hover:text-white"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              >
                <X />
              </Button>
              {navigation}
            </aside>
          </div>
        )}
        <div className="lg:pl-64">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu />
            </Button>
            <p className="hidden text-sm text-muted-foreground sm:block">
              {session.user.role === "admin"
                ? "Platform administration"
                : `Owner status: ${session.profile.ownerStatus ?? "none"}`}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <span className="sr-only">
                Signed in as {session.profile.fullName || session.user.email}
              </span>
              <NotificationBell role={session.user.role} />
              <ThemeToggle />
            </div>
          </header>
          <main
            id="main-content"
            className="mx-auto max-w-screen-2xl p-4 sm:p-6 lg:p-8"
          >
            {children}
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
}
