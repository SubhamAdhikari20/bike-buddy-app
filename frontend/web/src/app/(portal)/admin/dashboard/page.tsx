"use client";

import { useEffect, useState } from "react";
import { Bike, CalendarDays, CreditCard, Star, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

type Summary = {
    totalUsers: number;
    totalBikes: number;
    totalBookings: number;
    totalPayments: number;
    totalReviews: number;
};

const tiles = [
    { key: "totalUsers", label: "Users", icon: Users, color: "text-blue-600 bg-blue-50" },
    { key: "totalBikes", label: "Bikes", icon: Bike, color: "text-teal-600 bg-teal-50" },
    { key: "totalBookings", label: "Bookings", icon: CalendarDays, color: "text-amber-600 bg-amber-50" },
    { key: "totalPayments", label: "Payments", icon: CreditCard, color: "text-green-600 bg-green-50" },
    { key: "totalReviews", label: "Reviews", icon: Star, color: "text-purple-600 bg-purple-50" },
] as const;

export default function AdminDashboardPage() {
    const [summary, setSummary] = useState<Summary | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get("/admin/dashboard")
            .then((res) => setSummary(res.data))
            .catch((err) => setError(err.message));
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Global Overview</h1>
                <p className="text-sm text-gray-500">
                    Everything happening on Bike Buddy at a glance.
                </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {tiles.map((tile) => {
                    const Icon = tile.icon;
                    return (
                        <Card key={tile.key}>
                            <CardHeader className="pb-2">
                                <div className={`w-fit rounded-lg p-2 ${tile.color}`}>
                                    <Icon className="h-5 w-5" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold">
                                    {summary ? summary[tile.key] : "-"}
                                </p>
                                <CardTitle className="text-sm font-medium text-gray-500">
                                    {tile.label}
                                </CardTitle>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Quick actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3 text-sm">
                    <a href="/admin/owners" className="rounded-lg bg-blue-50 px-4 py-2 font-medium text-blue-700 hover:bg-blue-100">
                        Review pending owners
                    </a>
                    <a href="/admin/tickets" className="rounded-lg bg-amber-50 px-4 py-2 font-medium text-amber-700 hover:bg-amber-100">
                        Open support tickets
                    </a>
                    <a href="/admin/bookings" className="rounded-lg bg-teal-50 px-4 py-2 font-medium text-teal-700 hover:bg-teal-100">
                        Today&apos;s bookings
                    </a>
                </CardContent>
            </Card>
        </div>
    );
}
