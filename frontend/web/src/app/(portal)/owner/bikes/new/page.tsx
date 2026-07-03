"use client";

// List a new bike. Clear sections, sensible defaults and inline errors
// (H5 - error prevention), matching the Add Bike prototype flow.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, session } from "@/lib/api";

const CATEGORIES = ["commuter", "scooter", "cruiser", "sports", "electric", "mountain"];
const CITIES = ["Kathmandu", "Lalitpur", "Bhaktapur"];

export default function NewBikePage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [form, setForm] = useState({
        title: "",
        brand: "",
        model: "",
        year: new Date().getFullYear(),
        engineCc: 125,
        fuelType: "petrol",
        transmission: "manual",
        condition: "good",
        category: "commuter",
        description: "",
        pricePerDay: 1000,
        pricePerHour: 150,
        securityDeposit: 1000,
        label: "",
        address: "",
        city: "Kathmandu",
        landmark: "",
        imageUrl: "",
        helmetIncluded: true,
    });

    const set = (key: string, value: unknown) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            await api.post("/bikes", {
                ownerId: session.get()?.profileId,
                title: form.title,
                brand: form.brand,
                model: form.model,
                year: Number(form.year),
                engineCc: Number(form.engineCc),
                fuelType: form.fuelType,
                transmission: form.transmission,
                condition: form.condition,
                category: form.category,
                description: form.description || undefined,
                pricePerDay: Number(form.pricePerDay),
                pricePerHour: Number(form.pricePerHour) || undefined,
                securityDeposit: Number(form.securityDeposit) || 0,
                location: {
                    label: form.label,
                    address: form.address,
                    city: form.city,
                    landmark: form.landmark || undefined,
                },
                images: form.imageUrl ? [{ url: form.imageUrl }] : [],
                specs: { helmetIncluded: form.helmetIncluded },
            });
            router.push("/owner/bikes");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save the bike");
        } finally {
            setBusy(false);
        }
    };

    const selectClass =
        "h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm";

    return (
        <div className="max-w-3xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">List a New Bike</h1>
                <p className="text-sm text-gray-500">
                    Honest details rent faster - riders see everything you enter here.
                </p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}

            <form onSubmit={onSubmit} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>1. The bike</CardTitle>
                        <CardDescription>What are you renting out?</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1 sm:col-span-2">
                            <Label>Listing title</Label>
                            <Input required placeholder="e.g. Pulsar 220F - well maintained" value={form.title} onChange={(e) => set("title", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Brand</Label>
                            <Input required placeholder="Bajaj" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Model</Label>
                            <Input required placeholder="Pulsar 220F" value={form.model} onChange={(e) => set("model", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Year</Label>
                            <Input required type="number" min={1990} max={new Date().getFullYear() + 1} value={form.year} onChange={(e) => set("year", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Engine (cc)</Label>
                            <Input required type="number" min={50} max={2500} value={form.engineCc} onChange={(e) => set("engineCc", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Category</Label>
                            <select className={selectClass} value={form.category} onChange={(e) => set("category", e.target.value)}>
                                {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label>Fuel</Label>
                            <select className={selectClass} value={form.fuelType} onChange={(e) => set("fuelType", e.target.value)}>
                                <option value="petrol">Petrol</option>
                                <option value="electric">Electric</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label>Transmission</Label>
                            <select className={selectClass} value={form.transmission} onChange={(e) => set("transmission", e.target.value)}>
                                <option value="manual">Manual</option>
                                <option value="automatic">Automatic</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label>Condition</Label>
                            <select className={selectClass} value={form.condition} onChange={(e) => set("condition", e.target.value)}>
                                <option value="excellent">Excellent</option>
                                <option value="good">Good</option>
                                <option value="fair">Fair</option>
                            </select>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                            <Label>Description</Label>
                            <Textarea rows={3} placeholder="Service history, quirks, what's included..." value={form.description} onChange={(e) => set("description", e.target.value)} />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                            <Label>Photo URL</Label>
                            <Input placeholder="https://..." value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={form.helmetIncluded} onChange={(e) => set("helmetIncluded", e.target.checked)} />
                            Helmet included
                        </label>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>2. Pricing</CardTitle>
                        <CardDescription>
                            Shown to riders exactly as entered - no hidden fees.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="space-y-1">
                            <Label>Per day (NPR)</Label>
                            <Input required type="number" min={100} value={form.pricePerDay} onChange={(e) => set("pricePerDay", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Per hour (NPR)</Label>
                            <Input type="number" min={0} value={form.pricePerHour} onChange={(e) => set("pricePerHour", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Refundable deposit (NPR)</Label>
                            <Input type="number" min={0} value={form.securityDeposit} onChange={(e) => set("securityDeposit", e.target.value)} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>3. Pickup point</CardTitle>
                        <CardDescription>
                            A clear landmark helps riders who don&apos;t read maps well.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label>Point name</Label>
                            <Input required placeholder="Thamel Hub" value={form.label} onChange={(e) => set("label", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>City</Label>
                            <select className={selectClass} value={form.city} onChange={(e) => set("city", e.target.value)}>
                                {CITIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                            <Label>Street address</Label>
                            <Input required placeholder="Thamel Marg" value={form.address} onChange={(e) => set("address", e.target.value)} />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                            <Label>Nearest landmark</Label>
                            <Input placeholder="Near Kathmandu Guest House" value={form.landmark} onChange={(e) => set("landmark", e.target.value)} />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex gap-3">
                    <Button type="submit" disabled={busy} className="bg-amber-500 text-white hover:bg-amber-600">
                        {busy ? "Saving..." : "Publish Listing"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => router.back()}>
                        Cancel
                    </Button>
                </div>
            </form>
        </div>
    );
}
