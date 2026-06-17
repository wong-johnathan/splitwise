import { useEffect, useRef, useCallback } from 'react';

type WsEvent =
  | { type: 'expense_created'; data: { expenseId: number } }
  | { type: 'expense_updated'; data: { expenseId: number } }
  | { type: 'expense_deleted'; data: { expenseId: number } }
  | { type: 'payment_created'; data: { paymentId: number } }
  | { type: 'payment_deleted'; data: { paymentId: number } };

/**
 * Hook that opens a WebSocket connection and subscribes to real-time events
 * for the given group. Calls `onEvent` whenever an event arrives.
 *
 * The WebSocket auto-reconnects on disconnect (up to 10 retries with backoff).
 */
export function useGroupRealtime(
  groupId: number | undefined,
  token: string | undefined,
  onEvent: (event: WsEvent) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 10;
  const onEventRef = useRef(onEvent);

  // Keep the callback ref fresh so we don't reconnect when onEvent changes
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!groupId || !token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = import.meta.env.VITE_API_URL || window.location.host;
    // If VITE_API_URL is set (e.g. http://localhost:4000), derive WS URL from it
    const wsHost = host.replace(/^https?:\/\//, '');
    const url = `${protocol}://${wsHost}/ws?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCountRef.current = 0;
      // Subscribe to the group
      ws.send(JSON.stringify({ type: 'subscribe', groupId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'subscribed') return; // acknowledge
        onEventRef.current(msg as WsEvent);
      } catch { /* ignore malformed */ }
    };

    ws.onclose = () => {
      wsRef.current = null;
      // Auto-reconnect with exponential backoff
      if (retryCountRef.current < maxRetries) {
        const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
        retryCountRef.current += 1;
        setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [groupId, token]);

  useEffect(() => {
    connect();
    return () => {
      retryCountRef.current = maxRetries; // stop reconnecting
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);
}
