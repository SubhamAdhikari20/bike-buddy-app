"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, session } from "@/lib/api";

type BikeRow = {
    _id: string;
    title: string;
    category: string;
    pricePerDay: number;
    status: string;
    verifiedBike: boolean;
    averageRating: number;
    ratingCount: number;
    location?: { city?: string };
};

const statusBadge: Record<string, string> = {
    available: "bg-green-100 text-green-700",
    unavailable: "bg-amber-100 text-amber-700",
    maintenance: "bg-blue-100 text-blue-700",
    inactive: "bg-gray-200 text-gray-600",
};

export default function OwnerBikesPage() {
    const [bikes, setBikes] = useState<BikeRow[]>([]);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        const profileId = session.get()?.profileId;
        if (!profileId) return;
        api.get(`/bikes?ownerId=${profileId}&limit=100&includeUnavailable=true`)
            .then((res) => setBikes(res.data))
            .catch((err) => setError(err.message));
    }, []);

    useEffect(load, [load]);

    const setStatus = async (bikeId: string, status: string) => {
        try {
            await api.patch(`/bikes/${bikeId}`, { status });
            load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">My Bikes</h1>
                    <p className="text-sm text-gray-500">Your fleet and its status.</p>
                </div>
                <Link href="/owner/bikes/new">
                    <Button className="bg-amber-500 text-white hover:bg-amber-600">
                        + List a new bike
                    </Button>
                </Link>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}

            <Card>
                <CardHeader>
                    <CardTitle>Fleet</CardTitle>
                    <CardDescription>{bikes.length} bikes</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Bike</TableHead>
                                <TableHead>City</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Rate/day</TableHead>
                                <TableHead>Rating</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {bikes.map((bike) => (
                                <TableRow key={bike._id}>
                                    <TableCell className="font-medium">
                                        {bike.title}
                                        {bike.verifiedBike && (
                                            <Badge className="ml-2 bg-green-100 text-green-700">
                                                verified
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>{bike.location?.city ?? "-"}</TableCell>
                                    <TableCell className="capitalize">{bike.category}</TableCell>
                                    <TableCell>NPR {bike.pricePerDay.toLocaleString()}</TableCell>
                                    <TableCell>
                                        {bike.ratingCount > 0
                                            ? `${bike.averageRating.toFixed(1)} (${bike.ratingCount})`
                                            : "-"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={statusBadge[bike.status] ?? ""}>
                                            {bike.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="space-x-2 text-right">
                                        {bike.status === "available" ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setStatus(bike._id, "maintenance")}
                                            >
                                                To maintenance
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                className="bg-green-600 text-white hover:bg-green-700"
                                                onClick={() => setStatus(bike._id, "available")}
                                            >
                                                Make available
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
