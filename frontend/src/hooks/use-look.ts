"use client";

import { useMutation } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { LookResult } from "@/types/look";

/**
 * Sends a photo of an outfit and gets back what is in it, matched against the
 * closet. Nothing is stored: the answer carries its own preview.
 */
export function useCopyLook() {
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

      const { data } = await api.post<LookResult>("/intelligence/look/", form, {
        // Cutting the subject out of the photo runs inside the request, and the
        // first one on a cold server also downloads the model.
        timeout: 180_000,
        onUploadProgress: (event) => {
          if (onProgress && event.total) {
            onProgress(Math.round((event.loaded * 100) / event.total));
          }
        },
      });
      return data;
    },
  });
}
