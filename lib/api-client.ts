let activeEdgeUrl: string | null = null;
let lastDetectOk = false;
let lastDetectAt = 0;

const STORAGE_KEY = "edge_server_url";
const CUSTOM_PORT = 8000;

export function normalizeServerUrl(rawUrl: string): string {
  let clean = rawUrl.trim().replace(/\/+$/, "");
  if (!clean) return "http://localhost:8000";
  if (!/^https?:\/\//i.test(clean)) {
    clean = "http://" + clean;
  }
  try {
    const urlObj = new URL(clean);
    // If user entered IP like 192.0.0.3 without a port, append default :8000
    const hasPortInHost = urlObj.host.includes(":");
    if (!urlObj.port && !hasPortInHost) {
      clean = `${urlObj.protocol}//${urlObj.hostname}:${CUSTOM_PORT}${urlObj.pathname}`;
    }
  } catch {}
  return clean.replace(/\/+$/, "");
}

export function setEdgeServerUrl(url: string) {
  const normalized = normalizeServerUrl(url);
  activeEdgeUrl = normalized;
  lastDetectOk = true;
  lastDetectAt = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, normalized);
  } catch {}
}

export function clearEdgeServerOverride() {
  activeEdgeUrl = null;
  lastDetectOk = false;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function isEdgeOnline(): boolean {
  return lastDetectOk && !!activeEdgeUrl;
}

export const getEdgeCandidates = (): string[] => {
  if (typeof window === "undefined") return ["http://localhost:8000"];

  const list: string[] = [];

  // 1. Explicit ?server= query param (lets teacher share a link / QR)
  try {
    const qp = new URLSearchParams(window.location.search).get("server");
    if (qp) list.push(normalizeServerUrl(qp));
  } catch {}

  // 2. Manually configured override (persists across reloads)
  const stored = (() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  })();
  if (stored) list.push(normalizeServerUrl(stored));

  // 3. Cached active edge URL
  if (activeEdgeUrl) list.push(normalizeServerUrl(activeEdgeUrl));

  const isCapacitor =
    typeof navigator !== "undefined" &&
    (/android/i.test(navigator.userAgent) ||
      !!(window as unknown as { Capacitor?: unknown }).Capacitor);

  const host = window.location.hostname || "localhost";
  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "";

  if (!isLocalHost) {
    // App is served from LAN host (e.g. http://192.0.0.3:3000) —
    // the edge server MUST be probed on port 8000 at the same IP (http://192.0.0.3:8000)
    list.push(`http://${host}:${CUSTOM_PORT}`);
  }

  if (isCapacitor) {
    // Android emulator host loopback & ADB reverse
    list.push("http://10.0.2.2:8000");
    list.push("http://localhost:8000");
    list.push("http://127.0.0.1:8000");
    // Common hotspot gateways
    list.push("http://192.168.43.1:8000");
    list.push("http://192.168.49.1:8000");
    list.push("http://192.168.137.1:8000");
    list.push("http://192.168.0.1:8000");
    list.push("http://192.0.0.1:8000");
  }

  list.push("http://localhost:8000");
  list.push("http://127.0.0.1:8000");

  return Array.from(new Set(list.map(normalizeServerUrl)));
};

export const getEdgeServerUrl = (): string => {
  if (activeEdgeUrl) return activeEdgeUrl;
  const candidates = getEdgeCandidates();
  return candidates[0] || "http://localhost:8000";
};

export const getEdgeWsUrl = (): string => {
  return getEdgeServerUrl().replace(/^http/, "ws");
};

async function probe(url: string, timeoutMs: number): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    // /api/health is cheap and always present; fall back to /api/ai/status
    let res: Response | null = null;
    try {
      res = await fetch(`${url}/api/health`, { signal: ctrl.signal });
    } catch {
      res = null;
    }
    if (!res || !res.ok) {
      try {
        res = await fetch(`${url}/api/ai/status`, { signal: ctrl.signal });
      } catch {
        res = null;
      }
    }
    clearTimeout(tid);
    return !!res && res.ok;
  } catch {
    return false;
  }
}

