"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/auth/session-provider";
import { LoadingState } from "@/components/page-state";

export default function Home() {
  const router = useRouter();
  const { session, status } = useSession();

  useEffect(() => {
    if (status === "guest") {
      router.replace("/login");
    } else if (session?.user.role === "admin") {
      router.replace("/admin/dashboard");
    } else if (session?.user.role === "owner") {
      router.replace("/owner/dashboard");
    } else if (session?.user.role === "renter") {
      router.replace("/login?notice=renter");
    }
  }, [router, session, status]);

  return <LoadingState label="Opening Bike Buddy…" />;
}
