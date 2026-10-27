"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  Camera,
  Check,
  HandHeart,
  Heart,
  Loader2,
  MapPin,
  Pencil,
  Shirt,
  Tag,
  Trash2,
  WashingMachine,
} from "lucide-react";
import { toast } from "sonner";

import { CheckboxGroupField } from "@/components/form/checkbox-group-field";
import { ChoiceField } from "@/components/form/choice-field";
import { PlaceField } from "@/components/form/place-field";
import { EmptyState } from "@/components/wardrobe/empty-state";
import { WearHistory } from "@/components/wardrobe/wear-history";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { PhotoField } from "@/components/wardrobe/photo-field";
import {
  useCategories,
  useCreateStorageLocation,
  useDeleteGarment,
  useDiscardUpload,
  useGarment,
  useRecordWear,
  useStorageLocations,
  useToggleArchived,
  useToggleFavorite,
  useToggleLaundry,
  useUpdateGarment,
} from "@/hooks/use-wardrobe";
import { getErrorMessage, getFieldErrors, isStaleChoiceError } from "@/lib/api";
import { spanInWords } from "@/lib/dates";
import { guessStorageKind } from "@/lib/storage-kind";
import { cn } from "@/lib/utils";
import {
  OCCASIONS,
  OCCASION_LABELS,
  PATTERNS,
  PATTERN_LABELS,
  SEASONS,
  SEASON_LABELS,
  type Garment,
  type ImageUploadResult,
  type ItemStatus,
  type Occasion,
  type Pattern,
  type Season,
} from "@/types/wardrobe";

const SEASON_CHOICES = SEASONS.map((s) => ({ value: s, label: SEASON_LABELS[s] }));
const OCCASION_CHOICES = OCCASIONS.map((o) => ({ value: o, label: OCCASION_LABELS[o] }));
const PATTERN_CHOICES = PATTERNS.map((p) => ({ value: p, label: PATTERN_LABELS[p] }));

// The small coloured dot in front of the status chip, one colour per state.
const STATUS_DOT: Record<ItemStatus, string> = {
  IN_WARDROBE: "bg-chart-3",
  IN_LAUNDRY: "bg-chart-2",
  LENT_OUT: "bg-chart-4",
  FOR_SALE: "bg-primary",
  SOLD: "bg-chart-5",
  ARCHIVED: "bg-muted-foreground",
};

export default function ItemPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const { data: item, isPending, isError } = useGarment(Number.isFinite(id) ? id : null);
  const [editing, setEditing] = useState<false | "details" | "photo">(false);

  if (isPending) {
    return (
      <div className="mx-auto max-w-5xl space-y-6" aria-busy>
        <Skeleton className="h-9 w-40" />
        <div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <Skeleton className="mx-auto aspect-4/5 w-full max-w-sm rounded-3xl lg:max-w-none" />
          <div className="space-y-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </div>
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="mx-auto max-w-5xl">
        <EmptyState
          icon={Shirt}
          title="This item is not in your closet"
          body="It may have been removed, or the link may be wrong."
          action={{ href: "/closet", label: "Back to my clothes" }}
        />
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-5xl space-y-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 -z-10 h-72 w-full overflow-hidden">
        <div className="animate-drift absolute -top-10 right-10 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-drift absolute left-1/3 top-6 size-56 rounded-full bg-chart-2/10 blur-3xl [animation-delay:-8s]" />
      </div>

      <Link href="/closet" className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 gap-2")}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to my clothes
      </Link>

      {editing ? (
        <EditForm
          item={item}
          startWithPhoto={editing === "photo"}
          onDone={() => setEditing(false)}
        />
      ) : (
        <Details
          item={item}
          onEdit={() => setEditing("details")}
          onEditPhoto={() => setEditing("photo")}
          onDeleted={() => router.push("/closet")}
        />
      )}
    </div>
  );
}