export async function detectActiveEdgeServer(opts?: {
  timeoutMs?: number;
  force?: boolean;
}): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? 1500;
  if (activeEdgeUrl && !opts?.force) {
    // Re-validate cached URL quickly; keep it if still alive.
    if (await probe(activeEdgeUrl, Math.min(timeoutMs, 1200))) {
      lastDetectOk = true;
      lastDetectAt = Date.now();
      return activeEdgeUrl;
    }
    // cached URL dead — fall through to full scan
    activeEdgeUrl = null;
    lastDetectOk = false;
  }
  const candidates = getEdgeCandidates();
  for (const host of candidates) {
    if (await probe(host, timeoutMs)) {
      activeEdgeUrl = host;
      lastDetectOk = true;
      lastDetectAt = Date.now();
      try {
        localStorage.setItem(STORAGE_KEY, host);
      } catch {}
      return host;
    }
  }
  lastDetectOk = false;
  lastDetectAt = Date.now();
  throw new Error("EDGE_SERVER_NOT_FOUND");
}

export function getLastDetectInfo(): { ok: boolean; url: string | null; at: number } {
  return { ok: lastDetectOk, url: activeEdgeUrl, at: lastDetectAt };
}

export interface SessionData {
  id: string;
  teacher_id: string;
  teacher_name: string;
  course_name: string;
  grade: number;
  teaching_language: string;
  mode: string;
  is_active: number;
  join_code?: string;
  participant_count?: number;
  created_at?: number;
}

async function ensureServer(): Promise<string> {
  if (activeEdgeUrl && lastDetectOk) return activeEdgeUrl;
  return await detectActiveEdgeServer();
}

export async function getSessionByCode(joinCode: string): Promise<SessionData> {
  const base = await ensureServer();
  const res = await fetch(`${base}/api/sessions/by-code/${encodeURIComponent(joinCode.trim().toUpperCase())}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("SESSION_NOT_FOUND");
    throw new Error("Failed to lookup session by code");
  }
  return await res.json();
}

export async function fetchTeacherSessions(teacherIdentifier: string): Promise<{ sessions: SessionData[] }> {
  const base = await ensureServer();
  const res = await fetch(`${base}/api/teachers/${encodeURIComponent(teacherIdentifier)}/sessions`);
  if (!res.ok) throw new Error("Failed to fetch teacher classrooms");
  return await res.json();
}

export async function endSession(sessionId: string): Promise<{ status: string; session_id: string; is_active: number }> {
  const base = await ensureServer();
  const res = await fetch(`${base}/api/sessions/${sessionId}/end`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to end session");
  return await res.json();
}

export async function reactivateSession(sessionId: string): Promise<SessionData> {
  const base = await ensureServer();
  const res = await fetch(`${base}/api/sessions/${sessionId}/reactivate`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to reactivate session");
  return await res.json();
}

export async function joinClassByCode(
  joinCode: string,
  studentData: {
    student_id: string;
    student_name: string;
    preferred_language: string;
  }
) {
  const session = await getSessionByCode(joinCode);
  return await joinSession(session.id, studentData);
}

export async function fetchActiveSessions(): Promise<{ sessions: SessionData[] }> {
  const base = await ensureServer();
  const res = await fetch(`${base}/api/sessions/active`);
  if (!res.ok) throw new Error("Edge server response not ok");
  return await res.json();
}

export async function createSession(data: {
  teacher_id: string;
  teacher_name: string;
  course_name: string;
  grade: number;
  teaching_language: string;
}) {
  // Throws EDGE_SERVER_NOT_FOUND when offline — callers must surface this
  // instead of silently creating a fake LOCAL-* session.
  const base = await ensureServer();
  const res = await fetch(`${base}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return await res.json();
}

export interface JoinResult {
  participant_id: string;
  session_id: string;
  student_name: string;
  preferred_language: string;
  course_name: string;
  grade: number;
  teaching_language: string;
}

export async function joinSession(
  sessionId: string,
  data: {
    student_id: string;
    student_name: string;
    preferred_language: string;
  }
): Promise<JoinResult> {
  const base = await ensureServer();
  const res = await fetch(`${base}/api/sessions/${sessionId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("SESSION_NOT_FOUND");
    throw new Error("Failed to join session");
  }
  return await res.json();
}

export async function broadcastSpeech(data: {
  session_id: string;
  speaker_name: string;
  speaker_role: string;
  original_text: string;
  source_lang: string;
}) {
  const base = await ensureServer();
  const res = await fetch(`${base}/api/speech/broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Broadcast failed — edge server unreachable");
  return await res.json();
}

export async function streamAudioChunk(data: {
  session_id: string;
  speaker_name: string;
  speaker_role: string;
  source_lang: string;
  audio_base64: string;
  seq_num: number;
  is_final: boolean;
}) {
  const base = await ensureServer();
  const res = await fetch(`${base}/api/speech/stream-chunk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Stream chunk processing failed");
  return await res.json();
}

export async function updateTeacherMicState(data: {
  session_id: string;
  is_live: boolean;
  speaker_name: string;
}) {
  const base = await ensureServer();
  const res = await fetch(`${base}/api/speech/mic-state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update teacher mic state");
  return await res.json();
}

export async function generateAiContent(data: {
  session_id: string;
  transcript_summary: string;
  grade: number;
  activity_type: string;
  language?: string;
  course_name?: string;
}) {
  const base = await ensureServer();
  const res = await fetch(`${base}/api/content/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("AI content generation failed");
  return await res.json();
}

export async function approveAiContent(activityId: string, status: string) {
  const base = await ensureServer();
  const res = await fetch(`${base}/api/content/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activity_id: activityId, status }),
  });
  if (!res.ok) throw new Error("Approve failed");
  return await res.json();
}

