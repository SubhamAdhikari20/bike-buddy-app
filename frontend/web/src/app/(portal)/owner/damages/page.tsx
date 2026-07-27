"use client";

// Damage reports on the owner's bikes (BC-04): owners acknowledge;
// administrators resolve disputes.
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
        api.get<DamageReport[]>("/safety/damage-reports")
            .then((res) => setReports(res.data))
            .catch((err) => setError(err.message));
    }, []);

    useEffect(load, [load]);

    const setStatus = async (reportId: string) => {
        try {
            await api.patch<DamageReport>(`/safety/damage-reports/${reportId}/status`, {
                status: "reviewed",
            });
            load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Damage Reports</h1>
                <p className="text-sm text-muted-foreground">
                    Acknowledge evidence from rentals of your bikes. Administrators resolve disputes.
                </p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}

            {reports.length === 0 ? (
                <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
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
                                <p className="text-sm">{report.description}</p>
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
                                            onClick={() => setStatus(report._id)}
                                        >
                                            Mark reviewed
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