function Details({
  item,
  onEdit,
  onEditPhoto,
  onDeleted,
}: {
  item: Garment;
  onEdit: () => void;
  onEditPhoto: () => void;
  onDeleted: () => void;
}) {
  const recordWear = useRecordWear();
  const toggleLaundry = useToggleLaundry();
  const toggleFavorite = useToggleFavorite();
  const toggleArchived = useToggleArchived();
  const remove = useDeleteGarment();
  const [confirming, setConfirming] = useState(false);

  const inWash = item.status === "IN_LAUNDRY";
  const putAway = item.status === "ARCHIVED";

  function run(action: { mutate: (id: number, opts: object) => void }, message: string) {
    action.mutate(item.id, {
      onSuccess: () => toast.success(message),
      onError: (e: unknown) => toast.error(getErrorMessage(e, "That did not save. Try again.")),
    });
  }

  function handleDelete() {
    remove.mutate(item.id, {
      onSuccess: () => {
        toast.success(`${item.name} was removed from your closet.`);
        onDeleted();
      },
      onError: (e) => {
        setConfirming(false);
        toast.error(getErrorMessage(e, "That item could not be removed."));
      },
    });
  }

  // "Worn 3 times, last worn 2 weeks ago." in words rather than a raw count of days.
  const wornLine =
    item.wear_count === 0
      ? "You have not worn this yet."
      : `Worn ${item.wear_count} ${item.wear_count === 1 ? "time" : "times"}${
          item.days_since_worn === null
            ? ""
            : item.days_since_worn === 0
              ? ", last worn today"
              : `, last worn ${spanInWords(item.days_since_worn)} ago`
        }.`;

  // Three numbers at a glance. A price divided by zero wears says nothing
  // yet, so the middle one waits for the first wear.
  const tiles = [
    {
      label: "Times worn",
      value: String(item.wear_count),
      unit: item.wear_count === 1 ? "time" : "times",
    },
    {
      label: "Each wear costs",
      value:
        item.wear_count > 0 && item.cost_per_wear !== null
          ? Math.round(item.cost_per_wear).toLocaleString("en-GB")
          : "Not yet",
      unit: item.wear_count > 0 && item.cost_per_wear !== null ? item.currency : "",
    },
    {
      label: "What you paid",
      value: item.purchase_price
        ? Math.round(Number(item.purchase_price)).toLocaleString("en-GB")
        : "Not set",
      unit: item.purchase_price ? item.currency : "",
    },
  ];

  const facts: { label: string; value: string; swatch?: string; wide?: boolean }[] = [
    { label: "Brand", value: item.brand },
    { label: "Size", value: item.size },
    { label: "Material", value: item.material },
    { label: "Pattern", value: PATTERN_LABELS[item.pattern] },
    { label: "Colour", value: item.primary_color_name, swatch: item.primary_color_hex },
    { label: "Good for", value: item.seasons.map((s) => SEASON_LABELS[s]).join(", ") },
    { label: "Wear it to", value: item.occasions.map((o) => OCCASION_LABELS[o]).join(", ") },
    { label: "Notes", value: item.notes, wide: true },
  ].filter((fact) => Boolean(fact.value));

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* The picture stays in view on a wide screen while the rest scrolls. */}
        <div>
          <div className="animate-in fade-in zoom-in-95 mx-auto w-full max-w-sm duration-500 lg:sticky lg:top-6 lg:max-w-none">
            <div className="group relative aspect-4/5 overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-muted/80 to-muted/20 shadow-sm">
              <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03]">
                <GarmentPicture
                  src={item.display_image_url}
                  alt={item.name}
                  sizes="(max-width: 1024px) 100vw, 320px"
                  className={cn("p-6", inWash && "opacity-50")}
                  iconClassName="size-16"
                  priority
                />
              </div>

              {inWash ? (
                <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur">
                  <WashingMachine className="size-3.5 text-chart-2" aria-hidden />
                  In the wash
                </span>
              ) : null}

              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={toggleFavorite.isPending}
                onClick={() => run(toggleFavorite, "Favourites updated.")}
                className="absolute right-3 top-3 z-10 rounded-full bg-card/90 shadow-sm backdrop-blur hover:bg-card"
              >
                <Heart
                  className={cn("size-5", item.is_favorite && "fill-destructive text-destructive")}
                  aria-hidden
                />
                <span className="sr-only">
                  {item.is_favorite ? "Remove from favourites" : "Save to favourites"}
                </span>
              </Button>

              {/* Always on screen rather than shown on hover: a phone has no hover. */}
              <Button
                type="button"
                variant="outline"
                onClick={onEditPhoto}
                className="absolute bottom-3 right-3 z-10 h-10 gap-2 rounded-full bg-card/90 shadow-sm backdrop-blur hover:bg-card"
              >
                <Camera className="size-4" aria-hidden />
                {item.display_image_url ? "Change photo" : "Add a photo"}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <header className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <p className="text-sm font-medium text-primary">{item.category_name}</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {item.name}
            </h1>
            <p className="mt-2 text-muted-foreground">{wornLine}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Chip dot={STATUS_DOT[item.status]}>{item.status_label}</Chip>
              <Chip icon={<MapPin className="size-3.5 text-primary" aria-hidden />}>
                {item.location_path || "No place yet"}
              </Chip>
              {item.is_favorite ? (
                <Chip icon={<Heart className="size-3.5 fill-destructive text-destructive" aria-hidden />}>
                  Favourite
                </Chip>
              ) : null}
            </div>
          </header>

          <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both flex flex-wrap gap-2 duration-500 [animation-delay:60ms]">
            <Button
              type="button"
              disabled={recordWear.isPending || inWash}
              onClick={() =>
                recordWear.mutate(
                  { id: item.id },
                  {
                    onSuccess: () => toast.success("Saved. You wore this today."),
                    onError: (e) =>
                      toast.error(getErrorMessage(e, "That did not save. Try again.")),
                  },
                )
              }
              className="h-11 gap-2 px-5 shadow-lg shadow-primary/20"
            >
              <Check className="size-4" aria-hidden />
              I wore this today
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={toggleLaundry.isPending}
              onClick={() =>
                run(toggleLaundry, inWash ? "Back in your closet." : "Put in the wash.")
              }
              className="h-11 gap-2 px-5"
            >
              <WashingMachine className="size-4" aria-hidden />
              {inWash ? "It is clean" : "To the wash"}
            </Button>
            <Button type="button" variant="outline" onClick={onEdit} className="h-11 gap-2 px-5">
              <Pencil className="size-4" aria-hidden />
              Change details
            </Button>
          </div>

          <dl className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both grid grid-cols-3 gap-3 duration-500 [animation-delay:120ms]">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-2xl border border-border bg-card p-3.5 sm:p-4">
                <dt className="truncate text-xs text-muted-foreground">{tile.label}</dt>
                <dd className="mt-1 flex flex-wrap items-baseline gap-x-1">
                  <span className="font-display text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
                    {tile.value}
                  </span>
                  {tile.unit ? <span className="text-xs text-muted-foreground">{tile.unit}</span> : null}
                </dd>
              </div>
            ))}
          </dl>

          <section
            aria-labelledby="about-heading"
            className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 [animation-delay:180ms]"
          >
            <h2 id="about-heading" className="font-display text-xl font-semibold tracking-tight">
              About this item
            </h2>
            {facts.length ? (
              <dl className="mt-3 grid gap-x-6 gap-y-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
                {facts.map((fact) => (
                  <div key={fact.label} className={cn("min-w-0", fact.wide && "sm:col-span-2")}>
                    <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                    <dd className="mt-0.5 flex items-center gap-2 text-sm font-medium">
                      {fact.swatch ? (
                        <span
                          aria-hidden
                          className="size-3.5 shrink-0 rounded-full border border-border"
                          style={{ background: fact.swatch }}
                        />
                      ) : null}
                      <span className={fact.wide ? "whitespace-pre-line" : "truncate"}>{fact.value}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                Nothing written down yet. Use Change details to add the brand, size and more.
              </p>
            )}
          </section>

          <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 [animation-delay:240ms]">
            <WearHistory item={item} />
          </div>

          <section
            aria-labelledby="more-heading"
            className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 [animation-delay:300ms]"
          >
            <h2 id="more-heading" className="font-display text-xl font-semibold tracking-tight">
              More
            </h2>
            <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
              <LendingSwitch item={item} />

              <Row
                icon={Archive}
                tone="bg-chart-4/20 text-amber-700"
                title={putAway ? "Bring it back to your closet" : "Put it away for a while"}
                body={
                  putAway
                    ? "It sits under Sold and put away right now. Its history is kept."
                    : "Out of sight but not deleted. It keeps its history under Sold and put away."
                }
              >
                <Button
                  type="button"
                  variant="outline"
                  disabled={toggleArchived.isPending}
                  onClick={() =>
                    toggleArchived.mutate(
                      { id: item.id, archived: !putAway },
                      {
                        onSuccess: () =>
                          toast.success(
                            putAway
                              ? "Back in your closet."
                              : "Put away. You will find it under Sold and put away.",
                          ),
                        onError: (e: unknown) =>
                          toast.error(getErrorMessage(e, "That did not save. Try again.")),
                      },
                    )
                  }
                  className="h-10 gap-2 rounded-full px-4"
                >
                  <Archive className="size-4" aria-hidden />
                  {putAway ? "Bring it back" : "Put it away"}
                </Button>
              </Row>

              <Row
                icon={Trash2}
                tone="bg-destructive/10 text-destructive"
                title="Remove it for good"
                body="Takes the item and its photo out of your closet. This cannot be undone."
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirming(true)}
                  className="h-10 gap-2 rounded-full px-4 text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Remove from my closet
                </Button>
              </Row>
            </div>
          </section>
        </div>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {item.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This takes the item and its photo out of your closet for good. If you only want it
              out of the way for a while, put it in the wash instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={handleDelete}
              className="gap-2 bg-destructive text-white hover:bg-destructive/90"
            >
              {remove.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Yes, remove it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** A small rounded label: a status, a place, a favourite mark. */
function Chip({
  icon,
  dot,
  children,
}: {
  icon?: React.ReactNode;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium">
      {dot ? <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dot)} /> : null}
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** One row of the More box: an icon, a title, a line of explanation, a button. */
function Row({
  icon: Icon,
  tone,
  title,
  body,
  children,
}: {
  icon: typeof Archive;
  tone: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * Whether friends are shown this one at all.
 *
 * It lives on the item page, not on every card, because it is decided once and
 * then almost never changed - and because it only matters for the handful of
 * things somebody would refuse to hand over.
 */
function LendingSwitch({ item }: { item: Garment }) {
  const update = useUpdateGarment();
  const shared = item.is_lendable;

  return (
    <Row
      icon={HandHeart}
      tone="bg-chart-2/15 text-chart-2"
      title="Friends can ask to borrow this"
      body={
        shared
          ? "Shown to your friends, but only while your closet is shared."
          : "Hidden from your friends, even when your closet is shared."
      }
    >
      <Button
        type="button"
        variant="outline"
        disabled={update.isPending}
        aria-pressed={shared}
        onClick={() =>
          update.mutate(
            { id: item.id, is_lendable: !shared },
            {
              onSuccess: () =>
                toast.success(shared ? "Hidden from your friends." : "Your friends can see it."),
              onError: (error: unknown) =>
                toast.error(getErrorMessage(error, "That did not save. Try again.")),
            },
          )
        }
        className="h-10 rounded-full px-4"
      >
        {shared ? "Do not lend this one" : "Allow lending"}
      </Button>
    </Row>
  );
}

/**
 * What a saved edit says about the photo. Nothing when it was left alone; the
 * new upload's addresses and its colour when one was chosen; empty addresses
 * when it was removed, which also deletes the old files from the image host.
 */
function photoChanges(uploaded: ImageUploadResult | null, removed: boolean) {
  if (uploaded) {
    return {
      original_image_url: uploaded.original_image_url,
      original_image_public_id: uploaded.original_image_public_id,
      clean_image_url: uploaded.clean_image_url,
      clean_image_public_id: uploaded.clean_image_public_id,
      ...(uploaded.detected.primary_color_name
        ? {
            primary_color_hex: uploaded.detected.primary_color_hex,
            primary_color_name: uploaded.detected.primary_color_name,
          }
        : {}),
    };
  }
  if (removed) {
    return {
      original_image_url: "",
      original_image_public_id: "",
      clean_image_url: "",
      clean_image_public_id: "",
    };
  }
  return {};
}

function EditForm({
  item,
  startWithPhoto,
  onDone,
}: {
  item: Garment;
  /** Opens with the photo section in view, for the button on the picture. */
  startWithPhoto?: boolean;
  onDone: () => void;
}) {
  const { data: categories } = useCategories();
  const { data: locations } = useStorageLocations();
  const update = useUpdateGarment();
  const createPlace = useCreateStorageLocation();
  const discard = useDiscardUpload();
  const photoSection = useRef<HTMLElement>(null);

  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uploaded, setUploaded] = useState<ImageUploadResult | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (startWithPhoto) {
      photoSection.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    }
  }, [startWithPhoto]);

  function cancel() {
    // A photo uploaded and then abandoned would sit on the image host for ever.
    if (uploaded) {
      discard.mutate([uploaded.original_image_public_id, uploaded.clean_image_public_id]);
    }
    onDone();
  }

  const [form, setForm] = useState({
    name: item.name,
    category: String(item.category),
    brand: item.brand,
    size: item.size,
    material: item.material,
    pattern: item.pattern as string,
    storage_location: item.storage_location === null ? null : String(item.storage_location),
    purchase_price: item.purchase_price ?? "",
    notes: item.notes,
    seasons: item.seasons as string[],
    occasions: item.occasions as string[],
  });

  const categoryChoices = (categories ?? []).map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  function handleCreatePlace(name: string) {
    setFormError("");
    createPlace.mutate(
      { name, kind: guessStorageKind(name), parent: null },
      {
        onSuccess: (created) => {
          setForm((f) => ({ ...f, storage_location: String(created.id) }));
          toast.success(`${created.name} was added to your places.`);
        },
        onError: (e) => setFormError(getErrorMessage(e, `${name} could not be added.`)),
      },
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");

    if (!form.name.trim()) {
      setFieldErrors({ name: "Please give this item a name." });
      return;
    }
    if (!form.category) {
      setFieldErrors({ category: "Please choose what kind of item this is." });
      return;
    }

    update.mutate(
      {
        id: item.id,
        name: form.name.trim(),
        category: Number(form.category),
        brand: form.brand.trim(),
        size: form.size.trim(),
        material: form.material.trim(),
        pattern: form.pattern as Pattern,
        storage_location: form.storage_location ? Number(form.storage_location) : null,
        purchase_price: form.purchase_price.trim() || null,
        notes: form.notes.trim(),
        seasons: form.seasons as Season[],
        occasions: form.occasions as Occasion[],
        ...photoChanges(uploaded, photoRemoved),
      },
      {
        onSuccess: () => {
          toast.success("Your changes are saved.");
          onDone();
        },
        onError: (e) => {
          if (isStaleChoiceError(e)) {
            setForm((f) => ({ ...f, storage_location: null }));
            setFormError(
              "Something you picked is no longer there. The lists are up to date now, so please check your answers and save again.",
            );
            return;
          }
          setFieldErrors(getFieldErrors(e));
          setFormError(getErrorMessage(e, "Your changes could not be saved."));
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-5">
      <header className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <p className="text-sm font-medium text-primary">{item.name}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Change details
        </h1>
        <p className="mt-2 text-muted-foreground">
          Only the name and the kind are needed. Everything else can stay empty.
        </p>
      </header>

      {formError ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
        >
          {formError}
        </p>
      ) : null}

      <Panel icon={Camera} title="Photo" sectionRef={photoSection}>
        <PhotoField
          current={item.display_image_url}
          uploaded={uploaded}
          removed={photoRemoved}
          onUploaded={setUploaded}
          onRemoved={setPhotoRemoved}
          onBusyChange={setUploading}
          autoFocus={startWithPhoto}
        />
      </Panel>

      <Panel icon={Tag} title="The basics">
        <div className="space-y-5">
          <Field
            id="name"
            label="What is it?"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            error={fieldErrors.name}
          />

          <ChoiceField
            id="category"
            label="What kind of item is it?"
            choices={categoryChoices}
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v ?? "" }))}
            error={fieldErrors.category}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="brand"
              label="Brand"
              value={form.brand}
              onChange={(v) => setForm((f) => ({ ...f, brand: v }))}
              error={fieldErrors.brand}
            />
            <Field
              id="size"
              label="Size"
              value={form.size}
              onChange={(v) => setForm((f) => ({ ...f, size: v }))}
              error={fieldErrors.size}
            />
            <Field
              id="material"
              label="Material"
              hint="Cotton, wool, denim"
              value={form.material}
              onChange={(v) => setForm((f) => ({ ...f, material: v }))}
              error={fieldErrors.material}
            />
            <ChoiceField
              id="pattern"
              label="Pattern"
              choices={PATTERN_CHOICES}
              value={form.pattern}
              onChange={(v) => setForm((f) => ({ ...f, pattern: v ?? "SOLID" }))}
            />
          </div>
        </div>
      </Panel>

      <Panel icon={MapPin} title="Where it lives and what it cost">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <PlaceField
              id="storage"
              label="Where do you keep it?"
              places={locations ?? []}
              value={form.storage_location}
              onChange={(v) => setForm((f) => ({ ...f, storage_location: v }))}
              onCreate={handleCreatePlace}
              creating={createPlace.isPending}
              placeholder="Type a place, or leave this empty"
              error={fieldErrors.storage_location}
            />
          </div>
          <Field
            id="purchase_price"
            label="What did it cost?"
            hint="Used to show what each wear costs you."
            inputMode="decimal"
            value={form.purchase_price}
            onChange={(v) => setForm((f) => ({ ...f, purchase_price: v }))}
            error={fieldErrors.purchase_price}
          />
        </div>
      </Panel>

      <Panel icon={CalendarDays} title="When and where you wear it">
        <div className="space-y-6">
          <CheckboxGroupField
            legend="When can you wear it?"
            hint="Tick every season that suits. Leave them all empty if it suits any."
            choices={SEASON_CHOICES}
            value={form.seasons}
            onChange={(v) => setForm((f) => ({ ...f, seasons: v }))}
          />

          <CheckboxGroupField
            legend="Where can you wear it?"
            hint="Tick as many as you like."
            choices={OCCASION_CHOICES}
            value={form.occasions}
            onChange={(v) => setForm((f) => ({ ...f, occasions: v }))}
          />

          <div className="space-y-2">
            <Label htmlFor="notes">Anything else to remember?</Label>
            <Textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="A loose button, borrowed from someone, needs ironing"
            />
          </div>
        </div>
      </Panel>

      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center">
        <Button
          type="submit"
          disabled={update.isPending || uploading}
          className="h-12 gap-2 px-6 shadow-lg shadow-primary/20"
        >
          {update.isPending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Check className="size-5" aria-hidden />
          )}
          {update.isPending ? "Saving" : "Save changes"}
        </Button>

        <Button type="button" variant="ghost" onClick={cancel} className="h-12 px-6">
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** One box of the form, with a small icon and a title. */
function Panel({
  icon: Icon,
  title,
  children,
  sectionRef,
}: {
  icon: typeof Camera;
  title: string;
  children: React.ReactNode;
  sectionRef?: React.Ref<HTMLElement>;
}) {
  return (
    <section
      ref={sectionRef}
      className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-border bg-card p-5 duration-500 sm:p-6"
    >
      <h2 className="mb-5 flex items-center gap-3 font-display text-lg font-semibold tracking-tight">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  value,
  onChange,
  ...rest
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "id">) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
