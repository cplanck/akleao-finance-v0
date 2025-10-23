import { useEffect, useRef, useState, useCallback } from "react";

interface PolygonTrade {
  ev: string; // Event type
  sym: string; // Symbol
  p: number; // Price
  t: number; // Timestamp (ms)
  s: number; // Size
}

interface PolygonMessage {
  ev: string;
  status: string;
  message?: string;
}

interface TradeData {
  price: number;
  timestamp: number;
  size: number;
}

interface UsePolygonWebSocketOptions {
  symbol: string;
  enabled?: boolean;
  onTrade?: (trade: TradeData) => void;
}

const POLYGON_WS_URL = "wss://socket.polygon.io/stocks";

export function usePolygonWebSocket({
  symbol,
  enabled = true,
  onTrade,
}: UsePolygonWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [latestTrade, setLatestTrade] = useState<TradeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const apiKey = process.env.NEXT_PUBLIC_POLYGON_API_KEY;

  const connect = useCallback(() => {
    if (!apiKey) {
      setError("Polygon API key not found");
      return;
    }

    if (!enabled) {
      return;
    }

    try {
      const ws = new WebSocket(POLYGON_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[Polygon WS] Connection opened");

        // Authenticate - don't subscribe yet, wait for auth success
        ws.send(JSON.stringify({
          action: "auth",
          params: apiKey,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const messages: Array<PolygonMessage | PolygonTrade> = JSON.parse(event.data);

          messages.forEach((msg) => {
            // Handle status messages
            if (msg.ev === "status") {
              const statusMsg = msg as PolygonMessage;
              console.log("[Polygon WS]", statusMsg.status, statusMsg.message);

              if (statusMsg.status === "auth_success") {
                console.log("[Polygon WS] Authenticated successfully, subscribing to", symbol);
                // Now subscribe to trades after successful auth
                ws.send(JSON.stringify({
                  action: "subscribe",
                  params: `T.${symbol}`,
                }));
                setIsConnected(true);
                setError(null);
                reconnectAttemptsRef.current = 0;
              } else if (statusMsg.status === "auth_failed") {
                setError("Authentication failed");
                ws.close();
              }
            }

            // Handle trade messages
            if (msg.ev === "T") {
              const trade = msg as PolygonTrade;
              const tradeData: TradeData = {
                price: trade.p,
                timestamp: trade.t,
                size: trade.s,
              };

              setLatestTrade(tradeData);
              onTrade?.(tradeData);
            }
          });
        } catch (err) {
          console.error("[Polygon WS] Error parsing message:", err);
        }
      };

      ws.onerror = (event) => {
        console.error("[Polygon WS] Error:", event);
        setError("WebSocket error occurred");
      };

      ws.onclose = (event) => {
        console.log("[Polygon WS] Connection closed", event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect if not manually closed and under attempt limit
        if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`[Polygon WS] Reconnecting in ${delay}ms...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };
    } catch (err) {
      console.error("[Polygon WS] Connection error:", err);
      setError("Failed to connect to Polygon WebSocket");
    }
  }, [apiKey, symbol, enabled, onTrade]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      console.log("[Polygon WS] Disconnecting...");
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setLatestTrade(null);
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    latestTrade,
    error,
    reconnect: connect,
  };
}
