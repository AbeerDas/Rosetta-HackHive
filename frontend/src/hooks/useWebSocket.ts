import { useEffect, useRef, useCallback, useState } from 'react';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (data: unknown) => void;
  onBinaryMessage?: (data: ArrayBuffer) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  autoConnect?: boolean;
  keepaliveInterval?: number; // Interval in ms for sending ping messages
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  send: (data: unknown) => void;
  sendBinary: (data: ArrayBuffer | Blob) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket({
  url,
  onMessage,
  onBinaryMessage,
  onOpen,
  onClose,
  onError,
  reconnectAttempts = 3,
  reconnectInterval = 3000,
  autoConnect = false,
  keepaliveInterval = 0, // 0 means disabled
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepaliveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlRef = useRef(url);
  
  // Store callbacks in refs to avoid reconnection on callback changes
  const onMessageRef = useRef(onMessage);
  const onBinaryMessageRef = useRef(onBinaryMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  
  // Keep refs updated
  useEffect(() => { urlRef.current = url; }, [url]);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onBinaryMessageRef.current = onBinaryMessage; }, [onBinaryMessage]);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startKeepalive = useCallback(() => {
    if (keepaliveInterval > 0 && !keepaliveTimerRef.current) {
      keepaliveTimerRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        }
      }, keepaliveInterval);
    }
  }, [keepaliveInterval]);

  const stopKeepalive = useCallback(() => {
    if (keepaliveTimerRef.current) {
      clearInterval(keepaliveTimerRef.current);
      keepaliveTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected, skipping');
      return;
    }
    
    // If WebSocket is in connecting state, don't create a new one
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('[WebSocket] Already connecting, skipping');
      return;
    }

    console.log('[WebSocket] Connecting to:', urlRef.current);
    setIsConnecting(true);
    setError(null);

    try {
      const ws = new WebSocket(urlRef.current);
      ws.binaryType = 'arraybuffer'; // Enable binary message handling
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected successfully to:', urlRef.current);
        setIsConnected(true);
        setIsConnecting(false);
        reconnectCountRef.current = 0;
        startKeepalive();
        onOpenRef.current?.();
      };

      ws.onmessage = (event) => {
        // Handle binary data separately
        if (event.data instanceof ArrayBuffer) {
          onBinaryMessageRef.current?.(event.data);
          return;
        }
        
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current?.(data);
        } catch {
          // If not JSON, pass raw data
          onMessageRef.current?.(event.data);
        }
      };

      ws.onerror = (event) => {
        setError('WebSocket error occurred');
        onErrorRef.current?.(event);
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Connection closed:', urlRef.current, 'Code:', event.code, 'Reason:', event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        stopKeepalive();
        onCloseRef.current?.();

        // Attempt reconnection
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current += 1;
          console.log('[WebSocket] Attempting reconnection', reconnectCountRef.current, 'of', reconnectAttempts);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };
    } catch (err) {
      setIsConnecting(false);
      setError('Failed to create WebSocket connection');
    }
  }, [reconnectAttempts, reconnectInterval, startKeepalive, stopKeepalive]); // Reduced dependencies - uses refs for callbacks

  const disconnect = useCallback(() => {
    console.log('[WebSocket] Disconnect called for:', urlRef.current);
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    stopKeepalive();
    reconnectCountRef.current = reconnectAttempts; // Prevent reconnection
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, [reconnectAttempts, stopKeepalive]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      wsRef.current.send(message);
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  const sendBinary = useCallback((data: ArrayBuffer | Blob) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  // Store autoConnect in a ref for cleanup
  const autoConnectRef = useRef(autoConnect);
  useEffect(() => { autoConnectRef.current = autoConnect; }, [autoConnect]);

  // Auto-connect on mount if enabled
  // For manually connected WebSockets (autoConnect=false), cleanup is handled by explicit disconnect() calls
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      // Only auto-disconnect on unmount if autoConnect was true
      // For manually managed connections, the caller is responsible for disconnecting
      if (autoConnectRef.current && wsRef.current) {
        console.log('[WebSocket] Auto-connected socket cleanup, disconnecting');
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount/unmount

  return {
    isConnected,
    isConnecting,
    error,
    send,
    sendBinary,
    connect,
    disconnect,
  };
}

// Message types from backend
export interface TranscriptionMessage {
  type: 'segment_saved' | 'citations' | 'pong' | 'error';
  segment_id?: string;
  window_index?: number;
  citations?: Array<{
    rank: number;
    document_name: string;
    page_number: number;
    snippet: string;
  }>;
  code?: string;
  message?: string;
}

export interface TranslationMessage {
  type: 'connected' | 'status' | 'language_changed' | 'translated_text' | 'error' | 'pong';
  session_id?: string;
  language?: string;
  status?: 'live' | 'muted' | 'reconnecting';
  code?: string;
  message?: string;
  // For translated_text type
  original_text?: string;
  translated_text?: string;
  segment_id?: string;
}

// Message to send text for translation
export interface TranslateTextMessage {
  type: 'translate';
  text: string;
  segment_id?: string;
}

/**
 * Hook for translation WebSocket connection
 */
export function useTranslationSocket(
  sessionId: string,
  targetLanguage: string,
  onAudio: (audioData: ArrayBuffer) => void,
  onStatusMessage?: (msg: TranslationMessage) => void,
) {
  const baseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
  const url = `${baseUrl}/api/v1/translate/stream?session_id=${sessionId}&target_language=${targetLanguage}`;

  // Handle binary audio data directly
  const handleBinaryMessage = useCallback(
    (data: ArrayBuffer) => {
      onAudio(data);
    },
    [onAudio]
  );

  // Handle JSON status messages
  const handleMessage = useCallback(
    (data: unknown) => {
      if (typeof data === 'object' && data !== null) {
        const msg = data as TranslationMessage & { audio?: string };
        // Handle base64-encoded audio fallback
        if (msg.audio) {
          const binary = atob(msg.audio);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          onAudio(bytes.buffer);
        } else if (msg.type && msg.type !== 'pong') {
          // Ignore pong messages, forward all other status messages
          onStatusMessage?.(msg);
        }
      }
    },
    [onAudio, onStatusMessage]
  );

  return useWebSocket({
    url,
    onMessage: handleMessage,
    onBinaryMessage: handleBinaryMessage,
    autoConnect: false,
    keepaliveInterval: 30000, // 30 seconds per FRD-03
  });
}

/**
 * Hook for transcription WebSocket connection with RAG citations
 */
export function useTranscriptionSocket(
  sessionId: string,
  onMessage: (msg: TranscriptionMessage) => void,
) {
  const baseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
  const url = `${baseUrl}/api/v1/transcribe/stream?session_id=${sessionId}`;

  const handleMessage = useCallback(
    (data: unknown) => {
      if (typeof data === 'object' && data !== null) {
        const msg = data as TranscriptionMessage;
        // Ignore pong messages
        if (msg.type !== 'pong') {
          onMessage(msg);
        }
      }
    },
    [onMessage]
  );

  return useWebSocket({
    url,
    onMessage: handleMessage,
    autoConnect: false,
    keepaliveInterval: 30000, // 30 seconds per FRD-04
  });
}
