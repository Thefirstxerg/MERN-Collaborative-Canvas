import { useState, useEffect, useRef } from 'react';

interface UseWebSocketResult {
  sendMessage: (message: string) => void;
  lastMessage: string | null;
  isConnected: boolean;
}

export const useWebSocket = (url: string, token: string | null): UseWebSocketResult => {
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;

    const connect = () => {
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          
          // Send authentication message
          ws.send(JSON.stringify({
            type: 'AUTH',
            token: token
          }));
        };

        ws.onmessage = (event) => {
          setLastMessage(event.data);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          
          // Reconnect after 3 seconds
          setTimeout(connect, 3000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
        };
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setIsConnected(false);
        
        // Retry connection after 3 seconds
        setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url, token]);

  const sendMessage = (message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    }
  };

  return {
    sendMessage,
    lastMessage,
    isConnected
  };
};