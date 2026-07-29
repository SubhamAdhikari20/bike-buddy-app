"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

type BikeDetails = {
  _id: string;
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
  status: string;
  location: {
    label: string;
    address: string;
    city: string;
    area?: string | null;
    landmark?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  images: Array<{ url: string; alt?: string | null }>;
  specs?: {
    weightKg?: number | null;
    mileageKmPerL?: number | null;
    helmetIncluded?: boolean | null;
  };
};

const CATEGORIES = ["commuter", "scooter", "cruiser", "sports", "electric", "mountain"];
const CONDITIONS = ["excellent", "good", "fair", "needs_service"];
const STATUSES = ["available", "unavailable", "maintenance", "inactive"];
const CITIES = ["Kathmandu", "Lalitpur", "Bhaktapur"];

export default function EditBikePage() {
  const params = useParams<{ bikeId: string }>();
  const router = useRouter();
  const [bike, setBike] = useState<BikeDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<BikeDetails>(`/bikes/${params.bikeId}`)
      .then((response) => setBike(response.data))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load this bike."));
  }, [params.bikeId]);

  const set = (key: keyof BikeDetails, value: unknown) => {
    setBike((current) => current ? { ...current, [key]: value } : current);
  };

  const setLocation = (key: keyof BikeDetails["location"], value: string) => {
    setBike((current) => current
      ? { ...current, location: { ...current.location, [key]: value } }
      : current);
  };

  const setPrimaryImage = (url: string) => {
    setBike((current) => {
      if (!current) return current;
      const remainingImages = current.images.slice(1);
      return {
        ...current,
        images: url
          ? [{ url, alt: current.images[0]?.alt ?? current.title }, ...remainingImages]
          : remainingImages,
      };
    });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bike) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch<BikeDetails>(`/bikes/${bike._id}`, {
        title: bike.title,
        brand: bike.brand,
        model: bike.model,
        year: Number(bike.year),
        engineCc: Number(bike.engineCc),
        fuelType: bike.fuelType,
        transmission: bike.transmission,
        condition: bike.condition,
        category: bike.category,
        description: bike.description?.trim() || null,
        pricePerDay: Number(bike.pricePerDay),
        pricePerHour: bike.pricePerHour ? Number(bike.pricePerHour) : null,
        securityDeposit: Number(bike.securityDeposit ?? 0),
        status: bike.status,
        location: {
          label: bike.location.label,
          address: bike.location.address,
          city: bike.location.city,
          area: bike.location.area || undefined,
          landmark: bike.location.landmark || undefined,
          ...(typeof bike.location.latitude === "number"
            ? { latitude: bike.location.latitude }
            : {}),
          ...(typeof bike.location.longitude === "number"
            ? { longitude: bike.location.longitude }
            : {}),
        },
        images: bike.images.map((image) => ({
          url: image.url,
          ...(image.alt ? { alt: image.alt } : {}),
        })),
        specs: {
          ...(typeof bike.specs?.weightKg === "number"
            ? { weightKg: bike.specs.weightKg }
            : {}),
          ...(typeof bike.specs?.mileageKmPerL === "number"
            ? { mileageKmPerL: bike.specs.mileageKmPerL }
            : {}),
          helmetIncluded: bike.specs?.helmetIncluded ?? false,
        },
      });
      router.push("/owner/bikes");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the bike.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!bike) return;
    const confirmed = window.confirm(
      `Delete "${bike.title}" permanently? Bikes with booking history must be made inactive instead.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete<BikeDetails>(`/bikes/${bike._id}`);
      router.push("/owner/bikes");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the bike.");
      setBusy(false);
    }
  };

  if (error && !bike) {
    return (
      <div className="space-y-4">
        <p className="text-red-600" role="alert">{error}</p>
        <Link href="/owner/bikes"><Button variant="outline">Back to bikes</Button></Link>
      </div>
    );
  }

  if (!bike) {
    return <p className="text-sm text-muted-foreground" role="status">Loading bike details...</p>;
  }

  const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/owner/bikes" className="mb-2 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to my bikes
          </Link>
          <h1 className="text-2xl font-bold">Edit Bike</h1>
          <p className="text-sm text-muted-foreground">Update the details renters use to make their decision.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          className="border-red-300 text-red-700 hover:bg-red-50"
          onClick={remove}
        >
          <Trash2 aria-hidden="true" />
          Delete listing
        </Button>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

      <form onSubmit={save} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Bike details</CardTitle>
            <CardDescription>Keep specifications and condition accurate.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="title">Listing title</Label>
              <Input id="title" required minLength={3} value={bike.title} onChange={(event) => set("title", event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="brand">Brand</Label>
              <Input id="brand" required value={bike.brand} onChange={(event) => set("brand", event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="model">Model</Label>
              <Input id="model" required value={bike.model} onChange={(event) => set("model", event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="year">Year</Label>
              <Input id="year" required type="number" min={1950} max={new Date().getFullYear() + 1} value={bike.year} onChange={(event) => set("year", event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="engine">Engine (cc)</Label>
              <Input id="engine" required type="number" min={50} max={2500} value={bike.engineCc} onChange={(event) => set("engineCc", event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="category">Category</Label>
              <select id="category" className={selectClass} value={bike.category} onChange={(event) => set("category", event.target.value)}>
                {CATEGORIES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="condition">Condition</Label>
              <select id="condition" className={selectClass} value={bike.condition} onChange={(event) => set("condition", event.target.value)}>
                {CONDITIONS.map((value) => <option key={value}>{value.replace("_", " ")}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="fuel">Fuel</Label>
              <select id="fuel" className={selectClass} value={bike.fuelType} onChange={(event) => set("fuelType", event.target.value)}>
                {["petrol", "diesel", "electric", "hybrid"].map((value) => <option key={value}>{value}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="transmission">Transmission</Label>
              <select id="transmission" className={selectClass} value={bike.transmission} onChange={(event) => set("transmission", event.target.value)}>
                <option value="manual">manual</option>
                <option value="automatic">automatic</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="status">Listing status</Label>
              <select id="status" className={selectClass} value={bike.status} onChange={(event) => set("status", event.target.value)}>
                {STATUSES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                checked={bike.specs?.helmetIncluded ?? false}
                onChange={(event) => set("specs", { ...bike.specs, helmetIncluded: event.target.checked })}
              />
              Helmet included
            </label>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={4} maxLength={4000} value={bike.description ?? ""} onChange={(event) => set("description", event.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="image">Primary photo URL</Label>
              <Input
                id="image"
                type="url"
                value={bike.images[0]?.url ?? ""}
                onChange={(event) => setPrimaryImage(event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Price and pickup</CardTitle>
            <CardDescription>These values appear in search, quotes and booking details.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="daily">Per day (NPR)</Label>
              <Input id="daily" required type="number" min={1} value={bike.pricePerDay} onChange={(event) => set("pricePerDay", event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hourly">Per hour (NPR)</Label>
              <Input id="hourly" type="number" min={0} value={bike.pricePerHour ?? ""} onChange={(event) => set("pricePerHour", event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="deposit">Deposit (NPR)</Label>
              <Input id="deposit" type="number" min={0} value={bike.securityDeposit ?? 0} onChange={(event) => set("securityDeposit", event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="point">Point name</Label>
              <Input id="point" required value={bike.location.label} onChange={(event) => setLocation("label", event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="city">City</Label>
              <select id="city" className={selectClass} value={bike.location.city} onChange={(event) => setLocation("city", event.target.value)}>
                {CITIES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="area">Area</Label>
              <Input id="area" value={bike.location.area ?? ""} onChange={(event) => setLocation("area", event.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="address">Street address</Label>
              <Input id="address" required value={bike.location.address} onChange={(event) => setLocation("address", event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="landmark">Landmark</Label>
              <Input id="landmark" value={bike.location.landmark ?? ""} onChange={(event) => setLocation("landmark", event.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy} className="bg-amber-500 text-slate-950 hover:bg-amber-400">
            <Save aria-hidden="true" />
            {busy ? "Saving..." : "Save changes"}
          </Button>
          <Link href="/owner/bikes"><Button type="button" variant="outline">Cancel</Button></Link>
        </div>
      </form>
    </div>
  );
}
