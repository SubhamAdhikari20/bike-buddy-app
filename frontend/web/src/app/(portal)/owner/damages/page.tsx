"use client";

// Damage reports on the owner's bikes (BC-04): review and resolve.
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

type DamageReport = {
    _id: string;
    description: string;
    photos: string[];
    status: "open" | "reviewed" | "resolved";
    createdAt: string;
};

const statusBadge: Record<string, string> = {
    open: "bg-red-100 text-red-700",
    reviewed: "bg-amber-100 text-amber-700",
    resolved: "bg-green-100 text-green-700",
};

export default function OwnerDamagesPage() {
    const [reports, setReports] = useState<DamageReport[]>([]);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        api.get("/safety/damage-reports/mine")
            .then((res) => setReports(res.data))
            .catch((err) => setError(err.message));
    }, []);

    useEffect(load, [load]);

    const setStatus = async (reportId: string, status: string) => {
        try {
            await api.patch(`/safety/damage-reports/${reportId}/status`, { status });
            load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Damage Reports</h1>
                <p className="text-sm text-gray-500">
                    Reports are acknowledged within 24 hours - riders can see the status.
                </p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}

            {reports.length === 0 ? (
                <Card>
                    <CardContent className="py-10 text-center text-gray-500">
                        No damage reports. Long may it last!
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {reports.map((report) => (
                        <Card key={report._id}>
                            <CardHeader className="flex flex-row items-start justify-between space-y-0">
                                <div>
                                    <CardTitle className="text-base">
                                        Report #{report._id.slice(-6).toUpperCase()}
                                    </CardTitle>
                                    <CardDescription>
                                        {new Date(report.createdAt).toLocaleDateString("en-GB", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                        })}
                                    </CardDescription>
                                </div>
                                <Badge className={statusBadge[report.status]}>
                                    {report.status}
                                </Badge>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm text-gray-700">{report.description}</p>
                                {report.photos.length > 0 && (
                                    <div className="flex gap-2">
                                        {report.photos.map((photo) => (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                key={photo}
                                                src={photo}
                                                alt="Damage evidence"
                                                className="h-20 w-20 rounded-lg object-cover"
                                            />
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    {report.status === "open" && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setStatus(report._id, "reviewed")}
                                        >
                                            Mark reviewed
                                        </Button>
                                    )}
                                    {report.status !== "resolved" && (
                                        <Button
                                            size="sm"
                                            className="bg-green-600 text-white hover:bg-green-700"
                                            onClick={() => setStatus(report._id, "resolved")}
                                        >
                                            Resolve
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
