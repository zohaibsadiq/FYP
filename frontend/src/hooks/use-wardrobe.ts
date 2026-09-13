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
function useItemAction(path: string) {
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
    },
  });
}

export const useMarkWorn = () => useItemAction("mark-worn");
export const useToggleLaundry = () => useItemAction("toggle-laundry");
export const useToggleFavorite = () => useItemAction("toggle-favorite");

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
