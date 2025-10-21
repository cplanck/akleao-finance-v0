import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface PinnedStock {
  symbol: string;
  position: number;
  pinned_at: Date;
}

const PINNED_STOCKS_KEY = "pinnedStocks";

// Helper functions for localStorage
const getPinnedStocksFromStorage = (): PinnedStock[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(PINNED_STOCKS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const savePinnedStocksToStorage = (stocks: PinnedStock[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PINNED_STOCKS_KEY, JSON.stringify(stocks));
  } catch (error) {
    console.error("Failed to save pinned stocks:", error);
  }
};

export function usePinnedStocks() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["pinnedStocks"],
    queryFn: async () => {
      // Use localStorage for now until authentication is fully set up
      return getPinnedStocksFromStorage();
    },
  });

  const pinMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const currentStocks = getPinnedStocksFromStorage();
      const newStock: PinnedStock = {
        symbol: symbol.toUpperCase(),
        position: currentStocks.length,
        pinned_at: new Date(),
      };
      const updatedStocks = [...currentStocks, newStock];
      savePinnedStocksToStorage(updatedStocks);
      return newStock;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pinnedStocks"] });
    },
  });

  const unpinMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const currentStocks = getPinnedStocksFromStorage();
      const updatedStocks = currentStocks.filter(
        (stock) => stock.symbol !== symbol.toUpperCase()
      );
      savePinnedStocksToStorage(updatedStocks);
      return { symbol };
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
