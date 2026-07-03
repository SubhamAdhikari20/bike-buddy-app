"use client";

// Entry point: send people to their portal, or to sign-in.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { session } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const s = session.get();
    if (!s) {
      router.replace("/login");
    } else if (s.role === "admin") {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/owner/dashboard");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-gray-500">
      Loading Bike Buddy...
    </div>
  );
}
