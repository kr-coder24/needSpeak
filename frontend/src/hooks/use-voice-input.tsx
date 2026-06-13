import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Hybrid voice input hook.
 *
 * Strategy:
 * 1. Try Web Speech API first (free, instant, works on localhost in Chrome)
 * 2. If Web Speech fails with network/not-allowed error, fall back to
 *    MediaRecorder + backend `/api/transcribe` endpoint (Gemini-powered)
 *
 * This gives the best UX: instant results when the browser API works,
 * reliable fallback when it doesn't.
 */

export type VoiceStatus = "idle" | "listening" | "processing" | "error";

interface UseVoiceInputOptions {
  /** Called when transcription text is received */
  onResult?: (text: string) => void;
  /** Language for Web Speech API. Default: "en-IN" */
  lang?: string;
}

// ─── Web Speech API types ────────────────────────────────────────────────────

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

type SpeechRecognitionErrorEvent = Event & { error: string };

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const { onResult, lang = "en-IN" } = options;

  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [supported, setSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track which mode we're using
  const modeRef = useRef<"webspeech" | "mediarecorder" | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Check basic support
  useEffect(() => {
    const hasWebSpeech = !!getSpeechRecognitionCtor();
    const hasMediaRecorder = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
    if (!hasWebSpeech && !hasMediaRecorder) {
      setSupported(false);
    }
  }, []);

  // ─── Web Speech API path ─────────────────────────────────────────────

  const startWebSpeech = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return false;

    const recognition = new Ctor();
    recognition.continuous = false; // Single utterance mode for reliability
    recognition.interimResults = false;
    recognition.lang = lang;

    let gotResult = false;

    recognition.onstart = () => {
      modeRef.current = "webspeech";
      setStatus("listening");
      setErrorMessage(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (transcript) {
        gotResult = true;
        onResult?.(transcript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // If network error, try fallback to MediaRecorder
      if (event.error === "network" || event.error === "service-not-allowed") {
        recognition.abort();
        recognitionRef.current = null;
        startMediaRecorder();
        return;
      }
      if (event.error === "not-allowed") {
        setErrorMessage("Microphone access denied. Allow mic permissions in browser settings.");
        setStatus("error");
        return;
      }
      if (event.error === "no-speech") {
        setErrorMessage("No speech detected. Try again.");
        setStatus("idle");
        return;
      }
      // aborted is fine, user stopped it
      if (event.error === "aborted") return;
      setErrorMessage(`Speech error: ${event.error}`);
      setStatus("error");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (!gotResult && status === "listening") {
        // Ended without result and no error — just go idle
      }
      setStatus("idle");
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      return true;
    } catch {
      return false;
    }
  }, [lang, onResult, status]);

  // ─── MediaRecorder fallback path ─────────────────────────────────────

  const startMediaRecorder = useCallback(async () => {
    setErrorMessage(null);
    modeRef.current = "mediarecorder";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (audioBlob.size < 5000) {
          setStatus("idle");
          setErrorMessage("Recording too short. Hold longer.");
          return;
        }

        setStatus("processing");
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            let detail = "Transcription failed";
            try {
              const err = await res.json();
              detail = err.message || err.detail || detail;
            } catch { /* ignore */ }
            throw new Error(detail);
          }

          const data = await res.json();
          if (data.text?.trim()) {
            onResult?.(data.text.trim());
          } else {
            setErrorMessage("Could not recognize speech. Try again.");
          }
        } catch (err: any) {
          setErrorMessage(err.message || "Transcription failed.");
        } finally {
          setStatus("idle");
        }
      };

      recorder.onerror = () => {
        setStatus("error");
        setErrorMessage("Recording error.");
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setStatus("listening");
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setErrorMessage("Microphone access denied. Allow mic permissions.");
      } else {
        setErrorMessage("Could not access microphone.");
      }
      setStatus("error");
    }
  }, [onResult]);

  // ─── Public API ──────────────────────────────────────────────────────

  const start = useCallback(() => {
    // Try Web Speech first, fall back to MediaRecorder
    const started = startWebSpeech();
    if (!started) {
      startMediaRecorder();
    }
  }, [startWebSpeech, startMediaRecorder]);

  const stop = useCallback(() => {
    if (modeRef.current === "webspeech" && recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (modeRef.current === "mediarecorder" && mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
    }
  }, []);

  const toggle = useCallback(() => {
    if (status === "listening") {
      stop();
    } else if (status === "idle" || status === "error") {
      start();
    }
  }, [status, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { status, supported, errorMessage, start, stop, toggle };
}
