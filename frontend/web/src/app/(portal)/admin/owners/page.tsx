"use client";

// Verification Center (TR-01): approve or reject bike owners. The green
// verified badge in the app comes from this decision.
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
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
    api
      .get<Owner[]>("/admin/owners?limit=100")
      .then((res) => setOwners(res.data))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  const decide = async (ownerId: string, status: "verified" | "rejected") => {
    setBusyId(ownerId);
    try {
      await api.patch<Owner>(`/admin/owners/${ownerId}/verify`, { status });
      if (status === "verified") {
        toast.success("Owner account approved", {
          description:
            "The owner's available listings can now appear in renter discovery.",
        });
      } else {
        toast.warning("Owner account rejected", {
          description:
            "This owner's listings are now hidden from public discovery.",
        });
      }
      load();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save the decision.";
      setError(message);
      toast.error("Owner review was not saved", { description: message });
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Owner Verification</h1>
        <p className="text-sm text-muted-foreground">
          Approve owner accounts before their available bikes enter renter
          discovery.
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
                  <TableCell className="font-medium">
                    {owner.fullName}
                  </TableCell>
                  <TableCell>{owner.phoneNumber}</TableCell>
                  <TableCell>
                    <Badge className={statusBadge[owner.ownerStatus]}>
                      {owner.ownerStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {owner.bio ?? "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <TableActionsMenu
                      label={`Actions for ${owner.fullName}`}
                      actions={[
                        {
                          label: "Approve owner",
                          icon: <CheckCircle2 aria-hidden="true" />,
                          disabled:
                            owner.ownerStatus === "verified" ||
                            busyId === owner._id,
                          confirmation: {
                            title: `Approve ${owner.fullName}'s owner account?`,
                            description:
                              "This records administrator approval and makes the owner's available listings eligible for renter discovery.",
                            confirmLabel: "Approve owner",
                          },
                          onSelect: () => decide(owner._id, "verified"),
                        },
                        {
                          label: "Reject owner",
                          icon: <XCircle aria-hidden="true" />,
                          disabled:
                            owner.ownerStatus === "rejected" ||
                            busyId === owner._id,
                          destructive: true,
                          separatorBefore: true,
                          confirmation: {
                            title: `Reject ${owner.fullName}'s owner account?`,
                            description:
                              "The owner's bikes will be hidden from renter discovery until an administrator approves the account.",
                            confirmLabel: "Reject owner",
                          },
                          onSelect: () => decide(owner._id, "rejected"),
                        },
                      ]}
                    />
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
