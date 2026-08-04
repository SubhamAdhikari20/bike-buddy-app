"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, Eye, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { TableActionsMenu } from "@/components/table-actions-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useSession } from "@/components/auth/session-provider";
import { api } from "@/lib/api";

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
  const router = useRouter();
  const { session } = useSession();
  const [bikes, setBikes] = useState<BikeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    const profileId = session?.profile.id;
    if (!profileId) return;
    api
      .get<BikeRow[]>(
        `/bikes?ownerId=${profileId}&limit=100&includeUnavailable=true`,
      )
      .then((res) => setBikes(res.data))
      .catch((err) => setError(err.message));
  }, [session?.profile.id]);

  useEffect(load, [load]);

  const setStatus = async (bikeId: string, status: string) => {
    setBusyId(bikeId);
    setError(null);
    try {
      await api.patch<BikeRow>(`/bikes/${bikeId}`, { status });
      toast.success(
        status === "maintenance"
          ? "Bike moved to maintenance"
          : "Bike is available",
        {
          description:
            status === "maintenance"
              ? "Renters cannot request this bike while it is being checked."
              : "Renters can discover and request this bike again.",
        },
      );
      load();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not update the bike.";
      setError(message);
      toast.error("Bike status was not changed", { description: message });
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  const removeBike = async (bike: BikeRow) => {
    setBusyId(bike._id);
    setError(null);
    try {
      await api.delete<BikeRow>(`/bikes/${bike._id}`);
      toast.success("Bike deleted", {
        description: `${bike.title} was removed from your fleet.`,
      });
      load();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not delete the bike.";
      setError(message);
      toast.error("Bike was not deleted", { description: message });
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Bikes</h1>
          <p className="text-sm text-muted-foreground">
            Your fleet and its status.
          </p>
        </div>
        <Link href="/owner/bikes/new">
          <Button className="bg-amber-500 text-white hover:bg-amber-600">
            <Plus aria-hidden="true" />
            List a new bike
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
              {bikes.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No bikes yet. List your first bike to begin.
                  </TableCell>
                </TableRow>
              )}
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
                  <TableCell className="text-right">
                    <TableActionsMenu
                      label={`Actions for ${bike.title}`}
                      actions={[
                        {
                          label: "View details",
                          icon: <Eye aria-hidden="true" />,
                          onSelect: () =>
                            router.push(`/owner/bikes/${bike._id}`),
                        },
                        {
                          label: "Edit",
                          icon: <Pencil aria-hidden="true" />,
                          onSelect: () =>
                            router.push(`/owner/bikes/${bike._id}/edit`),
                        },
                        bike.status === "available"
                          ? {
                              label: "Move to maintenance",
                              icon: <Wrench aria-hidden="true" />,
                              disabled: busyId === bike._id,
                              separatorBefore: true,
                              onSelect: () =>
                                setStatus(bike._id, "maintenance"),
                            }
                          : {
                              label: "Make available",
                              icon: <CircleCheck aria-hidden="true" />,
                              disabled: busyId === bike._id,
                              separatorBefore: true,
                              onSelect: () => setStatus(bike._id, "available"),
                            },
                        {
                          label: "Delete",
                          icon: <Trash2 aria-hidden="true" />,
                          disabled: busyId === bike._id,
                          destructive: true,
                          separatorBefore: true,
                          confirmation: {
                            title: `Delete ${bike.title}?`,
                            description:
                              "This permanently removes the bike and its photos from the listing. Bikes with booking history cannot be deleted.",
                            confirmLabel: "Delete bike",
                          },
                          onSelect: () => removeBike(bike),
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