export interface WSHandle {
  close: () => void;
  socket: WebSocket | null;
}

/**
 * Connect to the session WebSocket with auto-reconnect.
 * - Resolves server URL via ensureServer() first so teacher + student
 *   both dial the SAME edge host.
 * - Reconnects with backoff while `shouldStayOpen()` is true.
 * - Surfaces open/close/errors via callbacks so UI can show status
 *   instead of silently falling back.
 */
export function connectWebSocket(
  sessionId: string,
  onMessage: (msg: Record<string, unknown>) => void,
  opts?: {
    onOpen?: () => void;
    onClose?: (willRetry: boolean) => void;
    onError?: (ev: Event) => void;
    maxRetries?: number;
    shouldStayOpen?: () => boolean;
  }
): WSHandle {
  let socket: WebSocket | null = null;
  let retries = 0;
  let closedByUs = false;
  const maxRetries = opts?.maxRetries ?? 9999;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const shouldStayOpen = () => {
    if (closedByUs) return false;
    if (opts?.shouldStayOpen) return opts.shouldStayOpen();
    return retries < maxRetries;
  };

  const connect = async () => {
    if (closedByUs) return;
    let base: string;
    try {
      base = await ensureServer();
    } catch {
      // No server yet — retry shortly so a late-starting edge host is picked up.
      if (shouldStayOpen()) {
        retries++;
        retryTimer = setTimeout(connect, Math.min(2000 + retries * 500, 8000));
        opts?.onClose?.(true);
      } else {
        opts?.onClose?.(false);
      }
      return;
    }
    const wsUrl = `${base.replace(/^http/, "ws")}/ws/session/${sessionId}`;
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      opts?.onError?.(new Event("error"));
      if (shouldStayOpen()) {
        retries++;
        retryTimer = setTimeout(connect, Math.min(2000 + retries * 500, 8000));
        opts?.onClose?.(true);
      }
      return;
    }
    socket.onopen = () => {
      retries = 0;
      opts?.onOpen?.();
    };
    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage(parsed);
      } catch (e) {
        console.error("WS Parse error", e);
      }
    };
    socket.onerror = (ev) => {
      opts?.onError?.(ev);
    };
    socket.onclose = () => {
      socket = null;
      if (shouldStayOpen()) {
        retries++;
        const delay = Math.min(1500 + retries * 500, 8000);
        retryTimer = setTimeout(connect, delay);
        opts?.onClose?.(true);
      } else {
        opts?.onClose?.(false);
      }
    };
  };

  void connect();

  return {
    close() {
      closedByUs = true;
      if (retryTimer) clearTimeout(retryTimer);
      try {
        socket?.close();
      } catch {}
      socket = null;
    },
    get socket() {
      return socket;
    },
  };
}

