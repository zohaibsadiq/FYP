"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, Camera, Check, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { ChoiceField } from "@/components/form/choice-field";
import { PlaceField } from "@/components/form/place-field";
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
import type { ImageUploadResult } from "@/types/wardrobe";

const MAX_MB = 12;

export default function AddItemPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<ImageUploadResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  // Nothing here depends on it finishing, and a photo left behind costs storage
  // rather than breaking anything.
  function letGoOfPhoto(previous: ImageUploadResult | null) {
    if (!previous) return;
    discard.mutate([previous.original_image_public_id, previous.clean_image_public_id]);
  }

  const categoryChoices = (categories ?? []).map((category) => ({
    value: String(category.id),
    label: category.name,
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

    if (!form.name.trim()) {
      setFieldErrors({ name: "Please give this item a name." });
      return;
    }
    if (!form.category) {
      setFieldErrors({ category: "Please choose what kind of item this is." });
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

  const detectedColour = uploaded?.detected.primary_color_name;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/closet"
        className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 gap-2")}
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to my clothes
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Add an item</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A photo helps, but you can add an item without one.
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
        <section className="rounded-xl border border-border p-4">
          <h2 className="font-medium">Photo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Lay the item on a plain surface, like a bed or a floor. Good light helps.
          </p>

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
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
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

              <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
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
        </section>

        <section className="space-y-5 rounded-xl border border-border p-4">
          <h2 className="font-medium">Details</h2>

          <Field
            id="name"
            label="What is it?"
            hint="A short name you would recognise, like Blue denim jacket."
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            error={fieldErrors.name}
            required
          />

          <ChoiceField
            id="category"
            label="What kind of item is it?"
            choices={categoryChoices}
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
            placeholder="Choose one"
            error={fieldErrors.category}
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
        </section>

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
      </form>
    </div>
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
