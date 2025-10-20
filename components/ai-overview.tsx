"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, TrendingUp, TrendingDown, Minus, Loader2, Brain, Zap } from "lucide-react";

interface PostAnalysis {
  id: number;
  stock_symbol: string | null;
  strategy_used: "preprocessed" | "direct";
  comments_included: number;
  comments_preprocessed: number | null;
  executive_summary: string;
  sentiment_breakdown: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  key_arguments: Array<{
    type: "bull" | "bear";
    summary: string;
    quote: string;
  }>;
  thread_quality_score: number;
  notable_quotes: Array<{
    quote: string;
    author: string;
    comment_id: string;
  }>;
  model_used: string;
  tokens_used: number;
  processing_time_seconds: number;
  cost_estimate: number;
  created_at: string;
}

interface AIOverviewProps {
  isLoadingAnalyses: boolean;
  analyses: PostAnalysis[];
  selectedAnalysis: PostAnalysis | null;
  isGenerating: "preprocessed" | "direct" | null;
  onGenerateAnalysis: (strategy: "preprocessed" | "direct") => void;
  onSelectAnalysis: (analysis: PostAnalysis) => void;
}

function getQualityColor(score: number): string {
  if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
  if (score >= 60) return "text-yellow-600 bg-yellow-50 border-yellow-200";
  if (score >= 40) return "text-orange-600 bg-orange-50 border-orange-200";
  return "text-red-600 bg-red-50 border-red-200";
}

