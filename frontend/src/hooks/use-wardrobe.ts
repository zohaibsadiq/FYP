"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";

import { api, isStaleChoiceError } from "@/lib/api";
import type { Paginated } from "@/types";
import type {
  Category,
  Garment,
  GarmentFilters,
  GarmentListItem,
  GarmentPayload,
  ImageUploadResult,
  StorageLocation,
  StorageNode,
  WardrobeStats,
  WearDay,
  WearEvent,
} from "@/types/wardrobe";

// Hierarchical so invalidating ["wardrobe"] clears everything below it, and
// invalidating ["wardrobe","items"] leaves the category list cached.
export const wardrobeKeys = {
  all: ["wardrobe"] as const,
  items: () => [...wardrobeKeys.all, "items"] as const,
  itemList: (filters: GarmentFilters) => [...wardrobeKeys.items(), filters] as const,
  item: (id: number) => [...wardrobeKeys.items(), id] as const,
  stats: () => [...wardrobeKeys.all, "stats"] as const,
  categories: () => [...wardrobeKeys.all, "categories"] as const,
  storage: () => [...wardrobeKeys.all, "storage"] as const,
  storageTree: () => [...wardrobeKeys.storage(), "tree"] as const,
  wears: () => [...wardrobeKeys.all, "wears"] as const,
  itemWears: (id: number) => [...wardrobeKeys.wears(), "item", id] as const,
  wearCalendar: (range: WearRange) => [...wardrobeKeys.wears(), "calendar", range] as const,
  wearsOn: (date: string) => [...wardrobeKeys.wears(), "on", date] as const,
};

function cleanParams(filters: GarmentFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== "" && v !== false),
  );
}

export function useGarments(filters: GarmentFilters = {}) {
  return useQuery({
    queryKey: wardrobeKeys.itemList(filters),
    queryFn: async () => {
      const { data } = await api.get<Paginated<GarmentListItem>>("/wardrobe/items/", {
        params: cleanParams(filters),
      });
      return data;
    },
    // Without this the grid empties on every filter change and the page jumps.
    placeholderData: keepPreviousData,
  });
}

export function useGarment(id: number | null) {
  return useQuery({
    queryKey: wardrobeKeys.item(id ?? 0),
    queryFn: async () => {
      const { data } = await api.get<Garment>(`/wardrobe/items/${id}/`);
      return data;
    },
    enabled: id !== null,
  });
}

export function useWardrobeStats() {
  return useQuery({
    queryKey: wardrobeKeys.stats(),
    queryFn: async () => {
      const { data } = await api.get<WardrobeStats>("/wardrobe/items/stats/");
      return data;
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: wardrobeKeys.categories(),
    queryFn: async () => {
      const { data } = await api.get<Paginated<Category>>("/wardrobe/categories/", {
        params: { page_size: 100 },
      });
      return data.results;
    },
    staleTime: 30 * 60 * 1000,
  });
}

export function useStorageLocations() {
  return useQuery({
    queryKey: wardrobeKeys.storage(),
    queryFn: async () => {
      const { data } = await api.get<Paginated<StorageLocation>>("/wardrobe/storage/", {
        params: { page_size: 100 },
      });
      return data.results;
    },
  });
}

export function useStorageTree() {
  return useQuery({
    queryKey: wardrobeKeys.storageTree(),
    queryFn: async () => {
      const { data } = await api.get<StorageNode[]>("/wardrobe/storage/tree/");
      return data;
    },
  });
}

export function useUploadGarmentImage() {
  return useMutation({
    mutationFn: async ({
      file,
      onProgress,
    }: {
      file: File;
      onProgress?: (percent: number) => void;
    }) => {
      const form = new FormData();
      form.append("image", file);

      const { data } = await api.post<ImageUploadResult>("/wardrobe/upload/", form, {
        // Background removal runs in the request, and the first one on a cold
        // server also downloads the model.
        timeout: 180_000,
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded * 100) / e.total));
          }
        },
      });
      return data;
    },
  });
}

/**
 * Gives back an upload that never became an item. The upload endpoint stores the
 * file straight away, so a swapped or abandoned photo is billed for otherwise.
 */
export function useDiscardUpload() {
  return useMutation({
    mutationFn: async (publicIds: string[]) => {
      await api.post("/wardrobe/upload/discard/", { public_ids: publicIds });
    },
  });
}

export function useCreateGarment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: GarmentPayload) => {
      const { data } = await api.post<Garment>("/wardrobe/items/", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wardrobeKeys.all });
    },
    onError: (error) => {
      // The category or location dropdown offered a row that has since gone.
      // Refetching both leaves the form showing what the server actually has.
      if (isStaleChoiceError(error)) {
        queryClient.invalidateQueries({ queryKey: wardrobeKeys.categories() });
        queryClient.invalidateQueries({ queryKey: wardrobeKeys.storage() });
      }
    },
  });
}

export function useUpdateGarment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<GarmentPayload> & { id: number }) => {
      const { data } = await api.patch<Garment>(`/wardrobe/items/${id}/`, payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(wardrobeKeys.item(data.id), data);
      queryClient.invalidateQueries({ queryKey: wardrobeKeys.items() });
      queryClient.invalidateQueries({ queryKey: wardrobeKeys.stats() });
    },
  });
}

