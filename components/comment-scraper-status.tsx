"use client";

import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, MessageSquare } from "lucide-react";

interface CommentScraperStatusProps {
  currentPost?: {
    post_id: string;
    subreddit: string;
    title: string;
    existing_comments: number;
    new_comments: number;
    started_at: string;
  } | null;
}

export function CommentScraperStatus({ currentPost }: CommentScraperStatusProps) {
  return (
    <div className="space-y-3">
      {currentPost ? (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-ping" />
                <div className="font-semibold text-sm">
                  r/{currentPost.subreddit}
                </div>
                <span className="text-muted-foreground font-mono text-xs">
                  {currentPost.post_id}
                </span>
              </div>
              <div className="text-xs text-muted-foreground line-clamp-2 mb-2 font-medium">
                {currentPost.title}
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  <span className="font-semibold">{currentPost.existing_comments}</span>
                  <span className="text-muted-foreground/70">existing</span>
                </span>
                {currentPost.new_comments > 0 && (
                  <span className="text-green-500 flex items-center gap-1 font-semibold">
                    <span>+{currentPost.new_comments}</span>
                    <span className="text-green-500/70">new</span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex-shrink-0">
              <Loader2 className="h-5 w-5 animate-spin text-green-500" />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-muted/30 border border-primary/5">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">
                Processing next post...
              </div>
              <div className="text-xs text-muted-foreground/70 mt-1">
                Continuous loop with 2s delay between posts
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
