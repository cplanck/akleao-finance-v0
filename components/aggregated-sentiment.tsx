"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, Target, BarChart3, CheckCircle2, AlertCircle, Calendar } from "lucide-react";

interface AggregatedSentiment {
  aggregated_sentiment: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  confidence_score: number;
  overall_take: string;
  key_themes: {
    bullish: string[];
    bearish: string[];
  };
  coverage: {
    total_analyses: number;
    total_comments: number;
    total_posts: number;
    date_range?: {
      oldest: string;
      newest: string;
    };
  };
  conviction_rating?: "high" | "medium" | "low";
  notable_divergences?: string | null;
}

interface AggregatedSentimentProps {
  data: AggregatedSentiment | null;
  isLoading: boolean;
  symbol: string;
}

function getConfidenceColor(score: number): string {
  if (score >= 70) return "text-green-600 bg-green-500/20 border-green-500/40";
  if (score >= 40) return "text-yellow-600 bg-yellow-500/20 border-yellow-500/40";
  return "text-red-600 bg-red-500/20 border-red-500/40";
}

function getConfidenceLabel(score: number): string {
  if (score >= 70) return "High Confidence";
  if (score >= 40) return "Moderate Confidence";
  return "Low Confidence";
}

function getDominantSentiment(sentiment: { bullish: number; bearish: number; neutral: number }) {
  if (sentiment.bullish > sentiment.bearish + 10) {
    return { label: "Bullish", icon: TrendingUp, color: "text-green-600" };
  } else if (sentiment.bearish > sentiment.bullish + 10) {
    return { label: "Bearish", icon: TrendingDown, color: "text-red-600" };
  } else {
    return { label: "Neutral", icon: Minus, color: "text-gray-600" };
  }
}

export function AggregatedSentiment({ data, isLoading, symbol }: AggregatedSentimentProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No aggregated analysis available</p>
        <p className="text-xs mt-1">Generate analyses to see aggregated insights</p>
      </div>
    );
  }

  const dominant = getDominantSentiment(data.aggregated_sentiment);
  const DominantIcon = dominant.icon;

  return (
    <div className="space-y-3">
      {/* Overall Take Header */}
      <Card className="p-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-background border ${dominant.color}`}>
            <DominantIcon className={`h-5 w-5 ${dominant.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold">Community Consensus</h3>
              <Badge variant="outline" className={getConfidenceColor(data.confidence_score)}>
                <Target className="h-3 w-3 mr-1" />
                {getConfidenceLabel(data.confidence_score)}
              </Badge>
            </div>
            <p className="text-sm leading-relaxed">{data.overall_take}</p>
            {data.notable_divergences && (
              <div className="mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-2">
                <AlertCircle className="h-3 w-3 text-yellow-600 mt-0.5 shrink-0" />
                <p className="text-xs text-yellow-700">{data.notable_divergences}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Aggregated Sentiment Bars */}
      <Card className="p-4">
        <h4 className="text-xs font-semibold mb-3 flex items-center gap-1">
          <BarChart3 className="h-3 w-3" />
          Aggregated Sentiment
        </h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-green-600" />
            <span className="text-xs font-medium w-16">Bullish</span>
            <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 flex items-center justify-end pr-2 transition-all"
                style={{ width: `${data.aggregated_sentiment.bullish}%` }}
              >
                <span className="text-xs font-bold text-white">
                  {data.aggregated_sentiment.bullish}%
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-3.5 w-3.5 text-red-600" />
            <span className="text-xs font-medium w-16">Bearish</span>
            <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 flex items-center justify-end pr-2 transition-all"
                style={{ width: `${data.aggregated_sentiment.bearish}%` }}
              >
                <span className="text-xs font-bold text-white">
                  {data.aggregated_sentiment.bearish}%
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Minus className="h-3.5 w-3.5 text-gray-600" />
            <span className="text-xs font-medium w-16">Neutral</span>
            <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-500 flex items-center justify-end pr-2 transition-all"
                style={{ width: `${data.aggregated_sentiment.neutral}%` }}
              >
                <span className="text-xs font-bold text-white">
                  {data.aggregated_sentiment.neutral}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Key Themes */}
      {(data.key_themes.bullish.length > 0 || data.key_themes.bearish.length > 0) && (
        <Card className="p-4">
          <h4 className="text-xs font-semibold mb-3">Key Themes Across Discussions</h4>
          <div className="space-y-3">
            {data.key_themes.bullish.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-xs font-semibold text-green-700">Bullish Arguments</span>
                </div>
                <ul className="space-y-1.5">
                  {data.key_themes.bullish.map((theme, idx) => (
                    <li key={idx} className="text-xs flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5 shrink-0" />
                      <span className="leading-relaxed">{theme}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.key_themes.bearish.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown className="h-3 w-3 text-red-600" />
                  <span className="text-xs font-semibold text-red-700">Bearish Arguments</span>
                </div>
                <ul className="space-y-1.5">
                  {data.key_themes.bearish.map((theme, idx) => (
                    <li key={idx} className="text-xs flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 text-red-600 mt-0.5 shrink-0" />
                      <span className="leading-relaxed">{theme}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Coverage Info */}
      <Card className="p-3 bg-muted/30">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Discussions</p>
            <p className="text-lg font-bold">{data.coverage.total_analyses}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Comments</p>
            <p className="text-lg font-bold">{data.coverage.total_comments.toLocaleString()}</p>
          </div>
        </div>
        {data.coverage.date_range && (
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {new Date(data.coverage.date_range.newest).toLocaleDateString()} -{" "}
              {new Date(data.coverage.date_range.oldest).toLocaleDateString()}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
