"use client";

// Damage reports on the owner's bikes (BC-04): owners acknowledge;
// administrators resolve disputes.
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, SearchCheck } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { TableActionsMenu } from "@/components/table-actions-menu";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, mediaUrl } from "@/lib/api";

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
    api
      .get<DamageReport[]>("/safety/damage-reports")
      .then((res) => setReports(res.data))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  const setStatus = async (reportId: string) => {
    try {
      await api.patch<DamageReport>(
        `/safety/damage-reports/${reportId}/status`,
        {
          status: "reviewed",
        },
      );
      toast.success("Damage report acknowledged", {
        description: "The renter can see that the owner reviewed the evidence.",
      });
      load();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not update the report.";
      setError(message);
      toast.error("Damage report was not updated", { description: message });
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Damage Reports</h1>
        <p className="text-sm text-muted-foreground">
          Acknowledge evidence from rentals of your bikes. Administrators
          resolve disputes.
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
                      <div
                        key={photo}
                        className="relative size-20 overflow-hidden rounded-lg border bg-muted"
                      >
                        <Image
                          fill
                          unoptimized
                          src={mediaUrl(photo)}
                          alt="Damage evidence"
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end">
                  <TableActionsMenu
                    label={`Actions for damage report ${report._id.slice(-6)}`}
                    actions={[
                      {
                        label: "View evidence",
                        icon: <ExternalLink aria-hidden="true" />,
                        disabled: report.photos.length === 0,
                        onSelect: () => {
                          const photo = report.photos[0];
                          if (photo) {
                            window.open(
                              mediaUrl(photo),
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }
                        },
                      },
                      {
                        label: "Mark reviewed",
                        icon: <SearchCheck aria-hidden="true" />,
                        disabled: report.status !== "open",
                        separatorBefore: true,
                        confirmation: {
                          title: "Acknowledge this damage report?",
                          description:
                            "This records that you reviewed the renter's description and attached evidence. Administrators still resolve disputes.",
                          confirmLabel: "Mark reviewed",
                        },
                        onSelect: () => setStatus(report._id),
                      },
                    ]}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
