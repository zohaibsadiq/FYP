"use client";

import Image from "next/image";
import { Shirt } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface Props {
  /** The picture's web address. Empty means there is no picture. */
  src: string;
  alt?: string;
  sizes: string;
  className?: string;
  /** How big the shirt outline is when there is no picture, such as "size-5". */
  iconClassName?: string;
  /** Loads this one first. For the big picture at the top of a page. */
  priority?: boolean;
  /** Fills the frame and crops, for shop photos. Garment cutouts fit inside instead. */
  cover?: boolean;
}

/**
 * A garment photo, with a plain shirt outline in its place when there is no
 * photo or the photo cannot be loaded.
 *
 * A picture can disappear from the image host after the item was saved. The
 * browser's own broken-image icon would make the whole card look broken, and
 * the outline says what it is: an item without a picture.
 */
export function GarmentPicture({
  src,
  alt = "",
  sizes,
  className,
  iconClassName = "size-8",
  priority,
  cover,
}: Props) {
  // The failed address is remembered, not a plain yes or no, so a new picture
  // on the same card gets its own chance to load.
  const [failed, setFailed] = useState("");

  if (!src || failed === src) {
    return (
      <span className="flex size-full items-center justify-center text-muted-foreground">
        <Shirt className={iconClassName} aria-hidden />
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn(cover ? "object-cover" : "object-contain", className)}
      onError={() => setFailed(src)}
    />
  );
}
