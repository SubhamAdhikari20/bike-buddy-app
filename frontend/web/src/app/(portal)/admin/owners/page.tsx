"use client";

// Verification Center (TR-01): approve or reject bike owners. The green
// verified badge in the app comes from this decision.
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";

type Owner = {
    _id: string;
    fullName: string;
    phoneNumber: string;
    ownerStatus: "none" | "pending" | "verified" | "rejected";
    bio?: string | null;
    createdAt: string;
};

const statusBadge: Record<string, string> = {
    verified: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    rejected: "bg-red-100 text-red-700",
    none: "bg-gray-100 text-gray-600",
};

export default function AdminOwnersPage() {
    const [owners, setOwners] = useState<Owner[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(() => {
        api.get("/admin/owners?limit=100")
            .then((res) => setOwners(res.data))
            .catch((err) => setError(err.message));
    }, []);

    useEffect(load, [load]);

    const decide = async (ownerId: string, status: "verified" | "rejected") => {
        setBusyId(ownerId);
        try {
            await api.patch(`/admin/owners/${ownerId}/verify`, { status });
            load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Owner Verification</h1>
                <p className="text-sm text-gray-500">
                    Verified owners get the green badge riders trust.
                </p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}

            <Card>
                <CardHeader>
                    <CardTitle>All owners</CardTitle>
                    <CardDescription>{owners.length} registered</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>About</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {owners.map((owner) => (
                                <TableRow key={owner._id}>
                                    <TableCell className="font-medium">{owner.fullName}</TableCell>
                                    <TableCell>{owner.phoneNumber}</TableCell>
                                    <TableCell>
                                        <Badge className={statusBadge[owner.ownerStatus]}>
                                            {owner.ownerStatus}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate text-gray-500">
                                        {owner.bio ?? "-"}
                                    </TableCell>
                                    <TableCell className="space-x-2 text-right">
                                        {owner.ownerStatus !== "verified" && (
                                            <Button
                                                size="sm"
                                                disabled={busyId === owner._id}
                                                className="bg-green-600 text-white hover:bg-green-700"
                                                onClick={() => decide(owner._id, "verified")}
                                            >
                                                Verify
                                            </Button>
                                        )}
                                        {owner.ownerStatus !== "rejected" && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={busyId === owner._id}
                                                className="border-red-300 text-red-600 hover:bg-red-50"
                                                onClick={() => decide(owner._id, "rejected")}
                                            >
                                                Reject
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
