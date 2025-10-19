"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Target } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ResearchReport {
  id: number;
  stock_symbol: string;
  title: string;
  status: string;
  progress_percentage: number;
  executive_summary?: string;
  section_overview?: string;
  section_financials?: string;
  section_sentiment?: string;
  section_risks?: string;
  section_opportunities?: string;
  section_recommendation?: string;
  section_references?: string;
  recommendation?: string;
  investment_score?: number;
  risk_level?: string;
  target_price?: number;
  created_at: string;
  completed_at?: string;
}

interface ResearchReportViewerProps {
  reportId: number;
}

export function ResearchReportViewer({ reportId }: ResearchReportViewerProps) {
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await fetch(`/api/research/${reportId}`);

        if (!response.ok) {
          throw new Error("Failed to fetch report");
        }

        const data = await response.json();
        setReport(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs text-destructive font-mono">Error loading report: {error || "Report not found"}</p>
      </div>
    );
  }

  const getRecommendationIcon = () => {
    if (report.recommendation === "buy") return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (report.recommendation === "sell") return <TrendingDown className="h-5 w-5 text-red-500" />;
    return <Target className="h-5 w-5 text-yellow-500" />;
  };

  const getRiskColor = (risk?: string) => {
    if (risk === "low") return "bg-green-500/10 text-green-500 border-green-500/20";
    if (risk === "high") return "bg-red-500/10 text-red-500 border-red-500/20";
    return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
  };

  return (
    <div className="max-h-[600px] overflow-y-auto font-mono text-xs space-y-4 pr-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-border/50">
        <div className="space-y-1">
          <h3 className="font-semibold text-sm">{report.stock_symbol} Research Report</h3>
          <p className="text-[10px] text-muted-foreground">
            {new Date(report.created_at).toLocaleDateString()}
          </p>
        </div>
        {/* Key Metrics - Compact */}
        <div className="flex items-center gap-2 text-[10px]">
          {report.recommendation && (
            <Badge variant="outline" className="gap-1 px-1.5 py-0 h-5">
              {report.recommendation === "buy" && <TrendingUp className="h-2.5 w-2.5 text-green-500" />}
              {report.recommendation === "sell" && <TrendingDown className="h-2.5 w-2.5 text-red-500" />}
              {report.recommendation !== "buy" && report.recommendation !== "sell" && <Target className="h-2.5 w-2.5" />}
              <span className="capitalize">{report.recommendation}</span>
            </Badge>
          )}
          {report.investment_score !== null && report.investment_score !== undefined && (
            <Badge variant="secondary" className="px-1.5 py-0 h-5">
              {report.investment_score}/100
            </Badge>
          )}
          {report.risk_level && (
            <Badge variant="outline" className={`px-1.5 py-0 h-5 ${getRiskColor(report.risk_level)}`}>
              {report.risk_level}
            </Badge>
          )}
        </div>
      </div>

      {/* Full Report as Markdown - New Order */}
      {/* 1. World Context */}
      {report.section_overview && (
        <div className="prose prose-xs dark:prose-invert max-w-none [&>*]:text-[11px] [&>*]:leading-relaxed [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-xs [&_h3]:font-semibold">
          <ReactMarkdown>{report.section_overview}</ReactMarkdown>
        </div>
      )}

      {/* 2. The Macro Thesis */}
      {report.section_financials && (
        <div className="prose prose-xs dark:prose-invert max-w-none [&>*]:text-[11px] [&>*]:leading-relaxed [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-xs [&_h3]:font-semibold">
          <ReactMarkdown>{report.section_financials}</ReactMarkdown>
        </div>
      )}

      {/* 3. Catalysts & Opportunities */}
      {report.section_opportunities && (
        <div className="prose prose-xs dark:prose-invert max-w-none [&>*]:text-[11px] [&>*]:leading-relaxed [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-xs [&_h3]:font-semibold">
          <ReactMarkdown>{report.section_opportunities}</ReactMarkdown>
        </div>
      )}

      {/* 4. What Could Go Wrong */}
      {report.section_risks && (
        <div className="prose prose-xs dark:prose-invert max-w-none [&>*]:text-[11px] [&>*]:leading-relaxed [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-xs [&_h3]:font-semibold">
          <ReactMarkdown>{report.section_risks}</ReactMarkdown>
        </div>
      )}

      {/* 5. The Verdict */}
      {report.section_recommendation && (
        <div className="prose prose-xs dark:prose-invert max-w-none [&>*]:text-[11px] [&>*]:leading-relaxed [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-xs [&_h3]:font-semibold">
          <ReactMarkdown>{report.section_recommendation}</ReactMarkdown>
        </div>
      )}

      {/* 6. Research Process */}
      {report.section_sentiment && (
        <div className="prose prose-xs dark:prose-invert max-w-none [&>*]:text-[11px] [&>*]:leading-relaxed [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-xs [&_h3]:font-semibold">
          <ReactMarkdown>{report.section_sentiment}</ReactMarkdown>
        </div>
      )}

      {/* 7. Sources */}
      {report.section_references && (
        <div className="prose prose-xs dark:prose-invert max-w-none [&>*]:text-[11px] [&>*]:leading-relaxed [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-xs [&_h3]:font-semibold">
          <ReactMarkdown>{report.section_references}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function ReportSection({ title, content }: { title: string; content: string }) {
  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-[11px] text-primary uppercase tracking-wide">{title}</h4>
      <div className="prose prose-xs dark:prose-invert max-w-none [&>*]:text-[11px] [&>*]:leading-relaxed">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
