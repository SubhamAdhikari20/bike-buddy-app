"use client";

// Bike photo manager for the owner portal.
//
// Owners upload real files, which multer stores under uploads/bike on the
// backend. The first image in the list is the one renters see on search
// cards, so it is labelled and can be reordered rather than being an
// invisible rule. Alt text is editable because listing photos are content,
// not decoration (H1 visibility, and accessibility).
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export type BikeImage = {
  url: string;
  alt?: string | null;
};

const MAX_IMAGES = 6;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

type Props = {
  images: BikeImage[];
  onChange: (images: BikeImage[]) => void;
  disabled?: boolean;
};

export function BikeImageManager({ images, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setError(null);

    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      setError(`You can upload up to ${MAX_IMAGES} photos.`);
      return;
    }

    // Check everything before uploading anything, so the owner gets one clear
    // message instead of a partial upload followed by a failure.
    const rejected = files.find(
      (file) => !ACCEPTED.includes(file.type) || file.size > MAX_BYTES,
    );
    if (rejected) {
      setError(
        !ACCEPTED.includes(rejected.type)
          ? `"${rejected.name}" is not a JPG, PNG or WEBP image.`
          : `"${rejected.name}" is larger than 5 MB.`,
      );
      return;
    }

    const queue = files.slice(0, room);
    setBusy(true);
    const uploaded: BikeImage[] = [];
    try {
      for (const [index, file] of queue.entries()) {
        setStatus(`Uploading photo ${index + 1} of ${queue.length}...`);
        const response = await api.upload(file, "bike");
        uploaded.push({
          url: response.data.url,
          alt: file.name.replace(/\.[^.]+$/, ""),
        });
      }
      onChange([...images, ...uploaded]);
      setStatus(
        `${queue.length} photo${queue.length === 1 ? "" : "s"} uploaded.` +
          (files.length > room ? ` Only ${room} could be added.` : ""),
      );
    } catch (caught) {
      // Anything already uploaded is kept, so the owner does not lose work.
      if (uploaded.length > 0) onChange([...images, ...uploaded]);
      setError(
        caught instanceof Error ? caught.message : "Could not upload the photo.",
      );
      setStatus(null);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAt = (index: number) => {
    onChange(images.filter((_, position) => position !== index));
    setStatus("Photo removed from this listing.");
  };

  const makePrimary = (index: number) => {
    const next = [...images];
    const [picked] = next.splice(index, 1);
    if (picked) next.unshift(picked);
    onChange(next);
    setStatus("Primary photo updated.");
  };

  const setAlt = (index: number, alt: string) => {
    onChange(
      images.map((image, position) =>
        position === index ? { ...image, alt } : image,
      ),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          id="bike-photos"
          type="file"
          accept={ACCEPTED.join(",")}
          multiple
          className="sr-only"
          disabled={disabled || busy}
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy || images.length >= MAX_IMAGES}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ImagePlus className="size-4" aria-hidden="true" />
          )}
          {busy ? "Uploading..." : "Upload photos"}
        </Button>
        <p className="text-xs text-muted-foreground">
          JPG, PNG or WEBP · up to 5 MB each · {images.length}/{MAX_IMAGES} added
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {status ?? ""}
      </p>

      {images.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No photos yet. Renters told us dated, honest photos are the single
          biggest reason they trust a listing.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {images.map((image, index) => (
            <li
              key={`${image.url}-${index}`}
              className="space-y-2 rounded-md border p-2"
            >
              <div className="relative">
                {/* Plain img: listing photos can point at any host. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.alt || `Bike photo ${index + 1}`}
                  className="h-36 w-full rounded object-cover"
                />
                {index === 0 && (
                  <span className="absolute left-2 top-2 rounded bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
                    Primary
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor={`bike-photo-alt-${index}`}
                  className="text-xs font-normal text-muted-foreground"
                >
                  Describe this photo
                </Label>
                <Input
                  id={`bike-photo-alt-${index}`}
                  value={image.alt ?? ""}
                  placeholder="e.g. Left side, showing the panel scratch"
                  disabled={disabled}
                  onChange={(event) => setAlt(index, event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                {index !== 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => makePrimary(index)}
                  >
                    <Star className="size-3.5" aria-hidden="true" />
                    Make primary
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  disabled={disabled}
                  onClick={() => removeAt(index)}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
