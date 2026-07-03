"use client";

// Shared portal shell: blue sidebar with role-aware navigation
// (Jakob's law - the standard admin layout everyone already knows).
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Bike,
    CalendarDays,
    Gauge,
    LifeBuoy,
    LogOut,
    ShieldCheck,
    Users,
    Wrench,
} from "lucide-react";
import { session, type Session } from "@/lib/api";

const adminNav = [
    { href: "/admin/dashboard", label: "Dashboard", icon: Gauge },
    { href: "/admin/owners", label: "Owner Verification", icon: ShieldCheck },
    { href: "/admin/bikes", label: "Bikes", icon: Bike },
    { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
    { href: "/admin/tickets", label: "Support Tickets", icon: LifeBuoy },
];

const ownerNav = [
    { href: "/owner/dashboard", label: "Dashboard", icon: Gauge },
    { href: "/owner/bikes", label: "My Bikes", icon: Bike },
    { href: "/owner/bookings", label: "Bookings", icon: CalendarDays },
    { href: "/owner/damages", label: "Damage Reports", icon: Wrench },
];

export default function PortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [current, setCurrent] = useState<Session | null>(null);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        const s = session.get();
        if (!s) {
            router.replace("/login");
            return;
        }
        // Keep admins and owners inside their own area.
        if (pathname.startsWith("/admin") && s.role !== "admin") {
            router.replace("/owner/dashboard");
            return;
        }
        if (pathname.startsWith("/owner") && s.role !== "owner") {
            router.replace("/admin/dashboard");
            return;
        }
        setCurrent(s);
        setChecked(true);
    }, [pathname, router]);

    if (!checked || !current) {
        return (
            <div className="flex min-h-screen items-center justify-center text-gray-500">
                Loading portal...
            </div>
        );
    }

    const nav = current.role === "admin" ? adminNav : ownerNav;

    return (
        <div className="flex min-h-screen bg-gray-50">
            <aside className="flex w-60 flex-col bg-blue-700 text-white">
                <div className="flex items-center gap-2 px-5 py-5 text-lg font-bold">
                    <Bike className="h-6 w-6" />
                    Bike Buddy
                </div>
                <div className="px-5 pb-4 text-xs uppercase tracking-wider text-blue-200">
                    {current.role === "admin" ? "Admin Portal" : "Owner Portal"}
                </div>
                <nav className="flex-1 space-y-1 px-3">
                    {nav.map((item) => {
                        const active = pathname.startsWith(item.href);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                                    active
                                        ? "bg-white text-blue-700"
                                        : "text-blue-100 hover:bg-blue-600"
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
                <div className="border-t border-blue-600 p-4">
                    <p className="truncate text-sm font-medium">{current.fullName || current.email}</p>
                    <p className="truncate text-xs text-blue-200">{current.email}</p>
                    <button
                        onClick={() => {
                            session.clear();
                            router.replace("/login");
                        }}
                        className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-blue-100 hover:bg-blue-600"
                    >
                        <LogOut className="h-4 w-4" />
                        Sign out
                    </button>
                </div>
            </aside>
            <main className="flex-1 overflow-x-auto p-8">{children}</main>
        </div>
    );
}
