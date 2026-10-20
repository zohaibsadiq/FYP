"use client";

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Paginated } from "@/types";
import type {
  Block,
  Condition,
  Enquiry,
  Listing,
  ListingFilters,
  ListingPayload,
  MarketplaceStats,
  MyListing,
  PriceSuggestion,
} from "@/types/market";

// Hierarchical, so invalidating ["market"] after a sale clears the browse
// page, my listings and both sides' requests in one go.
export const marketKeys = {
  all: ["market"] as const,
  listings: () => [...marketKeys.all, "listings"] as const,
  listingList: (filters: ListingFilters) => [...marketKeys.listings(), filters] as const,
  mine: () => [...marketKeys.all, "mine"] as const,
  sent: () => [...marketKeys.all, "sent"] as const,
  received: () => [...marketKeys.all, "received"] as const,
  blocks: () => [...marketKeys.all, "blocks"] as const,
  stats: () => [...marketKeys.all, "stats"] as const,
  suggestion: (item: number, condition: Condition) =>
    [...marketKeys.all, "suggestion", item, condition] as const,
};

function cleanParams(filters: ListingFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== undefined && value !== "" && value !== false,
    ),
  );
}

export function useListings(filters: ListingFilters = {}) {
  return useInfiniteQuery({
    queryKey: marketKeys.listingList(filters),
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get<Paginated<Listing>>("/market/listings/", {
        params: { ...cleanParams(filters), page: pageParam },
      });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (last, loaded) => (last.next ? loaded.length + 1 : undefined),
    // Without this the grid empties on every filter change and the page jumps.
    placeholderData: keepPreviousData,
  });
}

export function useMyListings() {
  return useQuery({
    queryKey: marketKeys.mine(),
    queryFn: async () => {
      const { data } = await api.get<Paginated<MyListing>>("/market/my-listings/", {
        params: { page_size: 100 },
      });
      return data.results;
    },
  });
}

export function useMyEnquiries() {
  return useQuery({
    queryKey: marketKeys.sent(),
    queryFn: async () => {
      const { data } = await api.get<Paginated<Enquiry>>("/market/my-enquiries/");
      return data.results;
    },
  });
}

export function useReceivedEnquiries() {
  return useQuery({
    queryKey: marketKeys.received(),
    queryFn: async () => {
      const { data } = await api.get<Paginated<Enquiry>>("/market/enquiries-received/");
      return data.results;
    },
  });
}

export function useMarketStats() {
  return useQuery({
    queryKey: marketKeys.stats(),
    queryFn: async () => {
      const { data } = await api.get<MarketplaceStats>("/market/stats/");
      return data;
    },
  });
}

export function useBlocks() {
  return useQuery({
    queryKey: marketKeys.blocks(),
    queryFn: async () => {
      const { data } = await api.get<Paginated<Block>>("/market/blocks/");
      return data.results;
    },
  });
}

/** What a garment might fetch. Only asked for once a condition has been chosen. */
export function usePriceSuggestion(item: number | null, condition: Condition) {
  return useQuery({
    queryKey: marketKeys.suggestion(item ?? 0, condition),
    queryFn: async () => {
      const { data } = await api.get<PriceSuggestion>("/market/price-suggestion/", {
        params: { item, condition },
      });
      return data;
    },
    enabled: item !== null,
  });
}

/** Everything a sale touches: the listings, both sides' requests, and the closet. */
function useRefreshEverything() {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: marketKeys.all });
    client.invalidateQueries({ queryKey: ["wardrobe"] });
  };
}

export function useCreateListing() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: async (payload: ListingPayload) => {
      const { data } = await api.post<MyListing>("/market/my-listings/", payload);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useUpdateListing() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ListingPayload> & { id: number }) => {
      const { data } = await api.patch<MyListing>(`/market/my-listings/${id}/`, payload);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useMarkSold() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<MyListing>(`/market/my-listings/${id}/sold/`);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useWithdrawListing() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<MyListing>(`/market/my-listings/${id}/withdraw/`);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useEnquire() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: async ({ listing, message }: { listing: number; message: string }) => {
      const { data } = await api.post<Enquiry>(`/market/listings/${listing}/enquire/`, {
        message,
      });
      return data;
    },
    onSuccess: refresh,
  });
}

export function useAnswerEnquiry() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: async ({ id, answer }: { id: number; answer: "accept" | "decline" }) => {
      const { data } = await api.post<Enquiry>(`/market/enquiries-received/${id}/${answer}/`);
      return data;
    },
    onSuccess: refresh,
  });
}

/**
 * Withdrawing deletes the row rather than marking it, so the
 * listing offers its button again and the same person can ask another day.
 */
export function useWithdrawEnquiry() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/market/my-enquiries/${id}/withdraw/`);
    },
    onSuccess: refresh,
  });
}

export function useBlockPerson() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: async (blocked: number) => {
      const { data } = await api.post<Block>("/market/blocks/", { blocked });
      return data;
    },
    onSuccess: refresh,
  });
}

export function useReportListing() {
  return useMutation({
    mutationFn: async ({
      listing,
      reason,
      note,
    }: {
      listing: number;
      reason: string;
      note?: string;
    }) => {
      const { data } = await api.post(`/market/listings/${listing}/report/`, { reason, note });
      return data;
    },
  });
}
