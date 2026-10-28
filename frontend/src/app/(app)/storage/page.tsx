"use client";

import { useState } from "react";
import {
  Archive,
  Box,
  CircleDashed,
  DoorClosed,
  DoorOpen,
  Ellipsis,
  Inbox,
  Loader2,
  Luggage,
  MapPin,
  PanelTop,
  Pencil,
  Plus,
  Rows3,
  Shirt,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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
  useWardrobeStats,
} from "@/hooks/use-wardrobe";
import { getErrorMessage, isStaleChoiceError } from "@/lib/api";
import { guessStorageKind } from "@/lib/storage-kind";
import { idsWithin, levelsInside, measure } from "@/lib/storage-tree";
import { cn } from "@/lib/utils";
import {
  STORAGE_KIND_LABELS,
  STORAGE_KINDS,
  type StorageKind,
  type StorageLocation,
  type StorageNode,
} from "@/types/wardrobe";

const KIND_CHOICES = STORAGE_KINDS.map((kind) => ({
  value: kind,
  label: STORAGE_KIND_LABELS[kind],
}));

// A small picture for each kind of place, so a drawer and a room look
// different at a glance.
const KIND_ICON: Record<StorageKind, typeof Box> = {
  ROOM: DoorOpen,
  WARDROBE: DoorClosed,
  CABINET: Archive,
  DRAWER: Inbox,
  SHELF: Rows3,
  RAIL: PanelTop,
  HANGER: Shirt,
  BOX: Box,
  SUITCASE: Luggage,
  OTHER: Ellipsis,
};

type Draft = { name: string; kind: string; parent: string | null };

/** "Wardrobe / Closet, 2 places inside, 7 items" for the line under a name. */
function describe(node: StorageNode): string {
  const inside = measure(node);
  const parts = [node.kind_label];
  if (inside.places > 0) {
    parts.push(`${inside.places} ${inside.places === 1 ? "place" : "places"} inside`);
  }
  parts.push(
    inside.items > 0
      ? `${inside.items} ${inside.items === 1 ? "item" : "items"}`
      : "nothing kept here yet",
  );
  return parts.join(", ");
}

