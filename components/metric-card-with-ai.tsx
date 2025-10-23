"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  description: string;
  context?: string;
}

async function fetchExplanation(metric: string, value: string, context?: string, detailed = false) {
  const response = await fetch("/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metric, value, context, detailed }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch explanation");
  }

  const data = await response.json();
  return data.explanation;
}

async function fetchAnalysis(metric: string, value: string, context?: string) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metric, value, context }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch analysis");
  }

  return response.json();
}

export default function MetricCardWithAI({
  label,
  value,
  description,
  context,
}: MetricCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetailed, setShowDetailed] = useState(false);

  // Fetch contextual analysis (good/bad/neutral)
  const { data: analysis } = useQuery({
    queryKey: ["analysis", label, value, context],
    queryFn: () => fetchAnalysis(label, value, context),
    staleTime: Infinity,
  });

  const { data: explanation, isLoading } = useQuery({
    queryKey: ["explanation", label, value, context, false],
    queryFn: () => fetchExplanation(label, value, context, false),
    enabled: isOpen, // Only fetch when popover is opened
    staleTime: Infinity, // Cache forever - explanations don't change
  });

  const { data: detailedExplanation, isLoading: isLoadingDetailed } = useQuery({
    queryKey: ["explanation", label, value, context, true],
    queryFn: () => fetchExplanation(label, value, context, true),
    enabled: isOpen && showDetailed, // Only fetch detailed when requested
    staleTime: Infinity,
  });

  const getSentimentConfig = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return {
          icon: TrendingUp,
          className: "bg-green-500/10 text-green-600 border-green-500/20",
        };
      case "negative":
        return {
          icon: TrendingDown,
          className: "bg-red-500/10 text-red-600 border-red-500/20",
        };
      default:
        return {
          icon: Minus,
          className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        };
    }
  };

  const sentimentConfig = getSentimentConfig(analysis?.sentiment);

  return (
    <Card className="relative group">
      <CardHeader className="pb-1.5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            {label}
          </CardTitle>
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 opacity-0 sm:group-hover:opacity-100 sm:transition-opacity sm:opacity-0 opacity-60"
              >
                <Sparkles className="h-3 w-3 text-blue-500" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 md:w-96" align="end" side="top" sideOffset={5}>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <h4 className="font-semibold text-sm">AI Explanation</h4>
                </div>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating explanation...
                  </div>
                ) : (
                  <>
                    <p className="text-sm leading-relaxed">{explanation}</p>

                    {!showDetailed ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDetailed(true)}
                        className="w-full text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                      >
                        Learn More →
                      </Button>
                    ) : (
                      <div className="space-y-2 pt-2 border-t">
                        {isLoadingDetailed ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading detailed explanation...
                          </div>
                        ) : (
                          <>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {detailedExplanation}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowDetailed(false)}
                              className="w-full text-xs"
                            >
                              Show Less ↑
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-1.5">
          <div className="text-lg sm:text-xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
          {analysis && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-normal gap-1 flex items-center w-fit",
                sentimentConfig.className
              )}
            >
              {sentimentConfig.icon && (
                <sentimentConfig.icon className="h-2.5 w-2.5" />
              )}
              <span className="line-clamp-1">{analysis.brief}</span>
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
