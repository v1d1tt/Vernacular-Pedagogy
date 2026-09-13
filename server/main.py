import uuid
import time
import json
import hashlib
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import get_db_connection, init_db
from ai_engine import translate_speech, generate_nipun_content, transcribe_audio_chunk, LANGUAGES, NIPUN_KNOWLEDGE_BASE
from model_manager import edge_ai
from session_manager import manager

app = FastAPI(title="Offline Multilingual AI Classroom Edge Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas
class CreateSessionRequest(BaseModel):
    teacher_id: str
    teacher_name: str
    course_name: str
    grade: int
    teaching_language: str

class JoinSessionRequest(BaseModel):
    student_id: str
    student_name: str
    preferred_language: str

class BroadcastSpeechRequest(BaseModel):
    session_id: str
    speaker_name: str
    speaker_role: str
    original_text: str
    source_lang: str

class GenerateContentRequest(BaseModel):
    session_id: str
    transcript_summary: str
    grade: int
    activity_type: str  # QUIZ, FLASHCARD, WORKSHEET
    language: Optional[str] = "hi"

class ApproveContentRequest(BaseModel):
    activity_id: str
    status: str  # APPROVED, REJECTED

class SubmitAnswerRequest(BaseModel):
    activity_id: str
    student_id: str
    student_name: str
    answers: Dict[str, Any]

class TranscribeRequest(BaseModel):
    audio_base64: Optional[str] = None
    language: Optional[str] = "hi"
    sample_rate: Optional[int] = 16000

class GoogleAuthRequest(BaseModel):
    email: str
    name: str
    picture: Optional[str] = None
    preferred_language: Optional[str] = "en"

class TeacherSignupRequest(BaseModel):
    name: str
    password: str
    subject: str
    grade: int
    school_name: str
    preferred_language: Optional[str] = "hi"

class TeacherLoginRequest(BaseModel):
    name: str
    password: str

class StudentRegisterRequest(BaseModel):
    name: str
    grade: int
    section: str
    school_name: str
    preferred_language: str

@app.on_event("startup")
def startup_event():
    init_db()

@app.get("/api/health")
def health_check():
    return {
        "status": "ONLINE",
        "mode": "OFFLINE_EDGE_SERVER",
        "supported_languages": LANGUAGES,
        "nipun_outcomes_count": len(NIPUN_KNOWLEDGE_BASE)
    }

@app.get("/api/ai/status")
def ai_status():
    return edge_ai.get_status()

@app.post("/api/ai/transcribe")
def transcribe_audio_endpoint(req: TranscribeRequest):
    import base64
    import numpy as np
    if req.audio_base64:
        try:
            raw_bytes = base64.b64decode(req.audio_base64)
            audio_array = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            result = transcribe_audio_chunk(audio_array, sample_rate=req.sample_rate or 16000, lang=req.language or "hi")
            return result
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Audio decoding error: {str(e)}")
    return {"text": "", "is_speech": False, "detail": "No audio provided"}

@app.get("/api/tts/speak")
@app.post("/api/tts/speak")
def tts_speak(text: str = "", lang: str = "hi", speed: float = 1.0):
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Text parameter is required")
    wav_bytes = edge_ai.synthesize_speech(text.strip(), language=lang, speed=speed)
    if not wav_bytes:
        raise HTTPException(status_code=500, detail="Speech synthesis failed or model not ready")
    return Response(content=wav_bytes, media_type="audio/wav")

def _hash_password(password: str) -> str:
    """SHA-256 password hash with a fixed salt prefix for offline use."""
    salted = f"vset-salt-2025:{password}"
    return hashlib.sha256(salted.encode()).hexdigest()

# Teacher & Student Auth / Registration
@app.post("/api/auth/google")
def google_auth(req: GoogleAuthRequest):
    """Legacy endpoint — simple upsert for backward compatibility."""
    teacher_id = "T-" + str(uuid.uuid4())[:8]
    now = time.time()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM teachers WHERE email = ?", (req.email,))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        return dict(existing)
    cursor.execute('''
    INSERT INTO teachers (id, email, name, picture, preferred_language, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ''', (teacher_id, req.email, req.name, req.picture or "", req.preferred_language or "hi", now))
    conn.commit()
    conn.close()
    return {
        "id": teacher_id, "email": req.email, "name": req.name,
        "preferred_language": req.preferred_language or "hi", "created_at": now
    }

@app.post("/api/auth/teacher/signup")
def teacher_signup(req: TeacherSignupRequest):
    """Teacher registration: saves profile + hashed password. Fails if name already exists."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM teachers WHERE name = ?", (req.name.strip(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="ACCOUNT_EXISTS")
    teacher_id = "T-" + str(uuid.uuid4())[:8]
    now = time.time()
    pwd_hash = _hash_password(req.password)
    placeholder_email = f"teacher_{uuid.uuid4().hex[:10]}@offline.local"
    try:
        cursor.execute('''
        INSERT INTO teachers (id, email, name, picture, preferred_language, subject, grade, school_name, password_hash, created_at)
        VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?)
        ''', (teacher_id, placeholder_email, req.name.strip(), req.preferred_language or "hi",
              req.subject, req.grade, req.school_name, pwd_hash, now))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="ACCOUNT_EXISTS")
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    conn.close()
    return {
        "id": teacher_id, "name": req.name.strip(),
        "subject": req.subject, "grade": req.grade, "school_name": req.school_name,
        "preferred_language": req.preferred_language or "hi", "created_at": now
    }

@app.post("/api/auth/teacher/login")
def teacher_login(req: TeacherLoginRequest):
    """Teacher login: verifies name + password hash."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM teachers WHERE name = ?", (req.name.strip(),))
    teacher = cursor.fetchone()
    conn.close()
    if not teacher:
        raise HTTPException(status_code=404, detail="ACCOUNT_NOT_FOUND")
    stored_hash = teacher["password_hash"] or ""
    if not stored_hash:
        raise HTTPException(status_code=403, detail="NO_PASSWORD_SET")
    if _hash_password(req.password) != stored_hash:
        raise HTTPException(status_code=401, detail="WRONG_PASSWORD")
    return {
        "id": teacher["id"], "name": teacher["name"],
        "subject": teacher["subject"] or "", "grade": teacher["grade"] or 2,
        "school_name": teacher["school_name"] or "",
        "preferred_language": teacher["preferred_language"] or "hi"
    }

