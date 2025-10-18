"use client";

import { Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePinnedStocks } from "@/hooks/use-pinned-stocks";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

interface PinButtonProps {
  symbol: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
}

export function PinButton({ symbol, variant = "ghost", size = "sm", showLabel = false }: PinButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { isPinned, togglePin, isPinning, isUnpinning } = usePinnedStocks();

  const pinned = isPinned(symbol);
  const loading = isPinning || isUnpinning;

  const handleClick = async () => {
    if (!session) {
      router.push("/sign-in");
      return;
    }

    try {
      await togglePin(symbol);
    } catch (error) {
      console.error("Error toggling pin:", error);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={loading}
      className="group transition-all duration-300 hover:scale-105"
    >
      {pinned ? (
        <PinOff className="h-4 w-4 text-primary group-hover:text-accent-foreground transition-all duration-300 group-hover:rotate-12" />
      ) : (
        <Pin className="h-4 w-4 text-muted-foreground group-hover:text-accent-foreground transition-all duration-300 group-hover:rotate-12" />
      )}
      {showLabel && (
        <span className="ml-2">
          {loading ? "..." : pinned ? "Unpin" : "Pin"}
        </span>
      )}
    </Button>
  );
}
