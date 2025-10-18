import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";

interface PinnedStock {
  symbol: string;
  position: number;
  pinned_at: Date;
}

export function usePinnedStocks() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["pinnedStocks", session?.user?.id],
    queryFn: async () => {
      const response = await fetch("/api/pinned-stocks");
      if (!response.ok) {
        throw new Error("Failed to fetch pinned stocks");
      }
      const data = await response.json();
      return data.pinnedStocks as PinnedStock[];
    },
    enabled: !!session?.user,
  });

  const pinMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const response = await fetch("/api/pinned-stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      if (!response.ok) {
        throw new Error("Failed to pin stock");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pinnedStocks"] });
    },
  });

  const unpinMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const response = await fetch(`/api/pinned-stocks?symbol=${symbol}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to unpin stock");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pinnedStocks"] });
    },
  });

  const isPinned = (symbol: string) => {
    return data?.some((stock) => stock.symbol === symbol.toUpperCase()) ?? false;
  };

  const togglePin = async (symbol: string) => {
    if (isPinned(symbol)) {
      await unpinMutation.mutateAsync(symbol);
    } else {
      await pinMutation.mutateAsync(symbol);
    }
  };

  return {
    pinnedStocks: data ?? [],
    isLoading,
    error,
    pin: pinMutation.mutateAsync,
    unpin: unpinMutation.mutateAsync,
    togglePin,
    isPinned,
    isPinning: pinMutation.isPending,
    isUnpinning: unpinMutation.isPending,
  };
}