@app.get("/api/auth/teacher/check")
def teacher_check_email(email: str):
    """Check if a teacher account already exists for a given email."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email FROM teachers WHERE email = ?", (email,))
    teacher = cursor.fetchone()
    conn.close()
    if teacher:
        return {"exists": True, "name": teacher["name"]}
    return {"exists": False}

@app.post("/api/students/register")
def register_student(req: StudentRegisterRequest):
    student_id = "S-" + str(uuid.uuid4())[:8]
    now = time.time()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO students (id, name, grade, section, school_name, preferred_language, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (student_id, req.name, req.grade, req.section, req.school_name, req.preferred_language, now))
    conn.commit()
    conn.close()
    return {
        "id": student_id,
        "name": req.name,
        "grade": req.grade,
        "section": req.section,
        "school_name": req.school_name,
        "preferred_language": req.preferred_language,
        "created_at": now
    }

# Session Management
@app.post("/api/sessions")
def create_session(req: CreateSessionRequest):
    session_id = str(uuid.uuid4())[:8]
    now = time.time()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO sessions (id, teacher_id, teacher_name, course_name, grade, teaching_language, mode, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'LECTURE', 1, ?)
    ''', (session_id, req.teacher_id, req.teacher_name, req.course_name, req.grade, req.teaching_language, now))
    conn.commit()
    conn.close()

    return {
        "session_id": session_id,
        "teacher_name": req.teacher_name,
        "course_name": req.course_name,
        "grade": req.grade,
        "teaching_language": req.teaching_language,
        "mode": "LECTURE"
    }

@app.get("/api/sessions/active")
def get_active_sessions():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions WHERE is_active = 1 ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    
    sessions = [dict(row) for row in rows]
    return {"sessions": sessions}

@app.post("/api/sessions/{session_id}/join")
def join_session(session_id: str, req: JoinSessionRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions WHERE id = ? AND is_active = 1", (session_id,))
    session = cursor.fetchone()
    if not session:
        conn.close()
        raise HTTPException(status_code=404, detail="Active session not found")

    participant_id = str(uuid.uuid4())[:8]
    now = time.time()
    cursor.execute('''
    INSERT INTO participants (id, session_id, student_id, student_name, preferred_language, raised_hand, can_speak, joined_at)
    VALUES (?, ?, ?, ?, ?, 0, 0, ?)
    ''', (participant_id, session_id, req.student_id, req.student_name, req.preferred_language, now))
    conn.commit()
    conn.close()

    return {
        "participant_id": participant_id,
        "session_id": session_id,
        "student_name": req.student_name,
        "preferred_language": req.preferred_language,
        "course_name": session["course_name"],
        "teaching_language": session["teaching_language"]
    }

# Speech Translation Broadcast
@app.post("/api/speech/broadcast")
async def broadcast_speech(req: BroadcastSpeechRequest):
    # Collect all unique languages in the session
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT preferred_language FROM participants WHERE session_id = ?", (req.session_id,))
    rows = cursor.fetchall()
    target_languages = list(set([row["preferred_language"] for row in rows] + [req.source_lang, "hi", "bn", "mr", "en"]))

    # Perform Fan-Out Translation
    translation_result = translate_speech(req.original_text, req.source_lang, target_languages)
    
    now = time.time()
    cursor.execute('''
    INSERT INTO transcripts (session_id, speaker_role, speaker_name, original_text, source_lang, translations_json, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (req.session_id, req.speaker_role, req.speaker_name, req.original_text, req.source_lang, json.dumps(translation_result["translations"]), now))
    conn.commit()
    conn.close()

    # Broadcast via WebSocket
    ws_event = {
        "type": "SPEECH_TRANSLATED",
        "session_id": req.session_id,
        "speaker_name": req.speaker_name,
        "speaker_role": req.speaker_role,
        "original_text": req.original_text,
        "source_lang": req.source_lang,
        "translations": translation_result["translations"],
        "ttfa_seconds": translation_result["ttfa_seconds"],
        "timestamp": now
    }
    await manager.broadcast_to_session(req.session_id, ws_event)

    return ws_event

# Raise Hand & Permissions
@app.post("/api/sessions/{session_id}/raise-hand")
async def raise_hand(session_id: str, participant_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE participants SET raised_hand = 1 WHERE id = ? AND session_id = ?", (participant_id, session_id))
    cursor.execute("SELECT * FROM participants WHERE id = ?", (participant_id,))
    p = cursor.fetchone()
    conn.commit()
    conn.close()

    if p:
        event = {
            "type": "RAISE_HAND_UPDATED",
            "participant_id": participant_id,
            "student_name": p["student_name"],
            "raised_hand": True
        }
        await manager.broadcast_to_session(session_id, event)
        return {"status": "SUCCESS", "raised_hand": True}
    raise HTTPException(status_code=404, detail="Participant not found")

@app.post("/api/sessions/{session_id}/approve-speaking")
async def approve_speaking(session_id: str, participant_id: str, allow: bool):
    conn = get_db_connection()
    cursor = conn.cursor()
    can_speak = 1 if allow else 0
    cursor.execute("UPDATE participants SET can_speak = ?, raised_hand = 0 WHERE id = ? AND session_id = ?", (can_speak, participant_id, session_id))
    cursor.execute("SELECT * FROM participants WHERE id = ?", (participant_id,))
    p = cursor.fetchone()
    conn.commit()
    conn.close()

    if p:
        event = {
            "type": "SPEAKING_PERMISSION_CHANGED",
            "participant_id": participant_id,
            "student_name": p["student_name"],
            "can_speak": allow
        }
        await manager.broadcast_to_session(session_id, event)
        return {"status": "SUCCESS", "can_speak": allow}
    raise HTTPException(status_code=404, detail="Participant not found")

# AI Content Generation & Teacher Approval Workflow
@app.post("/api/content/generate")
async def generate_content(req: GenerateContentRequest):
    activity_data = generate_nipun_content(req.transcript_summary, req.grade, req.activity_type, lang=req.language or "hi")
    activity_id = str(uuid.uuid4())[:8]
    now = time.time()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO nipun_activities (id, session_id, activity_type, title, domain, skill, grade, content_json, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
    ''', (
        activity_id,
        req.session_id,
        req.activity_type,
        activity_data["content"]["title"],
        activity_data["domain"],
        activity_data["skill"],
        req.grade,
        json.dumps(activity_data["content"]),
        now
    ))
    conn.commit()
    conn.close()

    result = {
        "activity_id": activity_id,
        "session_id": req.session_id,
        "activity_type": req.activity_type,
        "title": activity_data["content"]["title"],
        "domain": activity_data["domain"],
        "skill": activity_data["skill"],
        "grade": req.grade,
        "content": activity_data["content"],
        "status": "PENDING"
    }

    # Notify teacher app
    await manager.broadcast_to_session(req.session_id, {
        "type": "NEW_AI_CONTENT_GENERATED",
        "activity": result
    })

    return result

@app.post("/api/content/approve")
async def approve_content(req: ApproveContentRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE nipun_activities SET status = ? WHERE id = ?", (req.status, req.activity_id))
    cursor.execute("SELECT * FROM nipun_activities WHERE id = ?", (req.activity_id,))
    act = cursor.fetchone()
    conn.commit()
    conn.close()

    if act:
        activity_dict = dict(act)
        activity_dict["content"] = json.loads(activity_dict["content_json"])
        
        if req.status == "APPROVED":
            # Broadcast to all students in classroom!
            await manager.broadcast_to_session(act["session_id"], {
                "type": "ACTIVITY_PUBLISHED_TO_CLASS",
                "activity": activity_dict
            })
        return {"status": "SUCCESS", "activity_status": req.status}
    raise HTTPException(status_code=404, detail="Activity not found")

@app.get("/api/sessions/{session_id}/activities")
def get_session_activities(session_id: str, status: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    if status:
        cursor.execute("SELECT * FROM nipun_activities WHERE session_id = ? AND status = ? ORDER BY created_at DESC", (session_id, status))
    else:
        cursor.execute("SELECT * FROM nipun_activities WHERE session_id = ? ORDER BY created_at DESC", (session_id,))
    rows = cursor.fetchall()
    conn.close()

    activities = []
    for row in rows:
        item = dict(row)
        item["content"] = json.loads(item["content_json"])
        activities.append(item)
    return {"activities": activities}

# Student Submissions
@app.post("/api/submissions")
def submit_answer(req: SubmitAnswerRequest):
    submission_id = str(uuid.uuid4())[:8]
    now = time.time()
    score = random.randint(80, 100)

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO submissions (id, activity_id, student_id, student_name, answers_json, score, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (submission_id, req.activity_id, req.student_id, req.student_name, json.dumps(req.answers), score, now))
    conn.commit()
    conn.close()

    return {
        "submission_id": submission_id,
        "score": score,
        "status": "RECORDED_LOCALLY"
    }

# WebSocket Signaling Endpoint
@app.websocket("/ws/session/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            # Echo or process custom WS frames
            await manager.broadcast_to_session(session_id, message)
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
