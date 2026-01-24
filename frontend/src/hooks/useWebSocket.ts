import { useEffect, useRef, useCallback, useState } from 'react';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (data: unknown) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  send: (data: unknown) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnectAttempts = 3,
  reconnectInterval = 3000,
  autoConnect = false,
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        reconnectCountRef.current = 0;
        onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch {
          // If not JSON, pass raw data
          onMessage?.(event.data);
        }
      };

      ws.onerror = (event) => {
        setError('WebSocket error occurred');
        onError?.(event);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        onClose?.();

        // Attempt reconnection
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };
    } catch (err) {
      setIsConnecting(false);
      setError('Failed to create WebSocket connection');
    }
  }, [url, onMessage, onOpen, onClose, onError, reconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectCountRef.current = reconnectAttempts; // Prevent reconnection
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, [reconnectAttempts]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      wsRef.current.send(message);
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    send,
    connect,
    disconnect,
  };
}

/**
 * Hook for translation WebSocket connection
 */
export function useTranslationSocket(
  sessionId: string,
  targetLanguage: string,
  onAudio: (audioData: ArrayBuffer) => void,
) {
  const baseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
  const url = `${baseUrl}/api/translate/stream/${sessionId}?target_language=${targetLanguage}`;

  const handleMessage = useCallback(
    (data: unknown) => {
      if (data instanceof ArrayBuffer) {
        onAudio(data);
      } else if (typeof data === 'object' && data !== null) {
        const msg = data as { type?: string; audio?: string };
        if (msg.type === 'audio' && msg.audio) {
          // Decode base64 audio
          const binary = atob(msg.audio);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          onAudio(bytes.buffer);
        }
      }
    },
    [onAudio]
  );

  return useWebSocket({
    url,
    onMessage: handleMessage,
    autoConnect: false,
  });
}

/**
 * Hook for transcription WebSocket connection
 */
export function useTranscriptionSocket(
  sessionId: string,
  onTranscript: (text: string, isFinal: boolean) => void,
) {
  const baseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
  const url = `${baseUrl}/api/transcribe/stream/${sessionId}`;

  const handleMessage = useCallback(
    (data: unknown) => {
      if (typeof data === 'object' && data !== null) {
        const msg = data as { type?: string; text?: string; is_final?: boolean };
        if (msg.type === 'transcript' && msg.text) {
          onTranscript(msg.text, msg.is_final ?? false);
        }
      }
    },
    [onTranscript]
  );

  return useWebSocket({
    url,
    onMessage: handleMessage,
    autoConnect: false,
  });
}
