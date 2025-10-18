"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  Key,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Loader2
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

interface OpenAIUsage {
  has_api_key: boolean;
  total_requests: number;
  total_tokens: number;
  estimated_cost: number;
  last_used: string | null;
  requests_30d: number;
  tokens_30d: number;
  cost_30d: number;
}

async function fetchOpenAIUsage(): Promise<OpenAIUsage> {
  const response = await fetch("/api/openai/usage");
  if (!response.ok) {
    throw new Error("Failed to fetch OpenAI usage");
  }
  return response.json();
}

export function OpenAISettingsCard() {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const { data: usage, isLoading } = useQuery({
    queryKey: ["openai-usage"],
    queryFn: fetchOpenAIUsage,
    enabled: !!session,
    refetchInterval: 60000, // Refetch every minute
  });

  const saveKeyMutation = useMutation({
    mutationFn: async (key: string) => {
      const response = await fetch("/api/openai/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save API key");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openai-usage"] });
      setApiKey("");
      setIsEditing(false);
      setShowApiKey(false);
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/openai/key", {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete API key");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openai-usage"] });
      setApiKey("");
      setIsEditing(false);
    },
  });

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      saveKeyMutation.mutate(apiKey.trim());
    }
  };

  const handleDeleteKey = () => {
    if (confirm("Are you sure you want to remove your OpenAI API key?")) {
      deleteKeyMutation.mutate();
    }
  };

  if (!session) {
    return (
      <Card className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            OpenAI Integration
          </CardTitle>
          <CardDescription>Sign in to configure OpenAI settings</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push("/sign-in")} variant="outline" className="w-full">
            Sign In
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10 shadow-xl hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 group">
      {/* Ambient gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              OpenAI Integration
            </CardTitle>
            <CardDescription className="mt-1">
              Configure your OpenAI API key for ML features
            </CardDescription>
          </div>
          {usage?.has_api_key ? (
            <Badge className="bg-green-500">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Active
            </Badge>
          ) : (
            <Badge variant="outline">
              <XCircle className="h-3 w-3 mr-1" />
              Not Configured
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 relative z-10">
        {/* API Key Configuration */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              API Key
            </label>
            {usage?.has_api_key && !isEditing && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  Update Key
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDeleteKey}
                  disabled={deleteKeyMutation.isPending}
                >
                  {deleteKeyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Remove"
                  )}
                </Button>
              </div>
            )}
          </div>

          {(!usage?.has_api_key || isEditing) && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveKey}
                  disabled={!apiKey.trim() || saveKeyMutation.isPending}
                  className="flex-1"
                >
                  {saveKeyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Save Key
                </Button>
                {isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setApiKey("");
                      setShowApiKey(false);
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
              {saveKeyMutation.isError && (
                <p className="text-sm text-destructive">
                  {saveKeyMutation.error?.message || "Failed to save API key"}
                </p>
              )}
            </div>
          )}

          {usage?.has_api_key && !isEditing && (
            <div className="p-3 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5">
              <p className="text-sm text-muted-foreground">
                API key is configured and ready to use
              </p>
            </div>
          )}
        </div>

        {/* Usage Stats */}
        {usage?.has_api_key && (
          <>
            <div className="pt-4 border-t border-primary/10">
              <h4 className="text-sm font-semibold mb-3">Usage Statistics (Last 30 Days)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">
                    <TrendingUp className="h-3 w-3" />
                    Requests
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-6 w-16" />
                  ) : (
                    <p className="text-lg font-bold">{usage.requests_30d.toLocaleString()}</p>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">
                    <Brain className="h-3 w-3" />
                    Tokens
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-6 w-16" />
                  ) : (
                    <p className="text-lg font-bold">{usage.tokens_30d.toLocaleString()}</p>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">
                    <DollarSign className="h-3 w-3" />
                    Est. Cost
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-6 w-16" />
                  ) : (
                    <p className="text-lg font-bold">${usage.cost_30d.toFixed(2)}</p>
                  )}
                </div>
              </div>
            </div>

            {usage.last_used && (
              <div className="text-xs text-muted-foreground">
                Last used: {new Date(usage.last_used).toLocaleString()}
              </div>
            )}
          </>
        )}

        {/* Help Text */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Your API key is encrypted and stored securely. It will only be
            used for ML features like stock analysis and predictions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
