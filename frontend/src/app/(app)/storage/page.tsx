"use client";

import { useState } from "react";
import { ChevronRight, Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ChoiceField } from "@/components/form/choice-field";
import { PlaceField } from "@/components/form/place-field";
import { EmptyState } from "@/components/wardrobe/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateStorageLocation,
  useDeleteStorageLocation,
  useStorageLocations,
  useStorageTree,
} from "@/hooks/use-wardrobe";
import { getErrorMessage, isStaleChoiceError } from "@/lib/api";
import { guessStorageKind } from "@/lib/storage-kind";
import { STORAGE_KIND_LABELS, STORAGE_KINDS, type StorageNode } from "@/types/wardrobe";

const KIND_CHOICES = STORAGE_KINDS.map((kind) => ({
  value: kind,
  label: STORAGE_KIND_LABELS[kind],
}));

export default function StoragePage() {
  const { data: tree, isPending } = useStorageTree();
  const { data: flat } = useStorageLocations();
  const create = useCreateStorageLocation();
  // Its own mutation so the "Add ..." row in the picker does not put the Save
  // button into a loading state, and the other way round.
  const createParent = useCreateStorageLocation();
  const remove = useDeleteStorageLocation();

  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{ name: string; kind: string; parent: string | null }>({
    name: "",
    kind: "DRAWER",
    parent: null,
  });

  function handleCreateParent(name: string) {
    setError("");
    createParent.mutate(
      { name, kind: guessStorageKind(name), parent: null },
      {
        onSuccess: (created) => {
          setForm((f) => ({ ...f, parent: String(created.id) }));
          toast.success(`${created.name} was added. Your new place will go inside it.`);
        },
        onError: (e) => setError(getErrorMessage(e, `${name} could not be added.`)),
      },
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Please give this place a name, like Top drawer.");
      return;
    }

    create.mutate(
      {
        name: form.name.trim(),
        kind: form.kind,
        parent: form.parent ? Number(form.parent) : null,
      },
      {
        onSuccess: (created) => {
          toast.success(`${created.name} was added.`);
          setForm({ name: "", kind: form.kind, parent: form.parent });
          setShowForm(false);
        },
        onError: (e) => {
          if (isStaleChoiceError(e)) {
            setForm((f) => ({ ...f, parent: null }));
            setError(
              "The place you picked to put this inside is no longer there. The list is up to date now, so please choose again.",
            );
            return;
          }
          setError(getErrorMessage(e, "That place could not be saved."));
        },
      },
    );
  }

  function handleDelete(node: StorageNode) {
    remove.mutate(node.id, {
      onSuccess: () =>
        toast.success(`${node.name} was removed. Any clothes in it are still in your closet.`),
      onError: (e) => toast.error(getErrorMessage(e, "That place could not be removed.")),
    });
  }

  const isEmpty = !isPending && (tree?.length ?? 0) === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Where Things Are</h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            List the places you keep clothes. Then the app can tell you exactly where an item is
            when you need it.
          </p>
        </div>

        {!isEmpty && !showForm ? (
          <Button type="button" size="lg" onClick={() => setShowForm(true)} className="h-11 gap-2 px-5">
            <Plus className="size-5" aria-hidden />
            Add a place
          </Button>
        ) : null}
      </div>

      {(showForm || isEmpty) && (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border p-4">
          <h2 className="font-medium">Add a place</h2>

          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="place-name">What is it called?</Label>
            <Input
              id="place-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Bedroom, Top drawer, Shoe rack"
            />
          </div>

          <ChoiceField
            id="place-kind"
            label="What kind of place is it?"
            choices={KIND_CHOICES}
            value={form.kind}
            onChange={(v) => setForm((f) => ({ ...f, kind: v ?? "DRAWER" }))}
          />

          <PlaceField
            id="place-parent"
            label="Is it inside another place?"
            places={flat ?? []}
            value={form.parent}
            onChange={(v) => setForm((f) => ({ ...f, parent: v }))}
            onCreate={handleCreateParent}
            creating={createParent.isPending}
            mustHoldAnother
            placeholder="No, it stands on its own"
            hint="A drawer is inside a wardrobe, and the wardrobe is inside a bedroom. Type a name that is not in the list and it will be added for you."
          />

          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <Button type="submit" size="lg" disabled={create.isPending} className="h-11 gap-2 px-6">
              {create.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              Save this place
            </Button>
            {!isEmpty ? (
              <Button type="button" variant="ghost" size="lg" onClick={() => setShowForm(false)} className="h-11 px-6">
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      )}

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={MapPin}
          title="No places yet"
          body="Most people start with one room, then add the wardrobe inside it, then the drawers inside that."
        />
      ) : (
        <ul className="space-y-2">
          {tree?.map((node) => (
            <StorageRow key={node.id} node={node} depth={0} onDelete={handleDelete} busy={remove.isPending} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StorageRow({
  node,
  depth,
  onDelete,
  busy,
}: {
  node: StorageNode;
  depth: number;
  onDelete: (node: StorageNode) => void;
  busy: boolean;
}) {
  return (
    <li>
      <div
        className="flex min-h-14 items-center gap-3 rounded-lg border border-border px-3 py-2"
        style={{ marginInlineStart: depth * 20 }}
      >
        {depth > 0 ? (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{node.name}</p>
          <p className="text-xs text-muted-foreground">
            {node.kind_label}
            {node.item_count > 0
              ? `, ${node.item_count} ${node.item_count === 1 ? "item" : "items"} kept here`
              : ", nothing kept here yet"}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={busy}
          onClick={() => onDelete(node)}
        >
          <Trash2 className="size-4" aria-hidden />
          <span className="sr-only">Remove {node.name}</span>
        </Button>
      </div>

      {node.children.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {node.children.map((child) => (
            <StorageRow key={child.id} node={child} depth={depth + 1} onDelete={onDelete} busy={busy} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