export async function raiseHand(
  sessionId: string,
  participantId: string,
  studentName: string,
  raised: boolean
) {
  const base = await ensureServer();
  const res = await fetch(
    `${base}/api/sessions/${sessionId}/raise-hand?participant_id=${encodeURIComponent(
      participantId
    )}&student_name=${encodeURIComponent(studentName)}&raised=${raised}`,
    { method: "POST" }
  );
  if (!res.ok) {
    if (res.status === 404) throw new Error("PARTICIPANT_NOT_FOUND");
    throw new Error("Raise-hand failed");
  }
  return await res.json();
}

export async function approveSpeaking(sessionId: string, participantId: string, allow: boolean) {
  const base = await ensureServer();
  const res = await fetch(
    `${base}/api/sessions/${sessionId}/approve-speaking?participant_id=${encodeURIComponent(
      participantId
    )}&allow=${allow}`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("Approve-speaking failed");
  return await res.json();
}

export async function transcribeAudio(
  base64Audio: string,
  language: string = "hi"
): Promise<{ text: string; is_speech: boolean; latency_seconds?: number; engine?: string }> {
  try {
    const base = await ensureServer();
    const res = await fetch(`${base}/api/ai/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_base64: base64Audio, language, sample_rate: 16000 }),
    });
    if (!res.ok) throw new Error("Transcription failed");
    return await res.json();
  } catch (err) {
    console.warn("Edge transcribe error:", err);
    return { text: "", is_speech: false };
  }
}

export async function fetchPublishedActivities(sessionId: string, lang?: string) {
  const base = await ensureServer();
  const url = lang
    ? `${base}/api/sessions/${sessionId}/activities?status=APPROVED&lang=${encodeURIComponent(lang)}`
    : `${base}/api/sessions/${sessionId}/activities?status=APPROVED`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch activities");
  return await res.json();
}

export async function fetchRaisedHands(sessionId: string) {
  try {
    const base = await ensureServer();
    const res = await fetch(`${base}/api/sessions/${sessionId}/raised-hands`);
    if (!res.ok) return { raised_hands: [] };
    return await res.json();
  } catch {
    return { raised_hands: [] };
  }
}

export async function fetchAiStatus() {
  try {
    const base = await ensureServer();
    const res = await fetch(`${base}/api/ai/status`);
    if (!res.ok) throw new Error("Failed to fetch AI status");
    return await res.json();
  } catch {
    return { active_models: {}, vad_ready: false, asr_ready: false };
  }
}

export async function googleAuth(email: string, name: string, picture?: string, preferred_language?: string) {
  try {
    const base = await ensureServer();
    const res = await fetch(`${base}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, picture, preferred_language }),
    });
    if (!res.ok) throw new Error("Google auth failed");
    return await res.json();
  } catch {
    return { id: "T-DEFAULT", email, name, picture, preferred_language: preferred_language || "en" };
  }
}

export async function registerStudent(data: {
  name: string;
  grade: number;
  section: string;
  school_name: string;
  preferred_language: string;
}) {
  try {
    const base = await ensureServer();
    const res = await fetch(`${base}/api/students/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Student registration failed");
    return await res.json();
  } catch {
    return { id: "S-DEFAULT", ...data };
  }
}

export async function teacherSignup(data: {
  name: string;
  password: string;
  subject: string;
  grade: number;
  school_name: string;
  preferred_language: string;
}) {
  let res: Response;
  try {
    const base = await ensureServer();
    res = await fetch(`${base}/api/auth/teacher/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    throw new Error("SERVER_OFFLINE");
  }
  if (res.status === 409) throw new Error("ACCOUNT_EXISTS");
  if (!res.ok) {
    let detail = "Signup failed";
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  return await res.json();
}

export async function teacherLogin(name: string, password: string) {
  const base = await ensureServer();
  const res = await fetch(`${base}/api/auth/teacher/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, password }),
  });
  if (res.status === 404) throw new Error("ACCOUNT_NOT_FOUND");
  if (res.status === 401) throw new Error("WRONG_PASSWORD");
  if (!res.ok) throw new Error("Login failed");
  return await res.json();
}

export async function teacherCheckEmail(email: string): Promise<{ exists: boolean; name?: string }> {
  try {
    const base = await ensureServer();
    const res = await fetch(`${base}/api/auth/teacher/check?email=${encodeURIComponent(email)}`);
    if (!res.ok) return { exists: false };
    return await res.json();
  } catch {
    return { exists: false };
  }
}
