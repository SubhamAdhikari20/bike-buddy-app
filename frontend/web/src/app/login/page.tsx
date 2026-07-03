"use client";

// Portal sign-in for admins and owners. Renters use the mobile app.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, session } from "@/lib/api";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const res = await api.post("/auth/login", { email, password });
            const data = res.data;
            const role = data.user.role as "admin" | "owner" | "renter";
            if (role === "renter") {
                setError("Renters use the Bike Buddy mobile app. This portal is for owners and admins.");
                return;
            }
            session.save({
                token: data.token,
                role,
                email: data.user.email,
                fullName: data.profile?.fullName ?? "",
                profileId: data.profile?._id,
            });
            router.push(role === "admin" ? "/admin/dashboard" : "/owner/dashboard");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600">
                        <Bike className="h-7 w-7 text-white" />
                    </div>
                    <CardTitle className="text-2xl text-blue-700">Bike Buddy Portal</CardTitle>
                    <CardDescription>
                        Sign in to manage bikes, bookings and riders.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    className="pl-9"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    className="pl-9"
                                    placeholder="Your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={8}
                                />
                            </div>
                        </div>
                        {error && (
                            <p className="text-sm text-red-600" role="alert">
                                {error}
                            </p>
                        )}
                        <Button
                            type="submit"
                            disabled={busy}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                        >
                            {busy ? "Signing in..." : "Sign In"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
