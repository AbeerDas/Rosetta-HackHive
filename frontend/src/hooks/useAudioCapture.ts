import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioCaptureOptions {
  sampleRate?: number;
  chunkSize?: number;
  onAudioChunk?: (chunk: ArrayBuffer) => void;
}

interface UseAudioCaptureReturn {
  isCapturing: boolean;
  isSupported: boolean;
  error: string | null;
  stream: MediaStream | null;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Hook for capturing audio from the microphone as PCM data.
 * Captures 16-bit PCM audio at the specified sample rate (default 16kHz).
 */
export function useAudioCapture({
  sampleRate = 16000,
  chunkSize = 4096,
  onAudioChunk,
}: UseAudioCaptureOptions = {}): UseAudioCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const onAudioChunkRef = useRef(onAudioChunk);

  // Keep the callback ref updated
  useEffect(() => {
    onAudioChunkRef.current = onAudioChunk;
  }, [onAudioChunk]);

  const isSupported =
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  const start = useCallback(async () => {
    if (!isSupported) {
      setError('Audio capture is not supported in this browser');
      return;
    }

    try {
      setError(null);

      // Request microphone access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: sampleRate,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      setStream(mediaStream);

      // Create audio context
      const audioContext = new AudioContext({ sampleRate });
      audioContextRef.current = audioContext;

      // Create source from media stream
      const source = audioContext.createMediaStreamSource(mediaStream);
      sourceRef.current = source;

      // Create script processor for capturing PCM data
      // Note: ScriptProcessorNode is deprecated but still widely supported
      // AudioWorklet would be the modern alternative
      const processor = audioContext.createScriptProcessor(chunkSize, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);

        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          // Clamp to -1 to 1 range
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          // Convert to 16-bit integer
          pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }

        // Send to callback
        if (onAudioChunkRef.current) {
          onAudioChunkRef.current(pcmData.buffer);
        }
      };

      // Connect the nodes
      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsCapturing(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start audio capture';
      setError(errorMessage);
      console.error('Audio capture error:', err);
    }
  }, [isSupported, sampleRate, chunkSize]);

  const stop = useCallback(() => {
    // Disconnect and cleanup processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Disconnect source
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop media stream tracks
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    setIsCapturing(false);
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isCapturing) {
        stop();
      }
    };
  }, [isCapturing, stop]);

  return {
    isCapturing,
    isSupported,
    error,
    stream,
    start,
    stop,
  };
}

/**
 * Hook for playing audio chunks received from WebSocket.
 * Buffers incoming audio and plays it smoothly.
 */
export function useAudioPlayback() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const nextPlayTimeRef = useRef(0);

  const initialize = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
      gainNodeRef.current.gain.value = isMuted ? 0 : volume / 100;
      nextPlayTimeRef.current = 0;
    }
  }, [volume, isMuted]);

  const playAudioChunk = useCallback(
    async (audioData: ArrayBuffer) => {
      initialize();

      const audioContext = audioContextRef.current;
      const gainNode = gainNodeRef.current;

      if (!audioContext || !gainNode) return;

      try {
        // Resume context if suspended
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        // Decode the audio data
        const audioBuffer = await audioContext.decodeAudioData(audioData.slice(0));

        // Create source and play
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNode);

        // Schedule playback
        const currentTime = audioContext.currentTime;
        const startTime = Math.max(currentTime, nextPlayTimeRef.current);
        source.start(startTime);

        // Update next play time for smooth buffering
        nextPlayTimeRef.current = startTime + audioBuffer.duration;

        setIsPlaying(true);

        source.onended = () => {
          // Check if we're still playing
          if (audioContext.currentTime >= nextPlayTimeRef.current - 0.1) {
            setIsPlaying(false);
          }
        };
      } catch (err) {
        console.error('Error playing audio chunk:', err);
      }
    },
    [initialize]
  );

  const updateVolume = useCallback(
    (newVolume: number) => {
      setVolume(newVolume);
      if (gainNodeRef.current && !isMuted) {
        gainNodeRef.current.gain.value = newVolume / 100;
      }
    },
    [isMuted]
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const newMuted = !prev;
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = newMuted ? 0 : volume / 100;
      }
      return newMuted;
    });
  }, [volume]);

  const stop = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
      gainNodeRef.current = null;
    }
    setIsPlaying(false);
    nextPlayTimeRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isPlaying,
    volume,
    isMuted,
    playAudioChunk,
    updateVolume,
    toggleMute,
    stop,
  };
}
