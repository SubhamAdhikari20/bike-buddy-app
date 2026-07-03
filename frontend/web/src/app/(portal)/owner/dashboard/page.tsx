"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bike, CalendarDays, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, session } from "@/lib/api";

export default function OwnerDashboardPage() {
    const [bikeCount, setBikeCount] = useState<number | null>(null);
    const [activeCount, setActiveCount] = useState<number | null>(null);
    const [revenue, setRevenue] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const profileId = session.get()?.profileId;
        if (!profileId) return;

        api.get(`/bikes?ownerId=${profileId}&limit=100&includeUnavailable=true`)
            .then((res) => setBikeCount((res.data as unknown[]).length))
            .catch((err) => setError(err.message));

        api.get("/bookings?limit=100")
            .then((res) => {
                const bookings = (res.data ?? []) as {
                    status: string;
                    paymentStatus: string;
                    totalAmount: number;
                }[];
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
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Owner Dashboard</h1>
                <p className="text-sm text-gray-500">
                    Your fleet, rentals and earnings in one place.
                </p>
            </div>
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
                        <CardTitle className="text-sm font-medium text-gray-500">
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
                        <CardTitle className="text-sm font-medium text-gray-500">
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
                        <CardTitle className="text-sm font-medium text-gray-500">
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