export default function StoragePage() {
  const { data: tree, isPending } = useStorageTree();
  const { data: flat } = useStorageLocations();
  const { data: stats } = useWardrobeStats();
  const remove = useDeleteStorageLocation();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StorageNode | null>(null);

  const isEmpty = !isPending && (tree?.length ?? 0) === 0;
  const editing = editingId === null ? null : (flat ?? []).find((l) => l.id === editingId) ?? null;

  const placeCount = (tree ?? []).reduce((count, node) => count + 1 + measure(node).places, 0);
  const placed = stats ? stats.total - stats.unplaced : 0;

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

  const rowHandlers = {
    places: flat ?? [],
    editing,
    editingId,
    onEdit: (id: number) => {
      setAdding(false);
      setEditingId(id);
    },
    onStopEditing: () => setEditingId(null),
    onDelete: setPendingDelete,
    busy: remove.isPending,
  };

  return (
    <div className="relative mx-auto max-w-4xl space-y-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 -z-10 h-72 w-full overflow-hidden">
        <div className="animate-drift absolute -top-10 right-10 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-drift absolute left-1/3 top-6 size-56 rounded-full bg-chart-3/10 blur-3xl [animation-delay:-8s]" />
      </div>

      <header className="animate-in fade-in slide-in-from-bottom-2 flex flex-wrap items-end justify-between gap-4 duration-500">
        <div>
          <p className="text-sm font-medium text-primary">Your places</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Where Things Are
          </h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
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
            className="h-11 gap-2 px-5 shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5"
          >
            <Plus className="size-5" aria-hidden />
            Add a place
          </Button>
        ) : null}
      </header>

      {!isPending && !isEmpty && stats ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both flex flex-wrap gap-2 duration-500 [animation-delay:60ms]">
          <Stat icon={MapPin}>
            {placeCount} {placeCount === 1 ? "place" : "places"}
          </Stat>
          <Stat icon={Shirt}>
            {placed} {placed === 1 ? "item has" : "items have"} a place
          </Stat>
          {stats.unplaced > 0 ? (
            <Stat icon={CircleDashed} muted>
              {stats.unplaced} {stats.unplaced === 1 ? "item has" : "items have"} no place yet
            </Stat>
          ) : null}
        </div>
      ) : null}

      {isEmpty ? (
        <EmptyState
          icon={MapPin}
          title="No places yet"
          body="Most people start with one room, then add the wardrobe inside it, then the drawers inside that."
          steps={[
            "Add a room, like Bedroom.",
            "Add the wardrobe or cupboard inside it.",
            "Add the drawers, shelves and rails inside that.",
          ]}
        />
      ) : null}

      {adding || isEmpty ? (
        <PlaceForm
          places={flat ?? []}
          onDone={() => setAdding(false)}
          onCancel={isEmpty ? undefined : () => setAdding(false)}
        />
      ) : null}

      {isPending ? (
        <div className="space-y-4" aria-busy>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : isEmpty ? null : (
        <ul className="space-y-4">
          {tree?.map((node, index) => (
            <li
              key={node.id}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
              style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
            >
              <PlaceCard node={node} {...rowHandlers} />
            </li>
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

/** One small rounded number under the heading. */
function Stat({
  icon: Icon,
  muted,
  children,
}: {
  icon: typeof Box;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium",
        muted && "text-muted-foreground",
      )}
    >
      <Icon className={cn("size-3.5", muted ? "text-muted-foreground" : "text-primary")} aria-hidden />
      {children}
    </span>
  );
}

type RowHandlers = {
  places: StorageLocation[];
  editing: StorageLocation | null;
  editingId: number | null;
  onEdit: (id: number) => void;
  onStopEditing: () => void;
  onDelete: (node: StorageNode) => void;
  busy: boolean;
};

/** The two small buttons at the end of every row: change it, remove it. */
function RowActions({
  node,
  onEdit,
  onDelete,
  busy,
}: {
  node: StorageNode;
  onEdit: (id: number) => void;
  onDelete: (node: StorageNode) => void;
  busy: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onEdit(node.id)}
        className="rounded-full text-muted-foreground hover:text-foreground"
      >
        <Pencil className="size-4" aria-hidden />
        <span className="sr-only">Change {node.name}</span>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={busy}
        onClick={() => onDelete(node)}
        className="rounded-full text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-4" aria-hidden />
        <span className="sr-only">Remove {node.name}</span>
      </Button>
    </div>
  );
}

/** A top-level place, usually a room, as a card with everything inside it. */
function PlaceCard({ node, ...handlers }: { node: StorageNode } & RowHandlers) {
  const Icon = KIND_ICON[node.kind] ?? Ellipsis;
  const isEditing = handlers.editingId === node.id && handlers.editing !== null;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/30">
      {isEditing ? (
        <div className="p-4 sm:p-5">
          <PlaceForm
            places={handlers.places}
            existing={handlers.editing ?? undefined}
            node={node}
            onDone={handlers.onStopEditing}
            onCancel={handlers.onStopEditing}
          />
        </div>
      ) : (
        <div className="flex items-center gap-4 p-4 sm:p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-semibold tracking-tight">{node.name}</h2>
            <p className="line-clamp-2 text-xs text-muted-foreground">{describe(node)}</p>
          </div>
          <RowActions
            node={node}
            onEdit={handlers.onEdit}
            onDelete={handlers.onDelete}
            busy={handlers.busy}
          />
        </div>
      )}

      {node.children.length > 0 ? (
        <div className="border-t border-border bg-muted/30 px-3 py-3 sm:px-5">
          <Branch nodes={node.children} {...handlers} />
        </div>
      ) : null}
    </article>
  );
}

/** The places inside a place, drawn as a tree with a line down the left. */
function Branch({ nodes, ...handlers }: { nodes: StorageNode[] } & RowHandlers) {
  return (
    <ul className="ml-2 space-y-1 border-l-2 border-border pl-3 sm:ml-3 sm:pl-4">
      {nodes.map((node) => {
        const Icon = KIND_ICON[node.kind] ?? Ellipsis;
        const isEditing = handlers.editingId === node.id && handlers.editing !== null;
        return (
          <li key={node.id}>
            {isEditing ? (
              <div className="py-2">
                <PlaceForm
                  places={handlers.places}
                  existing={handlers.editing ?? undefined}
                  node={node}
                  onDone={handlers.onStopEditing}
                  onCancel={handlers.onStopEditing}
                />
              </div>
            ) : (
              <div className="flex min-h-12 items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-card">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-foreground/70 ring-1 ring-border">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{node.name}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{describe(node)}</p>
                </div>
                <RowActions
                  node={node}
                  onEdit={handlers.onEdit}
                  onDelete={handlers.onDelete}
                  busy={handlers.busy}
                />
              </div>
            )}

            {node.children.length > 0 ? <Branch nodes={node.children} {...handlers} /> : null}
          </li>
        );
      })}
    </ul>
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
    <form
      onSubmit={handleSubmit}
      className="animate-in fade-in slide-in-from-bottom-2 space-y-5 rounded-2xl border border-primary/20 bg-card p-5 shadow-lg shadow-primary/5 duration-300 sm:p-6"
    >
      <h2 className="flex items-center gap-3 font-display text-lg font-semibold tracking-tight">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {existing ? <Pencil className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
        </span>
        {existing ? `Change ${existing.name}` : "Add a place"}
      </h2>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
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

      <fieldset>
        <legend className="text-sm font-medium">What kind of place is it?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {KIND_CHOICES.map((choice) => {
            const Icon = KIND_ICON[choice.value];
            const selected = form.kind === choice.value;
            return (
              <button
                key={choice.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setForm((f) => ({ ...f, kind: choice.value }))}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-all duration-200",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {choice.label}
              </button>
            );
          })}
        </div>
      </fieldset>

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

      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center">
        <Button
          type="submit"
          size="lg"
          disabled={saving}
          className="h-11 gap-2 px-6 shadow-lg shadow-primary/20"
        >
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
