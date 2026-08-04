"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bike,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ImageOff,
  MapPin,
  Pencil,
  ShieldCheck,
  Star,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, mediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

type PortalRole = "admin" | "owner";

type BikeImage = {
  url: string;
  alt?: string | null;
};

type BikeDetails = {
  _id: string;
  ownerId?:
    | string
    | {
        _id?: string;
        fullName?: string;
        ownerStatus?: string;
      };
  title: string;
  brand: string;
  model: string;
  year: number;
  engineCc: number;
  fuelType: string;
  transmission: string;
  condition: string;
  category: string;
  description?: string | null;
  pricePerDay: number;
  pricePerHour?: number | null;
  securityDeposit?: number | null;
  serviceFee?: number | null;
  location: {
    label: string;
    address: string;
    city: string;
    area?: string | null;
    landmark?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  images: BikeImage[];
  specs?: {
    weightKg?: number | null;
    mileageKmPerL?: number | null;
    helmetIncluded?: boolean | null;
  } | null;
  conditionInfo?: {
    serviceDate?: string | null;
    odometerKm?: number | null;
    photos?: Array<{ url: string; takenAt?: string | null }>;
  } | null;
  status: "available" | "unavailable" | "maintenance" | "inactive";
  verifiedBike: boolean;
  safetyScore: number;
  inspectionNotes?: string | null;
  tags?: string[];
  averageRating: number;
  ratingCount: number;
  createdAt?: string;
  updatedAt?: string;
};

type ManagementSummary = {
  bike: BikeDetails;
  metrics: {
    activeBookings: number;
    completedBookings: number;
    paidRevenue: number;
    publicReviewCount: number;
    averageRating: number;
    openDamageReports: number;
  };
};

type BookingRow = {
  _id: string;
  startDate: string;
  endDate: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "rejected";
  paymentStatus: "unpaid" | "pending" | "paid" | "failed" | "refunded";
  paymentMethod?: "wallet" | "cash" | null;
  totalAmount: number;
  currency?: string;
  returnedAt?: string | null;
  createdAt?: string;
};

type ReviewRow = {
  _id: string;
  rating: number;
  comment: string;
  isVerifiedRide: boolean;
  createdAt: string;
};

type DamageReport = {
  _id: string;
  bookingId?: string | { _id?: string };
  photos: string[];
  description: string;
  status: "open" | "reviewed" | "resolved";
  resolvedAt?: string | null;
  createdAt: string;
};

const bikeStatusClasses: Record<BikeDetails["status"], string> = {
  available:
    "border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200",
  unavailable:
    "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  maintenance:
    "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
  inactive:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
};

const bookingStatusClasses: Record<BookingRow["status"], string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  confirmed:
    "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  rejected: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200",
};

const damageStatusClasses: Record<DamageReport["status"], string> = {
  open: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  reviewed: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
};

const pretty = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const money = (value: number, currency = "NPR") =>
  `${currency} ${Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;

const formatDate = (value?: string | null, includeTime = false) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
  });
};

const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";

const bookingReference = (id: string) => `#${id.slice(-6).toUpperCase()}`;

type LoadedManagementDetails = {
  summary: ManagementSummary;
  bookings: BookingRow[];
  reviews: ReviewRow[];
  damageReports: DamageReport[];
};

const fetchManagementDetails = async (
  bikeId: string,
): Promise<LoadedManagementDetails> => {
  const encodedBikeId = encodeURIComponent(bikeId);
  const [summaryResponse, bookingsResponse, reviewsResponse, damagesResponse] =
    await Promise.all([
      api.get<ManagementSummary>(`/bikes/${encodedBikeId}/management-summary`),
      api.get<BookingRow[]>(`/bookings?bikeId=${encodedBikeId}&limit=100`),
      api.get<ReviewRow[]>(`/reviews/bike/${encodedBikeId}?limit=100`),
      api.get<DamageReport[]>(
        `/safety/damage-reports?bikeId=${encodedBikeId}&limit=100`,
      ),
    ]);

  return {
    summary: summaryResponse.data,
    bookings: bookingsResponse.data ?? [],
    reviews: reviewsResponse.data ?? [],
    damageReports: damagesResponse.data ?? [],
  };
};

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/20 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <span className="rounded-lg bg-blue-50 p-2 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words font-semibold">{value}</p>
      </div>
    </div>
  );
}