export function useDeleteGarment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/wardrobe/items/${id}/`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wardrobeKeys.all });
    },
  });
}

/** mark-worn, toggle-laundry and toggle-favorite all return the updated item. */
function useItemAction(path: string, touchesHistory = false) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<Garment>(`/wardrobe/items/${id}/${path}/`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(wardrobeKeys.item(data.id), data);
      queryClient.invalidateQueries({ queryKey: wardrobeKeys.items() });
      queryClient.invalidateQueries({ queryKey: wardrobeKeys.stats() });
      if (touchesHistory) {
        queryClient.invalidateQueries({ queryKey: wardrobeKeys.wears() });
      }
    },
  });
}

/**
 * Puts something away, or brings it back.
 *
 * A thing put away is still owned but is out of the wardrobe: it leaves the
 * clothes list, stops being suggested and stops being counted. It changes the
 * status rather than calling an action of its own, because the status is the
 * whole of what it means.
 */
export function useToggleArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: number; archived: boolean }) => {
      const { data } = await api.patch<Garment>(`/wardrobe/items/${id}/`, {
        status: archived ? "ARCHIVED" : "IN_WARDROBE",
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(wardrobeKeys.item(data.id), data);
      queryClient.invalidateQueries({ queryKey: wardrobeKeys.items() });
      queryClient.invalidateQueries({ queryKey: wardrobeKeys.stats() });
    },
  });
}

export const useMarkWorn = () => useItemAction("mark-worn", true);
export const useToggleLaundry = () => useItemAction("toggle-laundry");
export const useToggleFavorite = () => useItemAction("toggle-favorite");

export interface WearRange {
  since?: string;
  until?: string;
  days?: number;
}

/** Every day one item was worn, newest first. */
export function useItemWears(id: number | null) {
  return useQuery({
    queryKey: wardrobeKeys.itemWears(id ?? 0),
    queryFn: async () => {
      const { data } = await api.get<WearEvent[]>(`/wardrobe/items/${id}/wears/`);
      return data;
    },
    enabled: id !== null,
  });
}

/** What was worn on one particular day. */
export function useWearsOn(date: string | null) {
  return useQuery({
    queryKey: wardrobeKeys.wearsOn(date ?? ""),
    queryFn: async () => {
      const { data } = await api.get<Paginated<WearEvent>>("/wardrobe/wears/", {
        params: { on: date, page_size: 100 },
      });
      return data.results;
    },
    enabled: Boolean(date),
  });
}

/** The most recent wearings across the whole closet. */
export function useRecentWears(days: number, limit = 40) {
  return useQuery({
    queryKey: [...wardrobeKeys.wears(), "recent", days, limit] as const,
    queryFn: async () => {
      const { data } = await api.get<Paginated<WearEvent>>("/wardrobe/wears/", {
        params: { days, page_size: limit },
      });
      return data.results;
    },
  });
}

/** How many things were worn on each day, for the month grid. */
export function useWearCalendar(range: WearRange) {
  return useQuery({
    queryKey: wardrobeKeys.wearCalendar(range),
    queryFn: async () => {
      const { data } = await api.get<WearDay[]>("/wardrobe/wears/calendar/", { params: range });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

/** Both of the buttons below change the same three things, so they share this. */
function refreshWearData(queryClient: ReturnType<typeof useQueryClient>, item: Garment) {
  queryClient.setQueryData(wardrobeKeys.item(item.id), item);
  queryClient.invalidateQueries({ queryKey: wardrobeKeys.items() });
  queryClient.invalidateQueries({ queryKey: wardrobeKeys.stats() });
  queryClient.invalidateQueries({ queryKey: wardrobeKeys.wears() });
}

/** Records a wearing, optionally on an earlier day. */
export function useRecordWear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; date?: string; note?: string }) => {
      const { data } = await api.post<Garment>(`/wardrobe/items/${input.id}/mark-worn/`, {
        ...(input.date ? { date: input.date } : {}),
        ...(input.note ? { note: input.note } : {}),
      });
      return data;
    },
    onSuccess: (data) => refreshWearData(queryClient, data),
  });
}

/** Takes a wearing back off the record, for a tap that was not meant. */
export function useForgetWear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; date?: string }) => {
      const { data } = await api.post<Garment>(`/wardrobe/items/${input.id}/unmark-worn/`, {
        ...(input.date ? { date: input.date } : {}),
      });
      return data;
    },
    onSuccess: (data) => refreshWearData(queryClient, data),
  });
}

export function useCreateStorageLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      kind: string;
      parent?: number | null;
      notes?: string;
    }) => {
      const { data } = await api.post<StorageLocation>("/wardrobe/storage/", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wardrobeKeys.storage() });
      queryClient.invalidateQueries({ queryKey: wardrobeKeys.stats() });
    },
    onError: (error) => {
      if (isStaleChoiceError(error)) {
        queryClient.invalidateQueries({ queryKey: wardrobeKeys.storage() });
      }
    },
  });
}

export function useUpdateStorageLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: number;
      name?: string;
      kind?: string;
      parent?: number | null;
      notes?: string;
    }) => {
      const { data } = await api.patch<StorageLocation>(`/wardrobe/storage/${id}/`, payload);
      return data;
    },
    onSuccess: () => {
      // A rename or a move rewrites full_path on everything below it, and every
      // item that names one of those places.
      queryClient.invalidateQueries({ queryKey: wardrobeKeys.all });
    },
    onError: (error) => {
      if (isStaleChoiceError(error)) {
        queryClient.invalidateQueries({ queryKey: wardrobeKeys.storage() });
      }
    },
  });
}

export function useDeleteStorageLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/wardrobe/storage/${id}/`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wardrobeKeys.all });
    },
  });
}
