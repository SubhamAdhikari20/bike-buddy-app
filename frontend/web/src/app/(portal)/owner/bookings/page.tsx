"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
};

export default function OwnerBookingsPage() {
    const [bookings, setBookings] = useState<BookingRow[]>([]);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        api.get("/bookings?limit=100")
            .then((res) => setBookings(res.data ?? []))
            .catch((err) => setError(err.message));
    }, []);

    useEffect(load, [load]);

    const act = async (bookingId: string, action: "confirm" | "complete") => {
        try {
            await api.patch(`/bookings/${bookingId}/${action}`);
            load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
        }
    };

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
                <p className="text-sm text-gray-500">
                    Rentals of your bikes. Confirm pickups and mark returns complete.
                </p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}

            <Card>
                <CardHeader>
                    <CardTitle>My rentals</CardTitle>
                    <CardDescription>{bookings.length} bookings</CardDescription>
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
                                <TableHead className="text-right">Actions</TableHead>
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
                                    <TableCell className="space-x-2 text-right">
                                        {booking.status === "pending" && (
                                            <Button
                                                size="sm"
                                                className="bg-green-600 text-white hover:bg-green-700"
                                                onClick={() => act(booking._id, "confirm")}
                                            >
                                                Confirm
                                            </Button>
                                        )}
                                        {booking.status === "confirmed" && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => act(booking._id, "complete")}
                                            >
                                                Mark returned
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
