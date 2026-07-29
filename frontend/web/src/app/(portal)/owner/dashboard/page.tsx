"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bike, CalendarDays, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/components/auth/session-provider";
import { api } from "@/lib/api";

type BookingSummary = {
    status: string;
    paymentStatus: string;
    totalAmount: number;
};

export default function OwnerDashboardPage() {
    const { session } = useSession();
    const [bikeCount, setBikeCount] = useState<number | null>(null);
    const [activeCount, setActiveCount] = useState<number | null>(null);
    const [revenue, setRevenue] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const profileId = session?.profile.id;
        if (!profileId) return;

        api.get<unknown[]>(`/bikes?ownerId=${profileId}&limit=100&includeUnavailable=true`)
            .then((res) => setBikeCount(res.data.length))
            .catch((err) => setError(err.message));

        api.get<BookingSummary[]>("/bookings?limit=100")
            .then((res) => {
                const bookings = res.data;
                setActiveCount(
                    bookings.filter((b) => b.status === "confirmed").length,
                );
                setRevenue(
                    bookings
                        .filter((b) => b.paymentStatus === "paid")
                        .reduce((sum, b) => sum + b.totalAmount, 0),
                );
            })
            .catch((err) => setError(err.message));
    }, [session?.profile.id]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Owner Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                    Your fleet, rentals and earnings in one place.
                </p>
            </div>
            {session?.profile.ownerStatus !== "verified" && (
                <div className="border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900" role="status">
                    Your owner account is {session?.profile.ownerStatus ?? "pending"}.
                    An administrator must verify it before you can publish bike listings.
                </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <div className="w-fit rounded-lg bg-blue-50 p-2 text-blue-600">
                            <Bike className="h-5 w-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{bikeCount ?? "-"}</p>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            My bikes
                        </CardTitle>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <div className="w-fit rounded-lg bg-teal-50 p-2 text-teal-600">
                            <CalendarDays className="h-5 w-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{activeCount ?? "-"}</p>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Active rentals
                        </CardTitle>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <div className="w-fit rounded-lg bg-green-50 p-2 text-green-600">
                            <Wallet className="h-5 w-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">
                            {revenue !== null ? `NPR ${revenue.toLocaleString()}` : "-"}
                        </p>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Paid revenue
                        </CardTitle>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Quick actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3 text-sm">
                    <Link
                        href="/owner/bikes/new"
                        className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-white hover:bg-amber-600"
                    >
                        + List a new bike
                    </Link>
                    <Link
                        href="/owner/bookings"
                        className="rounded-lg bg-blue-50 px-4 py-2 font-medium text-blue-700 hover:bg-blue-100"
                    >
                        Manage bookings
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
