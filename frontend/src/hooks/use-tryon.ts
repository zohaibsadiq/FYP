"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Paginated } from "@/types";
import type { BodyPhotoState, TryOn, TryOnAvailability } from "@/types/tryon";

const tryOnKeys = {
  all: ["try-on"] as const,
  list: () => [...tryOnKeys.all, "list"] as const,
  bodyPhoto: () => [...tryOnKeys.all, "body-photo"] as const,
  availability: () => [...tryOnKeys.all, "availability"] as const,
};

export function useBodyPhoto() {
  return useQuery({
    queryKey: tryOnKeys.bodyPhoto(),
    queryFn: async () => (await api.get<BodyPhotoState>("/try-on/body-photo/")).data,
  });
}

export function useTryOnAvailability() {
  return useQuery({
    queryKey: tryOnKeys.availability(),
    queryFn: async () => (await api.get<TryOnAvailability>("/try-on/status/")).data,
  });
}

/**
 * A picture takes two to four minutes to make on the supplier's side, so the
 * list is re-read every six seconds while anything is still waiting, and left
 * alone once nothing is.
 */
export function useTryOns() {
  return useQuery({
    queryKey: tryOnKeys.list(),
    queryFn: async () => {
      const { data } = await api.get<Paginated<TryOn>>("/try-on/");
      return data.results ?? [];
    },
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      return rows.some((row) => row.status === "PENDING") ? 6000 : false;
    },
  });
}

function useTryOnAction<TArgs, TResult>(run: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tryOnKeys.all }),
  });
}

export function useSaveBodyPhoto() {
  return useTryOnAction(async (file: File) => {
    const form = new FormData();
    form.append("image", file);
    form.append("consent", "true");
    const { data } = await api.post<BodyPhotoState>("/try-on/body-photo/", form);
    return data;
  });
}

export function useDeleteBodyPhoto() {
  return useTryOnAction(async () => {
    await api.delete("/try-on/body-photo/");
  });
}

export function useAskForTryOn() {
  return useTryOnAction(async (itemId: number) => {
    const { data } = await api.post<TryOn>("/try-on/", { item: itemId });
    return data;
  });
}

/** A photograph that is not in the closet, so the body part has to come with it. */
export function useTryOnUpload() {
  return useTryOnAction(
    async ({ file, slot, saveAs }: { file: File; slot: string; saveAs: string }) => {
      const form = new FormData();
      form.append("image", file);
      form.append("garment_slot", slot);
      if (saveAs) form.append("save_as", saveAs);
      const { data } = await api.post<TryOn>("/try-on/", form);
      return data;
    },
  );
}

export function useDeleteTryOn() {
  return useTryOnAction(async (id: number) => {
    await api.delete(`/try-on/${id}/`);
  });
}