function BikeGallery({ bike }: { bike: BikeDetails }) {
  const [selected, setSelected] = useState(0);
  const images = bike.images ?? [];
  const current = images[selected] ?? images[0];

  if (!current) {
    return (
      <div className="flex aspect-[16/10] min-h-64 flex-col items-center justify-center rounded-xl border bg-muted/40 text-muted-foreground">
        <ImageOff className="mb-3 size-10" aria-hidden="true" />
        <p className="font-medium">No listing photos</p>
        <p className="text-sm">The owner has not uploaded a bike photo yet.</p>
      </div>
    );
  }

  const move = (direction: -1 | 1) => {
    setSelected((index) => (index + direction + images.length) % images.length);
  };

  return (
    <div className="space-y-3" aria-label={`${bike.title} photo gallery`}>
      <div className="relative overflow-hidden rounded-xl border bg-muted">
        {/* Listing media can be hosted by the API or an approved demo image host. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl(current.url)}
          alt={current.alt || `${bike.title}, photo ${selected + 1}`}
          className="aspect-[16/10] min-h-64 w-full object-cover"
        />
        <p className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
          {selected + 1} / {images.length}
        </p>
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow transition-colors hover:bg-background"
              aria-label="Show previous bike photo"
              onClick={() => move(-1)}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow transition-colors hover:bg-background"
              aria-label="Show next bike photo"
              onClick={() => move(1)}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="list"
          aria-label="Bike photos"
        >
          {images.map((image, index) => (
            <div role="listitem" key={`${image.url}-${index}`}>
              <button
                type="button"
                aria-label={`Show bike photo ${index + 1}`}
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
                className={cn(
                  "shrink-0 overflow-hidden rounded-lg border-2 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected === index ? "border-blue-600" : "border-transparent",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrl(image.url)}
                  alt=""
                  className="h-20 w-28 object-cover"
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Rating({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${safeValue} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(
            "size-4",
            index < Math.round(safeValue)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/40",
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function BikeManagementDetails({
  bikeId,
  role,
}: {
  bikeId: string;
  role: PortalRole;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState<ManagementSummary | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [damageReports, setDamageReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const details = await fetchManagementDetails(bikeId);
      setSummary(details.summary);
      setBookings(details.bookings);
      setReviews(details.reviews);
      setDamageReports(details.damageReports);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [bikeId]);

  useEffect(() => {
    let active = true;

    void fetchManagementDetails(bikeId)
      .then((details) => {
        if (!active) return;
        setSummary(details.summary);
        setBookings(details.bookings);
        setReviews(details.reviews);
        setDamageReports(details.damageReports);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bikeId]);

  const changeBikeStatus = async (status: BikeDetails["status"]) => {
    try {
      const route =
        role === "admin"
          ? `/admin/bikes/${encodeURIComponent(bikeId)}/status`
          : `/bikes/${encodeURIComponent(bikeId)}`;
      await api.patch<BikeDetails>(route, { status });
      toast.success(`Bike marked ${pretty(status)}`, {
        description: "The management summary is now up to date.",
      });
      await load();
    } catch (caught) {
      toast.error("Bike status was not changed", {
        description: errorMessage(caught),
      });
      throw caught;
    }
  };

  const deleteBike = async () => {
    try {
      await api.delete<BikeDetails>(`/bikes/${encodeURIComponent(bikeId)}`);
      toast.success("Bike deleted", {
        description: "The listing had no booking history and was removed.",
      });
      router.push("/owner/bikes");
      router.refresh();
    } catch (caught) {
      toast.error("Bike could not be deleted", {
        description: errorMessage(caught),
      });
      throw caught;
    }
  };

  const updateDamageStatus = async (
    report: DamageReport,
    status: "reviewed" | "resolved",
  ) => {
    try {
      await api.patch<DamageReport>(
        `/safety/damage-reports/${encodeURIComponent(report._id)}/status`,
        { status },
      );
      toast.success(
        status === "reviewed"
          ? "Damage report acknowledged"
          : "Damage report resolved",
        {
          description:
            status === "reviewed"
              ? "An administrator can now complete the dispute review."
              : "The report is closed and remains in the audit history.",
        },
      );
      await load();
    } catch (caught) {
      toast.error("Damage report was not updated", {
        description: errorMessage(caught),
      });
      throw caught;
    }
  };

  if (loading) return <LoadingState label="Loading bike management details…" />;
  if (error || !summary) {
    return (
      <div className="space-y-4">
        <Link
          href={`/${role}/bikes`}
          className={buttonVariants({ variant: "ghost" })}
        >
          <ArrowLeft aria-hidden="true" />
          Back to bikes
        </Link>
        <ErrorState
          message={error ?? "This bike could not be found."}
          retry={() => {
            setLoading(true);
            void load();
          }}
        />
      </div>
    );
  }

  const { bike, metrics } = summary;
  const nextStatus: BikeDetails["status"] =
    bike.status === "available" ? "maintenance" : "available";
  const ownerName =
    typeof bike.ownerId === "object" ? bike.ownerId.fullName : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link
          href={`/${role}/bikes`}
          className={cn(buttonVariants({ variant: "ghost" }), "-ml-2")}
        >
          <ArrowLeft aria-hidden="true" />
          Back to {role === "owner" ? "my bikes" : "all bikes"}
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={bikeStatusClasses[bike.status]}>
                {pretty(bike.status)}
              </Badge>
              {bike.verifiedBike ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200">
                  <ShieldCheck aria-hidden="true" />
                  Bike verified
                </Badge>
              ) : (
                <Badge variant="outline">Verification pending</Badge>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              {bike.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {bike.brand} {bike.model} · {bike.year} · {pretty(bike.category)}
            </p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Listing #{bike._id.slice(-8).toUpperCase()}
          </p>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <BikeGallery bike={bike} />

          <Tabs defaultValue="overview" className="min-w-0">
            <div
              className="overflow-x-auto pb-1"
              aria-label="Bike detail sections"
            >
              <TabsList
                className="h-auto min-h-11 min-w-max"
                aria-label="Bike details"
              >
                <TabsTrigger value="overview" className="min-h-10 px-3">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="bookings" className="min-h-10 px-3">
                  Bookings
                  <Badge variant="secondary">{bookings.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="reviews" className="min-h-10 px-3">
                  Reviews
                  <Badge variant="secondary">{reviews.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="damage" className="min-h-10 px-3">
                  Damage reports
                  <Badge variant="secondary">{damageReports.length}</Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-4 pt-3">
              <Card>
                <CardHeader>
                  <CardTitle>Listing overview</CardTitle>
                  <CardDescription>
                    Rental information shown to renters and used during booking.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="leading-6 text-muted-foreground">
                    {bike.description?.trim() ||
                      "No listing description has been added."}
                  </p>
                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailItem label="Brand" value={bike.brand} />
                    <DetailItem label="Model" value={bike.model} />
                    <DetailItem label="Year" value={bike.year} />
                    <DetailItem label="Engine" value={`${bike.engineCc} cc`} />
                    <DetailItem label="Fuel" value={pretty(bike.fuelType)} />
                    <DetailItem
                      label="Transmission"
                      value={pretty(bike.transmission)}
                    />
                    <DetailItem
                      label="Category"
                      value={pretty(bike.category)}
                    />
                    <DetailItem
                      label="Condition"
                      value={pretty(bike.condition)}
                    />
                    <DetailItem
                      label="Helmet"
                      value={
                        bike.specs?.helmetIncluded ? "Included" : "Not included"
                      }
                    />
                    <DetailItem
                      label="Mileage"
                      value={
                        bike.specs?.mileageKmPerL
                          ? `${bike.specs.mileageKmPerL} km/L`
                          : "Not recorded"
                      }
                    />
                    <DetailItem
                      label="Weight"
                      value={
                        bike.specs?.weightKg
                          ? `${bike.specs.weightKg} kg`
                          : "Not recorded"
                      }
                    />
                    <DetailItem
                      label="Odometer"
                      value={
                        bike.conditionInfo?.odometerKm != null
                          ? `${bike.conditionInfo.odometerKm.toLocaleString("en-US")} km`
                          : "Not recorded"
                      }
                    />
                  </dl>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Pickup location</CardTitle>
                    <CardDescription>
                      Listing location, not renter location data.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin
                        className="mt-0.5 size-5 text-blue-700"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-medium">{bike.location.label}</p>
                        <p className="text-muted-foreground">
                          {bike.location.address}, {bike.location.city}
                        </p>
                        {(bike.location.area || bike.location.landmark) && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {[bike.location.area, bike.location.landmark]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Condition and inspection</CardTitle>
                    <CardDescription>
                      Latest recorded maintenance context.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <DetailItem
                        label="Last service"
                        value={formatDate(bike.conditionInfo?.serviceDate)}
                      />
                      <DetailItem
                        label="Safety score"
                        value={`${bike.safetyScore ?? 0}/100`}
                      />
                    </dl>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Inspection notes
                      </p>
                      <p className="mt-1 leading-6">
                        {bike.inspectionNotes?.trim() ||
                          "No inspection note recorded."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="bookings" className="pt-3">
              <Card>
                <CardHeader>
                  <CardTitle>Booking history</CardTitle>
                  <CardDescription>
                    Rental status and payment state. Renter personal details are
                    hidden.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {bookings.length === 0 ? (
                    <EmptyState
                      title="No bookings yet"
                      description="Bookings for this bike will appear here without exposing renter personal information."
                    />
                  ) : (
                    <>
                      <div className="space-y-3 md:hidden">
                        {bookings.map((booking) => (
                          <article
                            key={booking._id}
                            className="space-y-3 rounded-lg border p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-mono text-xs text-muted-foreground">
                                  {bookingReference(booking._id)}
                                </p>
                                <p className="mt-1 font-medium">
                                  Verified renter
                                </p>
                              </div>
                              <Badge
                                className={bookingStatusClasses[booking.status]}
                              >
                                {pretty(booking.status)}
                              </Badge>
                            </div>
                            <dl className="grid grid-cols-2 gap-3 text-sm">
                              <DetailItem
                                label="Starts"
                                value={formatDate(booking.startDate, true)}
                              />
                              <DetailItem
                                label="Ends"
                                value={formatDate(booking.endDate, true)}
                              />
                              <DetailItem
                                label="Total"
                                value={money(
                                  booking.totalAmount,
                                  booking.currency,
                                )}
                              />
                              <DetailItem
                                label="Payment"
                                value={pretty(booking.paymentStatus)}
                              />
                            </dl>
                          </article>
                        ))}
                      </div>
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Reference</TableHead>
                              <TableHead>Renter</TableHead>
                              <TableHead>Dates</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Payment</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bookings.map((booking) => (
                              <TableRow key={booking._id}>
                                <TableCell className="font-mono text-xs">
                                  {bookingReference(booking._id)}
                                </TableCell>
                                <TableCell>
                                  <span className="inline-flex items-center gap-1.5">
                                    <ShieldCheck
                                      className="size-4 text-green-700"
                                      aria-hidden="true"
                                    />
                                    Verified renter
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className="block">
                                    {formatDate(booking.startDate, true)}
                                  </span>
                                  <span className="block text-xs text-muted-foreground">
                                    to {formatDate(booking.endDate, true)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {money(booking.totalAmount, booking.currency)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      bookingStatusClasses[booking.status]
                                    }
                                  >
                                    {pretty(booking.status)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="capitalize">
                                  {pretty(booking.paymentStatus)}
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
            </TabsContent>

            <TabsContent value="reviews" className="pt-3">
              <Card>
                <CardHeader>
                  <CardTitle>Public renter reviews</CardTitle>
                  <CardDescription>
                    Feedback from completed rides. Reviewer identity is
                    intentionally private.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reviews.length === 0 ? (
                    <EmptyState
                      title="No public reviews"
                      description="A verified renter can review this bike after a completed booking."
                    />
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {reviews.map((review) => (
                        <article
                          key={review._id}
                          className="rounded-lg border p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="flex items-center gap-1.5 font-medium">
                                <ShieldCheck
                                  className="size-4 text-green-700"
                                  aria-hidden="true"
                                />
                                Verified renter
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatDate(review.createdAt)}
                              </p>
                            </div>
                            <Rating value={review.rating} />
                          </div>
                          <p className="mt-4 whitespace-pre-wrap leading-6 text-muted-foreground">
                            {review.comment}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="damage" className="pt-3">
              <Card>
                <CardHeader>
                  <CardTitle>Damage report history</CardTitle>
                  <CardDescription>
                    Timestamped renter evidence and review status for this bike.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {damageReports.length === 0 ? (
                    <EmptyState
                      title="No damage reports"
                      description="There is no submitted damage evidence for this bike."
                    />
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {damageReports.map((report) => {
                        const reportBookingId =
                          typeof report.bookingId === "string"
                            ? report.bookingId
                            : report.bookingId?._id;
                        const canAct =
                          (role === "owner" && report.status === "open") ||
                          (role === "admin" && report.status !== "resolved");
                        const nextReportStatus =
                          role === "owner" ? "reviewed" : "resolved";

                        return (
                          <article
                            key={report._id}
                            className="space-y-4 rounded-lg border p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-medium">
                                  Report #{report._id.slice(-6).toUpperCase()}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {formatDate(report.createdAt, true)}
                                  {reportBookingId
                                    ? ` · Booking ${bookingReference(reportBookingId)}`
                                    : ""}
                                </p>
                              </div>
                              <Badge
                                className={damageStatusClasses[report.status]}
                              >
                                {pretty(report.status)}
                              </Badge>
                            </div>
                            <p className="whitespace-pre-wrap leading-6 text-muted-foreground">
                              {report.description}
                            </p>
                            {report.photos.length > 0 && (
                              <div
                                className="flex gap-2 overflow-x-auto pb-1"
                                aria-label="Damage evidence photos"
                              >
                                {report.photos.map((photo, index) => (
                                  <a
                                    key={`${photo}-${index}`}
                                    href={mediaUrl(photo)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="shrink-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                                    aria-label={`Open damage evidence photo ${index + 1}`}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={mediaUrl(photo)}
                                      alt={`Damage evidence ${index + 1}`}
                                      className="h-24 w-32 rounded-lg border object-cover"
                                    />
                                  </a>
                                ))}
                              </div>
                            )}
                            {canAct && (
                              <ConfirmActionDialog
                                triggerLabel={
                                  role === "owner"
                                    ? "Acknowledge report"
                                    : "Resolve report"
                                }
                                triggerClassName="min-h-10"
                                confirmVariant={
                                  role === "owner" ? "default" : "destructive"
                                }
                                title={
                                  role === "owner"
                                    ? "Acknowledge this damage report?"
                                    : "Resolve this damage report?"
                                }
                                description={
                                  role === "owner"
                                    ? "This confirms you reviewed the submitted evidence. An administrator remains responsible for resolving a dispute."
                                    : "This closes the report in the audit history. Review its evidence before continuing."
                                }
                                confirmLabel={
                                  role === "owner" ? "Acknowledge" : "Resolve"
                                }
                                onConfirm={() =>
                                  updateDamageStatus(report, nextReportStatus)
                                }
                              />
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside
          className="space-y-4 xl:sticky xl:top-24"
          aria-label="Bike summary and actions"
        >
          <Card>
            <CardHeader>
              <CardTitle>Management summary</CardTitle>
              <CardDescription>
                Live, role-safe listing indicators.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Metric
                icon={CircleDollarSign}
                label="Daily rate"
                value={money(bike.pricePerDay)}
              />
              <Metric
                icon={CalendarDays}
                label="Active bookings"
                value={metrics.activeBookings}
              />
              <Metric
                icon={CheckCircle2}
                label="Completed bookings"
                value={metrics.completedBookings}
              />
              <Metric
                icon={CircleDollarSign}
                label="Paid booking value"
                value={money(metrics.paidRevenue)}
              />
              <Metric
                icon={Star}
                label="Public rating"
                value={
                  metrics.publicReviewCount > 0
                    ? `${metrics.averageRating.toFixed(1)} / 5 (${metrics.publicReviewCount})`
                    : "No reviews"
                }
              />
              <Metric
                icon={Wrench}
                label="Open damage reports"
                value={metrics.openDamageReports}
              />
              {role === "admin" && ownerName && (
                <Metric icon={Bike} label="Listing owner" value={ownerName} />
              )}
              <Metric
                icon={Clock3}
                label="Last updated"
                value={formatDate(bike.updatedAt, true)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {role === "owner" ? "Listing actions" : "Safety controls"}
              </CardTitle>
              <CardDescription>
                {role === "owner"
                  ? "Keep availability and listing information accurate."
                  : "Suspend an unsafe listing or restore it after review."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {role === "owner" && (
                <Link
                  href={`/owner/bikes/${bike._id}/edit`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "min-h-10 w-full",
                  )}
                >
                  <Pencil aria-hidden="true" />
                  Edit listing
                </Link>
              )}
              <ConfirmActionDialog
                triggerLabel={
                  role === "admin"
                    ? bike.status === "inactive"
                      ? "Reactivate listing"
                      : "Suspend listing"
                    : bike.status === "available"
                      ? "Move to maintenance"
                      : "Make available"
                }
                triggerVariant={
                  role === "admin" && bike.status !== "inactive"
                    ? "destructive"
                    : "outline"
                }
                triggerClassName="min-h-10 w-full"
                confirmVariant={
                  role === "admin" && bike.status !== "inactive"
                    ? "destructive"
                    : "default"
                }
                title={
                  role === "admin"
                    ? bike.status === "inactive"
                      ? "Reactivate this listing?"
                      : "Suspend this listing?"
                    : nextStatus === "maintenance"
                      ? "Move this bike to maintenance?"
                      : "Make this bike available?"
                }
                description={
                  role === "admin" && bike.status !== "inactive"
                    ? "Renters will no longer see or book this bike. Existing history remains available for audit."
                    : nextStatus === "maintenance"
                      ? "Renters will not be able to start a new booking until you make it available again."
                      : "The bike will become visible to renters if the owner account is verified."
                }
                confirmLabel={
                  role === "admin"
                    ? bike.status === "inactive"
                      ? "Reactivate"
                      : "Suspend"
                    : nextStatus === "maintenance"
                      ? "Move to maintenance"
                      : "Make available"
                }
                onConfirm={() =>
                  changeBikeStatus(
                    role === "admin"
                      ? bike.status === "inactive"
                        ? "available"
                        : "inactive"
                      : nextStatus,
                  )
                }
              />
              {role === "owner" && (
                <ConfirmActionDialog
                  triggerLabel="Delete listing"
                  triggerVariant="destructive"
                  triggerClassName="min-h-10 w-full"
                  title="Delete this bike permanently?"
                  description="Deletion is allowed only when the bike has no booking history. Otherwise, mark it inactive so audit records stay intact."
                  confirmLabel="Delete listing"
                  onConfirm={deleteBike}
                />
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
