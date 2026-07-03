"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";

type BookingRow = {
    _id: string;
    bikeId?: { title?: string };
    renterId?: { fullName?: string };
    startDate: string;
    endDate: string;
    status: string;
    paymentStatus: string;
    totalAmount: number;
};

const statusBadge: Record<string, string> = {
    confirmed: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    completed: "bg-blue-100 text-blue-700",
    cancelled: "bg-red-100 text-red-700",
    rejected: "bg-gray-200 text-gray-600",
};

export default function AdminBookingsPage() {
    const [bookings, setBookings] = useState<BookingRow[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get("/admin/bookings?limit=100")
            .then((res) => setBookings(res.data.items ?? res.data))
            .catch((err) => setError(err.message));
    }, []);

    const fmt = (iso: string) =>
        new Date(iso).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
                <p className="text-sm text-gray-500">All rentals across the platform.</p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}

            <Card>
                <CardHeader>
                    <CardTitle>All bookings</CardTitle>
                    <CardDescription>{bookings.length} records</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ref</TableHead>
                                <TableHead>Bike</TableHead>
                                <TableHead>Rider</TableHead>
                                <TableHead>From</TableHead>
                                <TableHead>To</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Payment</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {bookings.map((booking) => (
                                <TableRow key={booking._id}>
                                    <TableCell className="font-mono text-xs">
                                        #{booking._id.slice(-6).toUpperCase()}
                                    </TableCell>
                                    <TableCell>{booking.bikeId?.title ?? "-"}</TableCell>
                                    <TableCell>{booking.renterId?.fullName ?? "-"}</TableCell>
                                    <TableCell>{fmt(booking.startDate)}</TableCell>
                                    <TableCell>{fmt(booking.endDate)}</TableCell>
                                    <TableCell>NPR {booking.totalAmount.toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Badge className={statusBadge[booking.status] ?? ""}>
                                            {booking.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="capitalize">{booking.paymentStatus}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
