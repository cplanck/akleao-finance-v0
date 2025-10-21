"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";

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
        status: "Market Open",
        message: `Closes at ${marketClose}`,
        variant: "default" as const,
        color: "text-green-600 dark:text-green-400",
        badgeClass: "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md shadow-green-500/20",
        iconClass: "text-green-500",
      };
    }

    if (isPreMarket) {
      return {
        status: "Market Pre-Market",
        message: `Opens at ${marketOpen}`,
        variant: "secondary" as const,
        color: "text-blue-600 dark:text-blue-400",
        badgeClass: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 shadow-md shadow-blue-500/20",
        iconClass: "text-blue-500",
      };
    }

    if (isAfterHours) {
      return {
        status: "Market After Hours",
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
        status: "Market Closed",
        message: "Opens Monday at " + marketOpen,
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
        status: "Market Closed",
        message: `Pre-market starts at ${preMarketOpen}`,
        variant: "outline" as const,
        color: "text-muted-foreground",
        badgeClass: "bg-slate-500/20 text-slate-400 dark:text-slate-300 backdrop-blur-sm border-slate-500/30",
        iconClass: "text-slate-400 dark:text-slate-300",
      };
    } else {
      return {
        status: "Market Closed",
        message: `Opens tomorrow at ${marketOpen}`,
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

  const formatCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });
  };

  const isOpen = status?.market === "open";
  const isPreMarket = status?.earlyHours;
  const isAfterHours = status?.afterHours;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge className={`text-xs font-semibold transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${statusInfo.badgeClass}`}>
          {statusInfo.status}
          <Info className="h-3 w-3 opacity-70 hover:opacity-100 transition-opacity" />
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm mb-1">Market Status</h4>
            <p className={`text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.status}
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Time</span>
              <span className="font-medium">{formatCurrentTime()}</span>
            </div>

            <div className="border-t pt-2 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pre-Market</span>
                <span className="font-medium">4:00 AM - 9:30 AM ET</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Regular Hours</span>
                <span className="font-medium">9:30 AM - 4:00 PM ET</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">After Hours</span>
                <span className="font-medium">4:00 PM - 8:00 PM ET</span>
              </div>
            </div>

            {isOpen && (
              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Market Closes</span>
                  <span className="font-medium">4:00 PM ET</span>
                </div>
              </div>
            )}

            {isPreMarket && (
              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Market Opens</span>
                  <span className="font-medium">9:30 AM ET</span>
                </div>
              </div>
            )}

            {isAfterHours && (
              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Extended Hours End</span>
                  <span className="font-medium">8:00 PM ET</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
