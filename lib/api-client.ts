let activeEdgeUrl: string | null = null;

export const getEdgeCandidates = (): string[] => {
  if (typeof window === "undefined") return ["http://localhost:8000"];

  const list: string[] = [];
  try {
    const stored = localStorage.getItem("edge_server_url");
    if (stored) list.push(stored);
  } catch {}

  const isAndroid = typeof navigator !== "undefined" && (/android/i.test(navigator.userAgent) || !!(window as unknown as { Capacitor?: unknown }).Capacitor);
  if (isAndroid) {
    // 10.0.2.2 is host loopback in Android Emulator
    list.push("http://10.0.2.2:8000");
    // localhost:8000 works if `adb reverse tcp:8000 tcp:8000` is active
    list.push("http://localhost:8000");
    // Host Wi-Fi LAN IP
    list.push("http://192.168.1.191:8000");
  } else {
    const host = window.location.hostname || "localhost";
    list.push(`http://${host}:8000`);
    list.push("http://localhost:8000");
    list.push("http://127.0.0.1:8000");
    list.push("http://192.168.1.191:8000");
  }

  return Array.from(new Set(list));
};

export const getEdgeServerUrl = (): string => {
  if (activeEdgeUrl) return activeEdgeUrl;
  const candidates = getEdgeCandidates();
  return candidates[0] || "http://localhost:8000";
};

export const getEdgeWsUrl = (): string => {
  return getEdgeServerUrl().replace(/^http/, "ws");
};

export async function detectActiveEdgeServer(): Promise<string> {
  if (activeEdgeUrl) return activeEdgeUrl;
  const candidates = getEdgeCandidates();
  for (const host of candidates) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 600);
      const res = await fetch(`${host}/api/ai/status`, { signal: ctrl.signal });
      clearTimeout(tid);
      if (res.ok) {
        activeEdgeUrl = host;
        return host;
      }
    } catch {}
  }
  activeEdgeUrl = candidates[0];
  return activeEdgeUrl;
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
}

export async function fetchActiveSessions(): Promise<{ sessions: SessionData[] }> {
  try {
    const res = await fetch(`${getEdgeServerUrl()}/api/sessions/active`);
    if (!res.ok) throw new Error("Edge server response not ok");
    return await res.json();
  } catch {
    console.warn("Edge server offline, using local cached session");
    return {
      sessions: [
        {
          id: "LOCAL-DEMO-01",
          teacher_id: "T-01",
          teacher_name: "Anita Sharma",
          course_name: "Foundational Math & Science",
          grade: 2,
          teaching_language: "hi",
          mode: "LECTURE",
          is_active: 1
        }
      ]
    };
  }
}

