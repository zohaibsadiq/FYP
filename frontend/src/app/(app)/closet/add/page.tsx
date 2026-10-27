"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, Loader2, MapPin, Shirt } from "lucide-react";
import { toast } from "sonner";

import { PlaceField } from "@/components/form/place-field";
import { GARMENT_SHAPES } from "@/components/wardrobe/garment-shapes";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { PhotoField } from "@/components/wardrobe/photo-field";
import { SlotPicker } from "@/components/wardrobe/slot-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCategories,
  useCreateGarment,
  useCreateStorageLocation,
  useStorageLocations,
} from "@/hooks/use-wardrobe";
import { getErrorMessage, getFieldErrors, isStaleChoiceError } from "@/lib/api";
import { guessStorageKind } from "@/lib/storage-kind";
import { cn } from "@/lib/utils";
import { SLOT_LABELS, type ImageUploadResult, type Slot } from "@/types/wardrobe";

export default function AddItemPage() {
  const router = useRouter();

  const [slot, setSlot] = useState<Slot | null>(null);
  const [uploaded, setUploaded] = useState<ImageUploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Once the name has been typed in, nothing may write over it.
  const [nameEdited, setNameEdited] = useState(false);

  const [form, setForm] = useState<{
    name: string;
    category: string | null;
    brand: string;
    storage_location: string | null;
    purchase_price: string;
  }>({
    name: "",
    category: null,
    brand: "",
    storage_location: null,
    purchase_price: "",
  });

  const { data: categories } = useCategories();
  const { data: locations } = useStorageLocations();
  const create = useCreateGarment();
  const createPlace = useCreateStorageLocation();

  const categoryChoices = (categories ?? [])
    .filter((category) => category.slot === slot)
    .map((category) => ({ value: String(category.id), label: category.name }));

  const chosenCategory = (categories ?? []).find((c) => String(c.id) === form.category);
  const chosenPlace = (locations ?? []).find((place) => String(place.id) === form.storage_location);
  const detectedColour = uploaded?.detected.primary_color_name;

  function suggestName(categoryName?: string, colour?: string | null) {
    if (!categoryName) return "";
    return colour ? `${colour} ${categoryName}` : categoryName;
  }

  function handleSlot(next: Slot) {
    setSlot(next);
    // The kinds on offer change with the sort, so one picked under the old sort
    // would no longer be in the list.
    setForm((f) => ({ ...f, category: null, name: nameEdited ? f.name : "" }));
  }

  function handleCategory(value: string | null) {
    const picked = (categories ?? []).find((c) => String(c.id) === value);
    setForm((f) => ({
      ...f,
      category: value,
      name: nameEdited ? f.name : suggestName(picked?.name, detectedColour),
    }));
  }

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

  function handleUploaded(result: ImageUploadResult | null) {
    setUploaded(result);
    if (!result) return;
    // The colour found in the photo goes into the suggested name: "Navy Kurta".
    setForm((f) => ({
      ...f,
      name: nameEdited
        ? f.name
        : suggestName(chosenCategory?.name, result.detected.primary_color_name),
    }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");

    if (!form.category) {
      setFormError("Please choose what sort of thing this is, and which one exactly.");
      return;
    }
    if (!form.name.trim()) {
      setFieldErrors({ name: "Please give this item a name." });
      return;
    }

    create.mutate(
      {
        name: form.name.trim(),
        category: Number(form.category),
        brand: form.brand.trim() || undefined,
        storage_location: form.storage_location ? Number(form.storage_location) : null,
        purchase_price: form.purchase_price.trim() || null,
        ...(uploaded
          ? {
              primary_color_hex: uploaded.detected.primary_color_hex,
              primary_color_name: uploaded.detected.primary_color_name,
              original_image_url: uploaded.original_image_url,
              original_image_public_id: uploaded.original_image_public_id,
              clean_image_url: uploaded.clean_image_url,
              clean_image_public_id: uploaded.clean_image_public_id,
            }
          : {}),
      },
      {
        onSuccess: () => {
          toast.success(`${form.name.trim()} was added to your closet.`);
          router.push("/closet");
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
          setFormError(getErrorMessage(e, "This item could not be saved. Please try again."));
        },
      },
    );
  }

  return (
    <div className="relative mx-auto max-w-4xl">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 -z-10 h-72 w-full overflow-hidden">
        <div className="animate-drift absolute -top-10 right-10 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-drift absolute left-1/3 top-6 size-56 rounded-full bg-chart-4/15 blur-3xl [animation-delay:-8s]" />
      </div>

      <Link href="/closet" className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 gap-2")}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to my clothes
      </Link>

      <header className="animate-in fade-in slide-in-from-bottom-2 mt-3 duration-500">
        <p className="text-sm font-medium text-primary">New item</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Add an item</h1>
        <p className="mt-2 text-muted-foreground">
          Tell the app what sort of thing it is first. The rest follows from there.
        </p>
      </header>

      {formError ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
        >
          {formError}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Step number={1} title="What sort of thing is it?" done={Boolean(slot)}>
            <SlotPicker categories={categories ?? []} value={slot} onChange={handleSlot} />
          </Step>

          {slot ? (
            <Step number={2} title="Which one exactly?" done={Boolean(form.category)}>
              <p id="kind-label" className="text-sm font-medium">
                Pick the closest match
              </p>
              <div role="group" aria-labelledby="kind-label" className="mt-3 flex flex-wrap gap-2">
                {categoryChoices.map((choice) => {
                  const selected = form.category === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleCategory(choice.value)}
                      className={cn(
                        "h-10 rounded-full border px-4 text-sm font-medium transition-all duration-200",
                        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                        selected
                          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5",
                      )}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
              {fieldErrors.category ? (
                <p className="mt-2 text-xs text-destructive">{fieldErrors.category}</p>
              ) : null}
            </Step>
          ) : null}

          {slot && form.category ? (
            <>
              <Step number={3} title="Take a photo" optional done={Boolean(uploaded)}>
                <PhotoField
                  slot={slot}
                  uploaded={uploaded}
                  onUploaded={handleUploaded}
                  onBusyChange={setUploading}
                />
              </Step>

              <Step number={4} title="The rest" done={form.name.trim().length > 0}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field
                      id="name"
                      label="What will you call it?"
                      hint="Filled in from your answers. Change it to whatever you would recognise."
                      value={form.name}
                      onChange={(v) => {
                        setNameEdited(true);
                        setForm((f) => ({ ...f, name: v }));
                      }}
                      error={fieldErrors.name}
                    />
                  </div>

                  <Field
                    id="brand"
                    label="Brand"
                    hint="Leave this empty if you do not know it."
                    value={form.brand}
                    onChange={(v) => setForm((f) => ({ ...f, brand: v }))}
                    error={fieldErrors.brand}
                  />

                  <Field
                    id="purchase_price"
                    label="What did it cost?"
                    hint="Optional. We use this to show what each wear costs you."
                    inputMode="decimal"
                    value={form.purchase_price}
                    onChange={(v) => setForm((f) => ({ ...f, purchase_price: v }))}
                    error={fieldErrors.purchase_price}
                  />

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
                      hint="Type something like Top drawer and it will be added to your places."
                      error={fieldErrors.storage_location}
                    />
                  </div>
                </div>
              </Step>

              <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-3 duration-500 sm:flex-row-reverse sm:items-center">
                <Button
                  type="submit"
                  size="lg"
                  disabled={create.isPending || uploading}
                  className="h-12 gap-2 px-6 shadow-lg shadow-primary/20"
                >
                  {create.isPending ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                  ) : (
                    <Check className="size-5" aria-hidden />
                  )}
                  {create.isPending ? "Saving" : "Save to my closet"}
                </Button>

                <Link
                  href="/closet"
                  className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-12 px-6")}
                >
                  Cancel
                </Link>
              </div>
            </>
          ) : null}
        </form>

        <div className="hidden lg:block">
          <Preview
            slot={slot}
            name={form.name}
            kind={chosenCategory?.name}
            brand={form.brand}
            place={chosenPlace?.full_path}
            uploaded={uploaded}
          />
        </div>
      </div>
    </div>
  );
}

/** One numbered box of the form. The circle fills in once the step is answered. */
function Step({
  number,
  title,
  optional,
  done,
  children,
}: {
  number: number;
  title: string;
  optional?: boolean;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`step-${number}-title`}
      className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-border bg-card p-5 duration-500 sm:p-6"
    >
      <h2
        id={`step-${number}-title`}
        className="mb-5 flex flex-wrap items-center gap-3 font-display text-lg font-semibold tracking-tight"
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full font-sans text-sm font-semibold transition-colors duration-300",
            done ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
          )}
        >
          {done ? <Check className="size-4" aria-hidden /> : number}
          {done ? <span className="sr-only">Step {number}, done.</span> : null}
        </span>
        {title}
        {optional ? (
          <span className="rounded-full bg-muted px-2.5 py-0.5 font-sans text-xs font-medium text-muted-foreground">
            Optional
          </span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

/** The card this item will get in My Clothes, filling in as the form is answered. */
function Preview({
  slot,
  name,
  kind,
  brand,
  place,
  uploaded,
}: {
  slot: Slot | null;
  name: string;
  kind?: string;
  brand: string;
  place?: string;
  uploaded: ImageUploadResult | null;
}) {
  const line = [brand.trim(), kind].filter(Boolean).join(", ");

  return (
    <aside
      aria-label="How it will look"
      className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-border bg-card p-4 duration-500 lg:sticky lg:top-6"
    >
      <p className="text-sm font-medium text-primary">How it will look</p>
      <p className="mt-1 text-xs text-muted-foreground">This is the card you will see in My Clothes.</p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border">
        <div className="relative aspect-4/5 bg-gradient-to-b from-muted/80 to-muted/20">
          {uploaded ? (
            <GarmentPicture src={uploaded.clean_image_url} sizes="272px" className="p-4" />
          ) : (
            <span className="flex size-full items-center justify-center text-foreground/15">
              {slot ? (
                <svg viewBox="0 0 100 100" role="presentation" className="animate-float size-28">
                  <path d={GARMENT_SHAPES[slot]} fill="currentColor" />
                </svg>
              ) : (
                <Shirt className="size-14" aria-hidden />
              )}
            </span>
          )}

          {uploaded ? (
            <span
              aria-hidden
              className="absolute bottom-2 right-2 size-4 rounded-full border-2 border-card shadow-sm"
              style={{ background: uploaded.detected.primary_color_hex }}
            />
          ) : null}
        </div>

        <div className="p-3.5">
          <p className="truncate text-sm font-semibold">{name.trim() || "Your item"}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {line || (slot ? SLOT_LABELS[slot] : "Start with step 1")}
          </p>
          <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{place || "No place yet"}</span>
          </p>
        </div>
      </div>
    </aside>
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
