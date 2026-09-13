"use client";

import { useState } from "react";
import { ChevronRight, Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ChoiceField } from "@/components/form/choice-field";
import { PlaceField } from "@/components/form/place-field";
import { EmptyState } from "@/components/wardrobe/empty-state";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateStorageLocation,
  useDeleteStorageLocation,
  useStorageLocations,
  useStorageTree,
  useUpdateStorageLocation,
} from "@/hooks/use-wardrobe";
import { getErrorMessage, isStaleChoiceError } from "@/lib/api";
import { guessStorageKind } from "@/lib/storage-kind";
import { idsWithin, levelsInside, measure } from "@/lib/storage-tree";
import {
  STORAGE_KIND_LABELS,
  STORAGE_KINDS,
  type StorageLocation,
  type StorageNode,
} from "@/types/wardrobe";

const KIND_CHOICES = STORAGE_KINDS.map((kind) => ({
  value: kind,
  label: STORAGE_KIND_LABELS[kind],
}));

type Draft = { name: string; kind: string; parent: string | null };

export default function StoragePage() {
  const { data: tree, isPending } = useStorageTree();
  const { data: flat } = useStorageLocations();
  const remove = useDeleteStorageLocation();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StorageNode | null>(null);

  const isEmpty = !isPending && (tree?.length ?? 0) === 0;
  const editing = editingId === null ? null : (flat ?? []).find((l) => l.id === editingId) ?? null;

  function handleDelete() {
    if (!pendingDelete) return;
    const name = pendingDelete.name;
    remove.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success(`${name} was removed.`);
        setPendingDelete(null);
      },
      onError: (e) => {
        setPendingDelete(null);
        toast.error(getErrorMessage(e, "That place could not be removed."));
      },
    });
  }

  const damage = pendingDelete ? measure(pendingDelete) : null;

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

        {!isEmpty && !adding ? (
          <Button
            type="button"
            size="lg"
            onClick={() => {
              setEditingId(null);
              setAdding(true);
            }}
            className="h-11 gap-2 px-5"
          >
            <Plus className="size-5" aria-hidden />
            Add a place
          </Button>
        ) : null}
      </div>

      {adding || isEmpty ? (
        <PlaceForm
          places={flat ?? []}
          onDone={() => setAdding(false)}
          onCancel={isEmpty ? undefined : () => setAdding(false)}
        />
      ) : null}

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
            <StorageRow
              key={node.id}
              node={node}
              depth={0}
              places={flat ?? []}
              editing={editing}
              editingId={editingId}
              onEdit={(id) => {
                setAdding(false);
                setEditingId(id);
              }}
              onStopEditing={() => setEditingId(null)}
              onDelete={setPendingDelete}
              busy={remove.isPending}
            />
          ))}
        </ul>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {damage && damage.places > 0
                ? `The ${damage.places} ${damage.places === 1 ? "place" : "places"} inside it go as well. `
                : ""}
              {damage && damage.items > 0
                ? `Your ${damage.items} ${damage.items === 1 ? "item" : "items"} kept there stay in your closet, but the app will no longer know where ${damage.items === 1 ? "it is" : "they are"}.`
                : "Nothing is kept here, so nothing else changes."}
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
    </div>
  );
}

function PlaceForm({
  places,
  existing,
  node,
  onDone,
  onCancel,
}: {
  places: StorageLocation[];
  existing?: StorageLocation;
  node?: StorageNode | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const create = useCreateStorageLocation();
  const update = useUpdateStorageLocation();
  // Its own mutation so the "Add ..." row in the picker does not put the Save
  // button into a loading state, and the other way round.
  const createParent = useCreateStorageLocation();

  const [error, setError] = useState("");
  const [form, setForm] = useState<Draft>({
    name: existing?.name ?? "",
    kind: existing?.kind ?? "DRAWER",
    parent: existing?.parent === null || existing === undefined ? null : String(existing.parent),
  });

  const saving = create.isPending || update.isPending;
  const inside = node ? levelsInside(node) : 0;
  const excludeIds = node ? idsWithin(node) : undefined;

  function handleCreateParent(name: string) {
    setError("");
    createParent.mutate(
      { name, kind: guessStorageKind(name), parent: null },
      {
        onSuccess: (created) => {
          setForm((f) => ({ ...f, parent: String(created.id) }));
          toast.success(`${created.name} was added.`);
        },
        onError: (e) => setError(getErrorMessage(e, `${name} could not be added.`)),
      },
    );
  }

  function handleError(e: unknown, fallback: string) {
    if (isStaleChoiceError(e)) {
      setForm((f) => ({ ...f, parent: null }));
      setError(
        "The place you picked to put this inside is no longer there. The list is up to date now, so please choose again.",
      );
      return;
    }
    setError(getErrorMessage(e, fallback));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Please give this place a name, like Top drawer.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      parent: form.parent ? Number(form.parent) : null,
    };

    if (existing) {
      update.mutate(
        { id: existing.id, ...payload },
        {
          onSuccess: (saved) => {
            toast.success(`${saved.name} was saved.`);
            onDone();
          },
          onError: (e) => handleError(e, "Those changes could not be saved."),
        },
      );
      return;
    }

    create.mutate(payload, {
      onSuccess: (created) => {
        toast.success(`${created.name} was added.`);
        setForm({ name: "", kind: form.kind, parent: form.parent });
        onDone();
      },
      onError: (e) => handleError(e, "That place could not be saved."),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border p-4">
      <h2 className="font-medium">{existing ? `Change ${existing.name}` : "Add a place"}</h2>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
        >
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
        places={places}
        value={form.parent}
        onChange={(v) => setForm((f) => ({ ...f, parent: v }))}
        onCreate={handleCreateParent}
        creating={createParent.isPending}
        roomNeeded={inside + 1}
        excludeIds={excludeIds}
        placeholder="No, it stands on its own"
        hint="A drawer is inside a wardrobe, and the wardrobe is inside a bedroom. Type a name that is not in the list and it will be added for you."
      />

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <Button type="submit" size="lg" disabled={saving} className="h-11 gap-2 px-6">
          {saving ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {existing ? "Save changes" : "Save this place"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel} className="h-11 px-6">
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function StorageRow({
  node,
  depth,
  places,
  editing,
  editingId,
  onEdit,
  onStopEditing,
  onDelete,
  busy,
}: {
  node: StorageNode;
  depth: number;
  places: StorageLocation[];
  editing: StorageLocation | null;
  editingId: number | null;
  onEdit: (id: number) => void;
  onStopEditing: () => void;
  onDelete: (node: StorageNode) => void;
  busy: boolean;
}) {
  const isEditing = editingId === node.id && editing !== null;

  return (
    <li>
      {isEditing ? (
        <div style={{ marginInlineStart: depth * 20 }}>
          <PlaceForm
            places={places}
            existing={editing}
            node={node}
            onDone={onStopEditing}
            onCancel={onStopEditing}
          />
        </div>
      ) : (
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

          <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(node.id)}>
            <Pencil className="size-4" aria-hidden />
            <span className="sr-only">Change {node.name}</span>
          </Button>

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
      )}

      {node.children.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {node.children.map((child) => (
            <StorageRow
              key={child.id}
              node={child}
              depth={depth + 1}
              places={places}
              editing={editing}
              editingId={editingId}
              onEdit={onEdit}
              onStopEditing={onStopEditing}
              onDelete={onDelete}
              busy={busy}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
