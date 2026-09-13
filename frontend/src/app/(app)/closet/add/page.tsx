"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, Camera, Check, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { ChoiceField } from "@/components/form/choice-field";
import { PlaceField } from "@/components/form/place-field";
import { PhotoGuide } from "@/components/wardrobe/photo-guide";
import { SlotPicker } from "@/components/wardrobe/slot-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCategories,
  useCreateGarment,
  useCreateStorageLocation,
  useDiscardUpload,
  useStorageLocations,
  useUploadGarmentImage,
} from "@/hooks/use-wardrobe";
import { getErrorMessage, getFieldErrors, isStaleChoiceError } from "@/lib/api";
import { guessStorageKind } from "@/lib/storage-kind";
import { cn } from "@/lib/utils";
import type { ImageUploadResult, Slot } from "@/types/wardrobe";

const MAX_MB = 12;

export default function AddItemPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [slot, setSlot] = useState<Slot | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<ImageUploadResult | null>(null);
  const [progress, setProgress] = useState(0);
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
  const upload = useUploadGarmentImage();
  const discard = useDiscardUpload();
  const create = useCreateGarment();
  const createPlace = useCreateStorageLocation();

  const categoryChoices = (categories ?? [])
    .filter((category) => category.slot === slot)
    .map((category) => ({ value: String(category.id), label: category.name }));

  const chosenCategory = (categories ?? []).find((c) => String(c.id) === form.category);
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

  // Nothing waits on this, and a photo left behind costs storage rather than
  // breaking anything.
  function letGoOfPhoto(previous: ImageUploadResult | null) {
    if (!previous) return;
    discard.mutate([previous.original_image_public_id, previous.clean_image_public_id]);
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

  function handleFile(file: File) {
    if (file.size > MAX_MB * 1024 * 1024) {
      setFormError(`That photo is too big. Please pick one under ${MAX_MB} MB.`);
      return;
    }
    letGoOfPhoto(uploaded);
    setUploaded(null);
    setFormError("");
    setProgress(0);
    setPreview(URL.createObjectURL(file));

    upload.mutate(
      { file, onProgress: setProgress },
      {
        onSuccess: (result) => {
          setUploaded(result);
          setForm((f) => ({
            ...f,
            name: nameEdited
              ? f.name
              : suggestName(chosenCategory?.name, result.detected.primary_color_name),
          }));
          if (result.warning) toast.warning(result.warning);
          else toast.success("Background removed.");
        },
        onError: (e) => {
          setPreview(null);
          setFormError(getErrorMessage(e, "That photo could not be used. Please try another one."));
        },
      },
    );
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
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/closet" className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 gap-2")}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to my clothes
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Add an item</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell the app what sort of thing it is first. The rest follows from there.
        </p>
      </div>

      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
        >
          {formError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Step number={1} title="What sort of thing is it?">
          <SlotPicker categories={categories ?? []} value={slot} onChange={handleSlot} />
        </Step>

        {slot ? (
          <Step number={2} title="Which one exactly?">
            <ChoiceField
              id="category"
              label="Pick the closest match"
              choices={categoryChoices}
              value={form.category}
              onChange={handleCategory}
              error={fieldErrors.category}
            />
          </Step>
        ) : null}

        {slot && form.category ? (
          <>
            <Step number={3} title="Take a photo" optional>
              {!preview ? <PhotoGuide slot={slot} /> : null}

              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />

              {!preview ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInput.current?.click()}
                  className="mt-4 h-28 w-full flex-col gap-2 border-dashed"
                >
                  <Camera className="size-7" aria-hidden />
                  <span className="text-base font-medium">Take or choose a photo</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    JPG or PNG, up to {MAX_MB} MB
                  </span>
                </Button>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <figure>
                    <figcaption className="mb-2 text-xs font-medium text-muted-foreground">
                      Your photo
                    </figcaption>
                    <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/40">
                      {/* Object URL from the local file, so next/image is not involved. */}
                      <img src={preview} alt="" className="size-full object-contain" />
                    </div>
                  </figure>

                  <figure>
                    <figcaption className="mb-2 text-xs font-medium text-muted-foreground">
                      Background removed
                    </figcaption>
                    <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/40">
                      {upload.isPending ? (
                        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                          <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
                          <p aria-live="polite" className="text-xs text-muted-foreground">
                            {progress < 100
                              ? `Sending your photo, ${progress}%`
                              : "Cutting out the background. This takes a few seconds."}
                          </p>
                        </div>
                      ) : uploaded ? (
                        <Image
                          src={uploaded.clean_image_url}
                          alt="The item with its background removed"
                          fill
                          sizes="(max-width: 640px) 100vw, 300px"
                          className="object-contain p-2"
                        />
                      ) : null}
                    </div>
                  </figure>

                  <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        letGoOfPhoto(uploaded);
                        setPreview(null);
                        setUploaded(null);
                        if (fileInput.current) fileInput.current.value = "";
                      }}
                    >
                      <Upload className="size-4" aria-hidden />
                      Use a different photo
                    </Button>

                    {detectedColour ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span
                          aria-hidden
                          className="size-4 rounded border border-border"
                          style={{ background: uploaded?.detected.primary_color_hex }}
                        />
                        We think this is {detectedColour.toLowerCase()}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </Step>

            <Step number={4} title="The rest">
              <div className="space-y-5">
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

                <Field
                  id="brand"
                  label="Brand"
                  hint="Leave this empty if you do not know it."
                  value={form.brand}
                  onChange={(v) => setForm((f) => ({ ...f, brand: v }))}
                  error={fieldErrors.brand}
                />

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

                <Field
                  id="purchase_price"
                  label="What did it cost?"
                  hint="Optional. We use this to show what each wear costs you."
                  inputMode="decimal"
                  value={form.purchase_price}
                  onChange={(v) => setForm((f) => ({ ...f, purchase_price: v }))}
                  error={fieldErrors.purchase_price}
                />
              </div>
            </Step>

            <div className="flex flex-col gap-3 sm:flex-row-reverse">
              <Button
                type="submit"
                size="lg"
                disabled={create.isPending || upload.isPending}
                className="h-11 gap-2 px-6"
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
                className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-11 px-6")}
              >
                Cancel
              </Link>
            </div>
          </>
        ) : null}
      </form>
    </div>
  );
}

function Step({
  number,
  title,
  optional,
  children,
}: {
  number: number;
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border p-4">
      <h2 className="mb-4 flex items-center gap-3 font-medium">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
          {number}
        </span>
        {title}
        {optional ? (
          <span className="text-sm font-normal text-muted-foreground">optional</span>
        ) : null}
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
