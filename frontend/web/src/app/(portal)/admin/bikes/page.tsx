"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Eye, ShieldAlert } from "lucide-react";
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
  const router = useRouter();
  const [bikes, setBikes] = useState<BikeRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<BikeRow[]>("/bikes?limit=100&includeUnavailable=true")
      .then((res) => setBikes(res.data))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  const setStatus = async (bikeId: string, status: string) => {
    try {
      await api.patch<BikeRow>(`/admin/bikes/${bikeId}/status`, { status });
      toast.success(
        status === "inactive" ? "Bike suspended" : "Bike reactivated",
        {
          description:
            status === "inactive"
              ? "The listing is hidden from renter discovery."
              : "The listing is available to renters again.",
        },
      );
      load();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not update the bike.";
      setError(message);
      toast.error("Bike status was not changed", { description: message });
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bikes</h1>
        <p className="text-sm text-muted-foreground">
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
                  <TableCell className="text-right">
                    <TableActionsMenu
                      label={`Actions for ${bike.title}`}
                      actions={[
                        {
                          label: "View details",
                          icon: <Eye aria-hidden="true" />,
                          onSelect: () =>
                            router.push(`/admin/bikes/${bike._id}`),
                        },
                        bike.status !== "inactive"
                          ? {
                              label: "Suspend",
                              icon: <ShieldAlert aria-hidden="true" />,
                              destructive: true,
                              separatorBefore: true,
                              confirmation: {
                                title: `Suspend ${bike.title}?`,
                                description:
                                  "The bike will be hidden from renter discovery until an administrator reactivates it.",
                                confirmLabel: "Suspend bike",
                              },
                              onSelect: () => setStatus(bike._id, "inactive"),
                            }
                          : {
                              label: "Reactivate",
                              icon: <CircleCheck aria-hidden="true" />,
                              separatorBefore: true,
                              onSelect: () => setStatus(bike._id, "available"),
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