export function AIOverview({
  isLoadingAnalyses,
  analyses,
  selectedAnalysis,
  isGenerating,
  onGenerateAnalysis,
  onSelectAnalysis,
}: AIOverviewProps) {
  if (isLoadingAnalyses) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Generate Analysis Buttons */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border">
        <div className="flex-1">
          <h4 className="text-sm font-semibold mb-1">Generate AI Analysis</h4>
          <p className="text-xs text-muted-foreground">
            Test both strategies to compare quality and cost
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => onGenerateAnalysis("preprocessed")}
            disabled={isGenerating !== null}
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            {isGenerating === "preprocessed" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Brain className="h-3.5 w-3.5" />
                Preprocessed
              </>
            )}
          </Button>
          <Button
            onClick={() => onGenerateAnalysis("direct")}
            disabled={isGenerating !== null}
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            {isGenerating === "direct" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                Direct
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Existing Analyses */}
      {analyses.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Previous Analyses</h4>
            <span className="text-xs text-muted-foreground">
              {analyses.length} analysis{analyses.length > 1 ? "es" : ""}
            </span>
          </div>

          {/* Analysis selector tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {analyses.map((analysis) => (
              <button
                key={analysis.id}
                onClick={() => onSelectAnalysis(analysis)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg border text-xs transition-colors ${
                  selectedAnalysis?.id === analysis.id
                    ? "bg-primary/10 border-primary/30 font-semibold"
                    : "bg-card hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-xs">
                    {analysis.strategy_used === "preprocessed" ? (
                      <Brain className="h-3 w-3 mr-1" />
                    ) : (
                      <Zap className="h-3 w-3 mr-1" />
                    )}
                    {analysis.strategy_used}
                  </Badge>
                  <span className="text-muted-foreground">
                    ${analysis.cost_estimate.toFixed(4)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Analysis Display */}
      {selectedAnalysis ? (
        <div className="space-y-4">
          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {selectedAnalysis.stock_symbol && (
              <>
                <Badge variant="default" className="font-semibold">
                  ${selectedAnalysis.stock_symbol}
                </Badge>
                <span>•</span>
              </>
            )}
            <Badge variant="outline">
              {selectedAnalysis.strategy_used === "preprocessed" ? (
                <Brain className="h-3 w-3 mr-1" />
              ) : (
                <Zap className="h-3 w-3 mr-1" />
              )}
              {selectedAnalysis.strategy_used}
            </Badge>
            <span>{selectedAnalysis.comments_included} comments</span>
            <span>•</span>
            <span>{selectedAnalysis.tokens_used.toLocaleString()} tokens</span>
            <span>•</span>
            <span>${selectedAnalysis.cost_estimate.toFixed(4)}</span>
            <span>•</span>
            <span>{selectedAnalysis.processing_time_seconds.toFixed(1)}s</span>
          </div>

          {/* Executive Summary */}
          <div className="rounded-lg border p-4 bg-primary/5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Executive Summary</h4>
            </div>
            <p className="text-sm leading-relaxed">
              {selectedAnalysis.executive_summary}
            </p>
          </div>

          {/* Sentiment Breakdown */}
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-semibold mb-3">Sentiment Breakdown</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 w-20">
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-xs font-medium">Bullish</span>
                </div>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500/80 flex items-center justify-end pr-2"
                    style={{ width: `${selectedAnalysis.sentiment_breakdown.bullish}%` }}
                  >
                    <span className="text-xs font-semibold text-white">
                      {selectedAnalysis.sentiment_breakdown.bullish}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 w-20">
                  <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                  <span className="text-xs font-medium">Bearish</span>
                </div>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500/80 flex items-center justify-end pr-2"
                    style={{ width: `${selectedAnalysis.sentiment_breakdown.bearish}%` }}
                  >
                    <span className="text-xs font-semibold text-white">
                      {selectedAnalysis.sentiment_breakdown.bearish}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 w-20">
                  <Minus className="h-3.5 w-3.5 text-gray-600" />
                  <span className="text-xs font-medium">Neutral</span>
                </div>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-500/80 flex items-center justify-end pr-2"
                    style={{ width: `${selectedAnalysis.sentiment_breakdown.neutral}%` }}
                  >
                    <span className="text-xs font-semibold text-white">
                      {selectedAnalysis.sentiment_breakdown.neutral}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Thread Quality Score */}
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-semibold mb-3">Thread Quality</h4>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-8 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full flex items-center justify-center font-bold transition-all ${getQualityColor(
                    selectedAnalysis.thread_quality_score
                  )}`}
                  style={{ width: `${selectedAnalysis.thread_quality_score}%` }}
                >
                  {selectedAnalysis.thread_quality_score}/100
                </div>
              </div>
            </div>
          </div>

          {/* Key Arguments */}
          {selectedAnalysis.key_arguments.length > 0 && (
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold mb-3">Key Arguments</h4>
              <div className="space-y-3">
                {selectedAnalysis.key_arguments.map((arg, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      arg.type === "bull"
                        ? "bg-green-500/10 border-green-500/30"
                        : "bg-red-500/10 border-red-500/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className={
                          arg.type === "bull"
                            ? "text-green-700 bg-green-500/20 border-green-500/40 font-semibold"
                            : "text-red-700 bg-red-500/20 border-red-500/40 font-semibold"
                        }
                      >
                        {arg.type === "bull" ? (
                          <>
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Bullish
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Bearish
                          </>
                        )}
                      </Badge>
                    </div>
                    <p className="text-sm mb-2">{arg.summary}</p>
                    <blockquote className="text-xs italic text-muted-foreground border-l-2 pl-3">
                      "{arg.quote}"
                    </blockquote>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notable Quotes */}
          {selectedAnalysis.notable_quotes.length > 0 && (
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold mb-3">Notable Quotes</h4>
              <div className="space-y-3">
                {selectedAnalysis.notable_quotes.map((quote, index) => (
                  <div key={index} className="p-3 rounded-lg bg-muted/30 border">
                    <blockquote className="text-sm mb-2 leading-relaxed">
                      "{quote.quote}"
                    </blockquote>
                    <p className="text-xs text-muted-foreground">
                      — u/{quote.author}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : analyses.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <h4 className="text-sm font-semibold mb-1">No analyses yet</h4>
          <p className="text-xs text-muted-foreground mb-4">
            Generate an AI analysis to extract insights from this discussion
          </p>
        </div>
      ) : null}
    </div>
  );
}