export async function createSession(data: {
  teacher_id: string;
  teacher_name: string;
  course_name: string;
  grade: number;
  teaching_language: string;
}) {
  try {
    const res = await fetch(`${getEdgeServerUrl()}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch {
    return {
      session_id: "LOCAL-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
      ...data,
      mode: "LECTURE"
    };
  }
}

export async function joinSession(sessionId: string, data: {
  student_id: string;
  student_name: string;
  preferred_language: string;
}) {
  try {
    const res = await fetch(`${getEdgeServerUrl()}/api/sessions/${sessionId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch {
    return {
      participant_id: "P-" + Math.random().toString(36).substring(2, 6),
      session_id: sessionId,
      student_name: data.student_name,
      preferred_language: data.preferred_language,
      course_name: "Foundational Learning (Offline)",
      teaching_language: "hi"
    };
  }
}

export async function broadcastSpeech(data: {
  session_id: string;
  speaker_name: string;
  speaker_role: string;
  original_text: string;
  source_lang: string;
}) {
  try {
    const res = await fetch(`${getEdgeServerUrl()}/api/speech/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch {
    const knownLexicon: Record<string, Record<string, string>> = {
      "Hello children, today we will learn new things in mathematics.": {
        hi: "नमस्ते बच्चों, आज हम गणित में नई चीज़ें सीखेंगे।",
        bn: "নমস্কার বাচ্চারা, আজ আমরা গণিতে নতুন কিছু শিখব।",
        mr: "नमस्कार मुलांनो, আজ आपण गणितात नवीन गोष्टी शिकणार आहोत.",
        ta: "வணக்கம் குழந்தைகளே, இன்று நாம் கணிதத்தில் புதிய விஷயங்களைக் கற்றுக்கொள்வோம்.",
        te: "నమస్కారం పిల్లలు, ఈరోజు మనం గణితంలో కొత్త విషయాలు నేర్చుకుందాం.",
        sat: "ᱡᱚᱦᱟᱨ ᱜᱤᱫᱽᱨᱟᱹ ᱠᱚ, ᱛᱮᱦᱮᱧ ᱟᱵᱚ ᱮᱞᱠᱷᱟ ᱨᱮ ᱱᱟᱣᱟ ᱡᱤᱱᱤᱥ ᱵᱚᱱ ᱪᱮᱫᱚᱜᱼᱟ ᱾",
        en: "Hello children, today we will learn new things in mathematics."
      },
      "Today we will learn addition in mathematics.": {
        hi: "आज हम गणित में जोड़ना सीखेंगे।",
        bn: "আজ আমরা গণিতে যোগ শিখব।",
        mr: "आज आपण गणितात बेरीज शिकणार आहोत.",
        ta: "இன்று நாம் கணிதத்தில் கூட்டல் கற்போம்.",
        te: "ఈ రోజు మనం గణితంలో కూడిక నేర్చుకుందాం.",
        sat: "ᱛᱮᱦᱮᱧ ᱟᱵᱚ ᱮᱞᱠᱷᱟ ᱨᱮ ᱡᱚᱲᱟᱣ ᱵᱚᱱ ᱪᱮᱫᱚᱜᱼᱟ ᱾",
        en: "Today we will learn addition in mathematics."
      }
    };
    const match = knownLexicon[data.original_text.trim()];

    return {
      type: "SPEECH_TRANSLATED",
      session_id: data.session_id,
      speaker_name: data.speaker_name,
      speaker_role: data.speaker_role,
      original_text: data.original_text,
      source_lang: data.source_lang,
      translations: match || {
        hi: data.original_text,
        bn: `[Bengali] ${data.original_text}`,
        mr: `[Marathi] ${data.original_text}`,
        ta: `[Tamil] ${data.original_text}`,
        te: `[Telugu] ${data.original_text}`,
        sat: data.original_text,
        en: data.original_text
      },
      ttfa_seconds: 0.8,
      timestamp: Date.now() / 1000
    };
  }
}

export async function generateAiContent(data: {
  session_id: string;
  transcript_summary: string;
  grade: number;
  activity_type: string;
}) {
  try {
    const res = await fetch(`${getEdgeServerUrl()}/api/content/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch {
    const actId = "ACT-" + Math.random().toString(36).substring(2, 8);
    return {
      activity_id: actId,
      session_id: data.session_id,
      activity_type: data.activity_type,
      title: `Grade ${data.grade} NIPUN ${data.activity_type}`,
      domain: "Numeracy",
      skill: "Foundational Addition",
      grade: data.grade,
      content: {
        title: `Grade ${data.grade} NIPUN ${data.activity_type}`,
        questions: [
          {
            id: "q1",
            question: "How many apples are shown below? 🍎 🍎 🍎",
            options: ["2", "3", "4", "5"],
            correct: "3",
            visual: "COUNTING_APPLES",
            count: 3
          },
          {
            id: "q2",
            question: "What is 4 + 2?",
            options: ["5", "6", "7", "8"],
            correct: "6",
            visual: "NUMBER_LINE",
            start: 4,
            jump: 2
          }
        ]
      },
      status: "PENDING"
    };
  }
}

export async function approveAiContent(activityId: string, status: string) {
  try {
    const res = await fetch(`${getEdgeServerUrl()}/api/content/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activity_id: activityId, status })
    });
    return await res.json();
  } catch {
    return { status: "SUCCESS", activity_status: status };
  }
}

export function connectWebSocket(sessionId: string, onMessage: (msg: Record<string, unknown>) => void) {
  try {
    const ws = new WebSocket(`${getEdgeWsUrl()}/ws/session/${sessionId}`);
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage(parsed);
      } catch (e) {
        console.error("WS Parse error", e);
      }
    };
    return ws;
  } catch {
    console.warn("Could not connect to WebSocket edge server");
    return null;
  }
}

export async function transcribeAudio(base64Audio: string, language: string = "hi"): Promise<{ text: string; is_speech: boolean; latency_seconds?: number; engine?: string }> {
  try {
    const res = await fetch(`${getEdgeServerUrl()}/api/ai/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_base64: base64Audio, language, sample_rate: 16000 })
    });
    if (!res.ok) throw new Error("Transcription failed");
    return await res.json();
  } catch (err) {
    console.warn("Edge transcribe error:", err);
    return { text: "", is_speech: false };
  }
}

export async function fetchPublishedActivities(sessionId: string) {
  try {
    const res = await fetch(`${getEdgeServerUrl()}/api/sessions/${sessionId}/activities?status=APPROVED`);
    if (!res.ok) throw new Error("Failed to fetch activities");
    return await res.json();
  } catch {
    return { activities: [] };
  }
}

export async function fetchAiStatus() {
  try {
    const res = await fetch(`${getEdgeServerUrl()}/api/ai/status`);
    if (!res.ok) throw new Error("Failed to fetch AI status");
    return await res.json();
  } catch {
    return { active_models: {}, vad_ready: false, asr_ready: false };
  }
}

export async function googleAuth(email: string, name: string, picture?: string, preferred_language?: string) {
  try {
    const res = await fetch(`${getEdgeServerUrl()}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, picture, preferred_language })
    });
    if (!res.ok) throw new Error("Google auth failed");
    return await res.json();
  } catch {
    return { id: "T-DEFAULT", email, name, picture, preferred_language: preferred_language || "en" };
  }
}

export async function registerStudent(data: { name: string; grade: number; section: string; school_name: string; preferred_language: string }) {
  try {
    const res = await fetch(`${getEdgeServerUrl()}/api/students/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Student registration failed");
    return await res.json();
  } catch {
    return { id: "S-DEFAULT", ...data };
  }
}

export async function teacherSignup(data: { name: string; password: string; subject: string; grade: number; school_name: string; preferred_language: string }) {
  let res: Response;
  try {
    res = await fetch(`${getEdgeServerUrl()}/api/auth/teacher/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  } catch {
    throw new Error("SERVER_OFFLINE");
  }
  if (res.status === 409) throw new Error("ACCOUNT_EXISTS");
  if (!res.ok) {
    let detail = "Signup failed";
    try { const j = await res.json(); detail = j.detail || detail; } catch {}
    throw new Error(detail);
  }
  return await res.json();
}

export async function teacherLogin(name: string, password: string) {
  const res = await fetch(`${getEdgeServerUrl()}/api/auth/teacher/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, password })
  });
  if (res.status === 404) throw new Error("ACCOUNT_NOT_FOUND");
  if (res.status === 401) throw new Error("WRONG_PASSWORD");
  if (!res.ok) throw new Error("Login failed");
  return await res.json();
}

export async function teacherCheckEmail(email: string): Promise<{ exists: boolean; name?: string }> {
  try {
    const res = await fetch(`${getEdgeServerUrl()}/api/auth/teacher/check?email=${encodeURIComponent(email)}`);
    if (!res.ok) return { exists: false };
    return await res.json();
  } catch {
    return { exists: false };
  }
}



