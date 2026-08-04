"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  IdCard,
  Loader2,
  XCircle,
} from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, mediaUrl } from "@/lib/api";

type KycStatus = "unverified" | "pending" | "approved" | "rejected";

type KycRequest = {
  id: string;
  fullName: string;
  email?: string | null;
  phoneNumber?: string | null;
  idDocumentUrl?: string | null;
  kycStatus: KycStatus;
  kycSubmittedAt?: string | null;
};

const badgeClass: Record<KycStatus, string> = {
  unverified: "bg-slate-100 text-slate-700",
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function AdminKycPage() {
  const [status, setStatus] = useState<KycStatus>("pending");
  const [requests, setRequests] = useState<KycRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<KycRequest[]>(`/admin/renters/kyc?status=${status}&limit=100`)
      .then((response) => {
        if (active) setRequests(response.data);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load ID verification requests.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status]);

  const decide = async (
    request: KycRequest,
    nextStatus: "approved" | "rejected",
  ) => {
    try {
      await api.patch<KycRequest>(`/admin/renters/${request.id}/kyc`, {
        status: nextStatus,
      });
      if (nextStatus === "approved") {
        toast.success("Renter ID approved", {
          description: `${request.fullName} can now request bookings.`,
        });
      } else {
        toast.warning("Renter ID rejected", {
          description: `${request.fullName} must submit a new readable document.`,
        });
      }
      setRequests((current) =>
        current.filter((item) => item.id !== request.id),
      );
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Could not save the review.";
      toast.error("ID review was not saved", { description: message });
      throw caught;
    }
  };

  const actions = (request: KycRequest) => (
    <TableActionsMenu
      label={`Actions for ${request.fullName}'s verification`}
      actions={[
        {
          label: "View private ID",
          icon: <ExternalLink aria-hidden="true" />,
          disabled: !request.idDocumentUrl,
          onSelect: () => {
            if (request.idDocumentUrl) {
              window.open(
                mediaUrl(request.idDocumentUrl),
                "_blank",
                "noopener,noreferrer",
              );
            }
          },
        },
        {
          label: "Approve ID",
          icon: <CheckCircle2 aria-hidden="true" />,
          disabled: request.kycStatus !== "pending",
          separatorBefore: true,
          confirmation: {
            title: `Approve ${request.fullName}'s ID?`,
            description:
              "This immediately allows the renter to request a booking. Confirm that the document is readable and matches the profile.",
            confirmLabel: "Approve ID",
          },
          onSelect: () => decide(request, "approved"),
        },
        {
          label: "Reject ID",
          icon: <XCircle aria-hidden="true" />,
          disabled: request.kycStatus !== "pending",
          destructive: true,
          confirmation: {
            title: `Reject ${request.fullName}'s ID?`,
            description:
              "The renter will remain unable to book and must upload a clearer or valid document.",
            confirmLabel: "Reject ID",
          },
          onSelect: () => decide(request, "rejected"),
        },
      ]}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Renter ID verification</h1>
          <p className="text-sm text-muted-foreground">
            Review private documents before renters can request bookings.
          </p>
        </div>
        <label className="space-y-1 text-sm font-medium">
          <span className="block">Show status</span>
          <select
            value={status}
            onChange={(event) => {
              setLoading(true);
              setError(null);
              setStatus(event.target.value as KycStatus);
            }}
            className="h-9 min-w-44 rounded-lg border bg-background px-3"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="unverified">Not submitted</option>
          </select>
        </label>
      </div>

      {error && (
        <p
          className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IdCard className="size-5" aria-hidden="true" />
            {status[0].toUpperCase() + status.slice(1)} requests
          </CardTitle>
          <CardDescription>
            Documents are private and require an administrator session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading requests…
            </div>
          ) : requests.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No {status} verification requests.
            </p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {requests.map((request) => (
                  <article
                    key={request.id}
                    className="space-y-3 rounded-xl border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{request.fullName}</h2>
                        <p className="text-sm text-muted-foreground">
                          {request.email ??
                            request.phoneNumber ??
                            "No contact shown"}
                        </p>
                      </div>
                      <Badge className={badgeClass[request.kycStatus]}>
                        {request.kycStatus}
                      </Badge>
                    </div>
                    {request.idDocumentUrl ? (
                      <a
                        href={mediaUrl(request.idDocumentUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue-700 underline-offset-4 hover:underline"
                      >
                        View private ID <ExternalLink className="size-4" />
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No document uploaded.
                      </p>
                    )}
                    {actions(request)}
                  </article>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Renter</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <p className="font-medium">{request.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {request.email ?? request.phoneNumber ?? "—"}
                          </p>
                        </TableCell>
                        <TableCell>
                          {request.kycSubmittedAt
                            ? new Date(
                                request.kycSubmittedAt,
                              ).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={badgeClass[request.kycStatus]}>
                            {request.kycStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {request.idDocumentUrl ? (
                            <a
                              href={mediaUrl(request.idDocumentUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                            >
                              View ID <ExternalLink className="size-3.5" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {actions(request)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
