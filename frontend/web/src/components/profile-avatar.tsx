"use client";

import { useState } from "react";
import Image from "next/image";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { mediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

function initialsFor(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "BB"
  );
}

export function ProfileAvatar({
  src,
  name,
  className,
  fallbackClassName,
  sizes = "32px",
  priority = false,
}: {
  src?: string | null;
  name: string;
  className?: string;
  fallbackClassName?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const resolvedSrc = mediaUrl(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(resolvedSrc) && failedSrc !== resolvedSrc;

  return (
    <Avatar className={cn("overflow-hidden", className)}>
      {showImage ? (
        <Image
          fill
          src={resolvedSrc}
          alt={`${name} profile picture`}
          className="object-cover"
          sizes={sizes}
          priority={priority}
          onError={() => setFailedSrc(resolvedSrc)}
        />
      ) : (
        <AvatarFallback className={fallbackClassName}>
          {initialsFor(name)}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
