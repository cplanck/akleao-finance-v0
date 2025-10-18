"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ClockIcon } from "lucide-react";

interface MarketStatusData {
  market: "open" | "closed" | "extended-hours";
  afterHours: boolean;
  earlyHours: boolean;
  exchanges: {
    nasdaq: string;
    nyse: string;
    otc: string;
  };
  serverTime: string;
}

export function MarketStatus() {
  const [status, setStatus] = useState<MarketStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/market/status");
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error("Error fetching market status:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    // Refresh every minute
    const interval = setInterval(fetchStatus, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Update current time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getMarketStatusInfo = () => {
    if (!status) return null;

    const isOpen = status.market === "open";
    const isAfterHours = status.afterHours;
    const isPreMarket = status.earlyHours;

    // US Stock Market Hours (ET)
    const marketOpen = "9:30 AM ET";
    const marketClose = "4:00 PM ET";
    const preMarketOpen = "4:00 AM ET";
    const afterHoursClose = "8:00 PM ET";

    if (isOpen) {
      return {
        status: "Open",
        message: `Market closes at ${marketClose}`,
        variant: "default" as const,
        color: "text-green-600 dark:text-green-400",
        badgeClass: "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-lg shadow-green-500/30 animate-pulse",
        iconClass: "text-green-500 animate-pulse",
      };
    }

    if (isPreMarket) {
      return {
        status: "Pre-Market",
        message: `Market opens at ${marketOpen}`,
        variant: "secondary" as const,
        color: "text-blue-600 dark:text-blue-400",
        badgeClass: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 shadow-md shadow-blue-500/20",
        iconClass: "text-blue-500",
      };
    }

    if (isAfterHours) {
      return {
        status: "After Hours",
        message: `Extended hours until ${afterHoursClose}`,
        variant: "secondary" as const,
        color: "text-blue-600 dark:text-blue-400",
        badgeClass: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 shadow-md shadow-blue-500/20",
        iconClass: "text-blue-500",
      };
    }

    // Check if it's a weekday
    const now = new Date();
    const day = now.getDay();
    const isWeekend = day === 0 || day === 6;

    if (isWeekend) {
      return {
        status: "Closed",
        message: "Market opens Monday at " + marketOpen,
        variant: "outline" as const,
        color: "text-muted-foreground",
        badgeClass: "bg-slate-500/20 text-slate-400 dark:text-slate-300 backdrop-blur-sm border-slate-500/30",
        iconClass: "text-slate-400 dark:text-slate-300",
      };
    }

    // Weekday but closed - check time
    const hour = now.getHours();
    if (hour < 9) {
      return {
        status: "Closed",
        message: `Pre-market starts at ${preMarketOpen}`,
        variant: "outline" as const,
        color: "text-muted-foreground",
        badgeClass: "bg-slate-500/20 text-slate-400 dark:text-slate-300 backdrop-blur-sm border-slate-500/30",
        iconClass: "text-slate-400 dark:text-slate-300",
      };
    } else {
      return {
        status: "Closed",
        message: `Market opens tomorrow at ${marketOpen}`,
        variant: "outline" as const,
        color: "text-muted-foreground",
        badgeClass: "bg-slate-500/20 text-slate-400 dark:text-slate-300 backdrop-blur-sm border-slate-500/30",
        iconClass: "text-slate-400 dark:text-slate-300",
      };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <div className="h-5 w-20 bg-gradient-to-r from-muted via-muted/50 to-muted animate-pulse rounded-full" />
      </div>
    );
  }

  const statusInfo = getMarketStatusInfo();

  if (!statusInfo) return null;

  return (
    <div className="flex items-center gap-2 text-sm group">
      <ClockIcon className={`h-4 w-4 ${statusInfo.iconClass} transition-transform duration-300 group-hover:scale-110`} />
      <Badge className={`text-xs font-semibold transition-all duration-300 ${statusInfo.badgeClass}`}>
        {statusInfo.status}
      </Badge>
      <span className="text-muted-foreground hidden sm:inline font-medium transition-colors duration-300 group-hover:text-foreground/80">
        {statusInfo.message}
      </span>
      <span className="text-muted-foreground ml-auto font-mono text-xs tabular-nums px-2 py-1 rounded-md bg-muted/30 backdrop-blur-sm border border-muted-foreground/10">
        {currentTime.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        })}
      </span>
    </div>
  );
}
