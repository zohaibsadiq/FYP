"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Heart,
  Loader2,
  MapPin,
  Pencil,
  Shirt,
  Trash2,
  WashingMachine,
} from "lucide-react";
import { toast } from "sonner";

import { CheckboxGroupField } from "@/components/form/checkbox-group-field";
import { ChoiceField } from "@/components/form/choice-field";
import { PlaceField } from "@/components/form/place-field";
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
import {
  useCategories,
  useCreateStorageLocation,
  useDeleteGarment,
  useGarment,
  useRecordWear,
  useStorageLocations,
  useToggleFavorite,
  useToggleLaundry,
  useUpdateGarment,
} from "@/hooks/use-wardrobe";
import { getErrorMessage, getFieldErrors, isStaleChoiceError } from "@/lib/api";
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
  type Occasion,
  type Pattern,
  type Season,
} from "@/types/wardrobe";

const SEASON_CHOICES = SEASONS.map((s) => ({ value: s, label: SEASON_LABELS[s] }));
const OCCASION_CHOICES = OCCASIONS.map((o) => ({ value: o, label: OCCASION_LABELS[o] }));
const PATTERN_CHOICES = PATTERNS.map((p) => ({ value: p, label: PATTERN_LABELS[p] }));

export default function ItemPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const { data: item, isPending, isError } = useGarment(Number.isFinite(id) ? id : null);
  const [editing, setEditing] = useState(false);

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-9 w-40" />
        <div className="grid gap-6 sm:grid-cols-2">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <h1 className="text-xl font-semibold">This item is not in your closet</h1>
        <p className="text-sm text-muted-foreground">
          It may have been removed, or the link may be wrong.
        </p>
        <Link href="/closet" className={cn(buttonVariants(), "h-11 px-5")}>
          Back to my clothes
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/closet" className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 gap-2")}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to my clothes
      </Link>

      {editing ? (
        <EditForm item={item} onDone={() => setEditing(false)} />
      ) : (
        <Details
          item={item}
          onEdit={() => setEditing(true)}
          onDeleted={() => router.push("/closet")}
        />
      )}
    </div>
  );
}

function Details({
  item,
  onEdit,
  onDeleted,
}: {
  item: Garment;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const recordWear = useRecordWear();
  const toggleLaundry = useToggleLaundry();
  const toggleFavorite = useToggleFavorite();
  const remove = useDeleteGarment();
  const [confirming, setConfirming] = useState(false);

  const inWash = item.status === "IN_LAUNDRY";

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

  const facts = [
    { label: "Kind", value: item.category_name },
    { label: "Brand", value: item.brand },
    { label: "Size", value: item.size },
    { label: "Material", value: item.material },
    { label: "Pattern", value: PATTERN_LABELS[item.pattern] },
    { label: "Colour", value: item.primary_color_name },
    { label: "Where it is", value: item.location_path },
    { label: "Good for", value: item.seasons.map((s) => SEASON_LABELS[s]).join(", ") },
    { label: "Wear it to", value: item.occasions.map((o) => OCCASION_LABELS[o]).join(", ") },
    {
      label: "What it cost",
      value: item.purchase_price ? `${item.purchase_price} ${item.currency}` : "",
    },
    {
      label: "Each time you wear it",
      value:
        item.cost_per_wear !== null ? `${Math.round(item.cost_per_wear)} ${item.currency}` : "",
    },
    { label: "Notes", value: item.notes },
  ].filter((fact) => Boolean(fact.value));

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted/40">
          {item.display_image_url ? (
            <Image
              src={item.display_image_url}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 100vw, 360px"
              className={cn("object-contain p-4", inWash && "opacity-50")}
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Shirt className="size-12" aria-hidden />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.wear_count === 0
                ? "You have not worn this yet"
                : `Worn ${item.wear_count} ${item.wear_count === 1 ? "time" : "times"}`}
              {item.days_since_worn !== null ? `, last ${item.days_since_worn} days ago` : ""}
            </p>
          </div>

          {inWash ? (
            <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <WashingMachine className="size-4" aria-hidden />
              This is in the wash
            </p>
          ) : null}

          {item.location_path ? (
            <p className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {item.location_path}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
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
              className="h-11 px-5"
            >
              I wore this today
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={toggleLaundry.isPending}
              onClick={() =>
                run(toggleLaundry, inWash ? "Back in your closet." : "Put in the wash.")
              }
              className="h-11 px-5"
            >
              {inWash ? "It is clean" : "To the wash"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={toggleFavorite.isPending}
              onClick={() => run(toggleFavorite, "Favourites updated.")}
              className="size-11"
            >
              <Heart
                className={cn("size-5", item.is_favorite && "fill-destructive text-destructive")}
                aria-hidden
              />
              <span className="sr-only">
                {item.is_favorite ? "Remove from favourites" : "Save to favourites"}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {facts.length ? (
        <dl className="divide-y divide-border rounded-xl border border-border">
          {facts.map((fact) => (
            <div key={fact.label} className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="col-span-2">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <WearHistory item={item} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={onEdit} className="h-11 gap-2 px-5">
          <Pencil className="size-4" aria-hidden />
          Change details
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirming(true)}
          className="h-11 gap-2 px-5 text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
          Remove from my closet
        </Button>
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

function EditForm({ item, onDone }: { item: Garment; onDone: () => void }) {
  const { data: categories } = useCategories();
  const { data: locations } = useStorageLocations();
  const update = useUpdateGarment();
  const createPlace = useCreateStorageLocation();

  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Change details</h1>

      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
        >
          {formError}
        </p>
      ) : null}

      <section className="space-y-5 rounded-xl border border-border p-4">
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

        <Field
          id="purchase_price"
          label="What did it cost?"
          hint="Used to show what each wear costs you."
          inputMode="decimal"
          value={form.purchase_price}
          onChange={(v) => setForm((f) => ({ ...f, purchase_price: v }))}
          error={fieldErrors.purchase_price}
        />
      </section>

      <section className="space-y-6 rounded-xl border border-border p-4">
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
      </section>

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <Button type="submit" disabled={update.isPending} className="h-11 gap-2 px-6">
          {update.isPending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Check className="size-5" aria-hidden />
          )}
          {update.isPending ? "Saving" : "Save changes"}
        </Button>

        <Button type="button" variant="ghost" onClick={onDone} className="h-11 px-6">
          Cancel
        </Button>
      </div>
    </form>
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
