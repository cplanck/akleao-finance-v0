import { Badge } from "@/components/ui/badge";

interface TickerBadgeProps {
  symbol: string;
  className?: string;
}

export function TickerBadge({ symbol, className = "" }: TickerBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={`font-mono text-xs ${className}`}
    >
      ${symbol}
    </Badge>
  );
}
