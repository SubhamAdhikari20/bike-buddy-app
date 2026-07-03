"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";

type BikeRow = {
    _id: string;
    title: string;
    brand: string;
    category: string;
    pricePerDay: number;
    status: string;
    location?: { city?: string };
    ownerId?: { fullName?: string };
};

const statusBadge: Record<string, string> = {
    available: "bg-green-100 text-green-700",
    unavailable: "bg-amber-100 text-amber-700",
    maintenance: "bg-blue-100 text-blue-700",
    inactive: "bg-gray-200 text-gray-600",
};

export default function AdminBikesPage() {
    const [bikes, setBikes] = useState<BikeRow[]>([]);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        api.get("/bikes?limit=100&includeUnavailable=true")
            .then((res) => setBikes(res.data))
            .catch((err) => setError(err.message));
    }, []);

    useEffect(load, [load]);

    const setStatus = async (bikeId: string, status: string) => {
        try {
            await api.patch(`/admin/bikes/${bikeId}/status`, { status });
            load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Bikes</h1>
                <p className="text-sm text-gray-500">
                    Every listed bike on the platform. Suspend anything unsafe.
                </p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}

            <Card>
                <CardHeader>
                    <CardTitle>All bikes</CardTitle>
                    <CardDescription>{bikes.length} listed</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Bike</TableHead>
                                <TableHead>Owner</TableHead>
                                <TableHead>City</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Rate/day</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {bikes.map((bike) => (
                                <TableRow key={bike._id}>
                                    <TableCell className="font-medium">{bike.title}</TableCell>
                                    <TableCell>{bike.ownerId?.fullName ?? "-"}</TableCell>
                                    <TableCell>{bike.location?.city ?? "-"}</TableCell>
                                    <TableCell className="capitalize">{bike.category}</TableCell>
                                    <TableCell>NPR {bike.pricePerDay.toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Badge className={statusBadge[bike.status] ?? ""}>
                                            {bike.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="space-x-2 text-right">
                                        {bike.status !== "inactive" ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-red-300 text-red-600 hover:bg-red-50"
                                                onClick={() => setStatus(bike._id, "inactive")}
                                            >
                                                Suspend
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                className="bg-green-600 text-white hover:bg-green-700"
                                                onClick={() => setStatus(bike._id, "available")}
                                            >
                                                Reactivate
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
