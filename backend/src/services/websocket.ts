import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { verifyToken } from './auth';

interface WsClient extends WebSocket {
  userId?: number;
  subscribedGroups: Set<number>;
}

const clients = new Set<WsClient>();

export function initWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WsClient, req) => {
    ws.subscribedGroups = new Set();

    // Auth via query param: ?token=JWT
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Auth required');
      return;
    }

    try {
      const payload = verifyToken(token);
      ws.userId = payload.userId;
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    clients.add(ws);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe' && msg.groupId) {
          ws.subscribedGroups.add(msg.groupId);
          ws.send(JSON.stringify({ type: 'subscribed', groupId: msg.groupId }));
        }
        if (msg.type === 'unsubscribe' && msg.groupId) {
          ws.subscribedGroups.delete(msg.groupId);
        }
      } catch { /* ignore malformed messages */ }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  return wss;
}

export function broadcastToGroup(groupId: number, event: { type: string; data?: any }) {
  const msg = JSON.stringify({ ...event, groupId });
  for (const client of clients) {
    if (client.subscribedGroups.has(groupId) && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}
