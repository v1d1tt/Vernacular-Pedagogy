import uuid
import time
import json
import random
import sqlite3
import string
import hashlib
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import get_db_connection, init_db
from ai_engine import translate_speech, generate_nipun_content, transcribe_audio_chunk, translate_activity_content, LANGUAGES, NIPUN_KNOWLEDGE_BASE
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
    course_name: Optional[str] = "Mathematics"

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

class StreamChunkRequest(BaseModel):
    session_id: str
    speaker_name: str
    speaker_role: str
    source_lang: str
    audio_base64: str
    seq_num: int
    is_final: bool = False

class TeacherMicStateRequest(BaseModel):
    session_id: str
    is_live: bool
    speaker_name: str

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
    from ol_chiki import transliterate_ol_chiki_to_devanagari
    clean_text = text.strip()
    if lang == "sat" or any('\u1c50' <= ch <= '\u1c7f' for ch in clean_text):
        lang = "hi"
        clean_text = transliterate_ol_chiki_to_devanagari(clean_text)
    wav_bytes = edge_ai.synthesize_speech(clean_text, language=lang, speed=speed)
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
def _generate_join_code() -> str:
    """Generate a memorable 6-char alphanumeric join code (uppercase, no ambiguous chars)."""
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # No I, O, 0, 1
    return "".join(random.choices(chars, k=6))

@app.post("/api/sessions")
def create_session(req: CreateSessionRequest):
    session_id = str(uuid.uuid4())[:8]
    join_code = _generate_join_code()
    now = time.time()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    # Ensure code is unique (retry if collision)
    for _ in range(5):
        cursor.execute("SELECT id FROM sessions WHERE join_code = ? AND is_active = 1", (join_code,))
        if not cursor.fetchone():
            break
        join_code = _generate_join_code()
    cursor.execute('''
    INSERT INTO sessions (id, teacher_id, teacher_name, course_name, grade, teaching_language, mode, is_active, join_code, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'LECTURE', 1, ?, ?)
    ''', (session_id, req.teacher_id, req.teacher_name, req.course_name, req.grade, req.teaching_language, join_code, now))
    conn.commit()
    conn.close()

    return {
        "session_id": session_id,
        "teacher_name": req.teacher_name,
        "course_name": req.course_name,
        "grade": req.grade,
        "teaching_language": req.teaching_language,
        "join_code": join_code,
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

@app.get("/api/sessions/{session_id}")
def get_session(session_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
    session = cursor.fetchone()
    conn.close()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return dict(session)

@app.get("/api/sessions/by-code/{join_code}")
def get_session_by_code(join_code: str):
    """Lookup an active session by its 6-char join code (case-insensitive)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions WHERE UPPER(join_code) = ? AND is_active = 1", (join_code.strip().upper(),))
    session = cursor.fetchone()
    conn.close()
    if not session:
        raise HTTPException(status_code=404, detail="SESSION_NOT_FOUND")
    return dict(session)

@app.get("/api/teachers/{teacher_identifier}/sessions")
def get_teacher_sessions(teacher_identifier: str):
    """Retrieve all classrooms (both active and past) created by a teacher."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.*, 
               (SELECT COUNT(*) FROM participants p WHERE p.session_id = s.id) AS participant_count
        FROM sessions s
        WHERE s.teacher_id = ? OR s.teacher_name = ?
        ORDER BY s.created_at DESC
    ''', (teacher_identifier, teacher_identifier))
    rows = cursor.fetchall()
    conn.close()
    return {"sessions": [dict(r) for r in rows]}

@app.post("/api/sessions/{session_id}/end")
async def end_session(session_id: str):
    """Marks a classroom session as ended/inactive."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE sessions SET is_active = 0 WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()
    await manager.broadcast_to_session(session_id, {
        "type": "SESSION_ENDED",
        "session_id": session_id,
        "message": "Classroom session has ended"
    })
    return {"status": "SUCCESS", "session_id": session_id, "is_active": 0}

@app.post("/api/sessions/{session_id}/reactivate")
async def reactivate_session(session_id: str):
    """Reactivates an existing classroom session."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE sessions SET is_active = 1 WHERE id = ?", (session_id,))
    cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
    session = cursor.fetchone()
    conn.commit()
    conn.close()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return dict(session)

@app.post("/api/sessions/{session_id}/join")
def join_session(session_id: str, req: JoinSessionRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions WHERE (id = ? OR UPPER(join_code) = ?) AND is_active = 1", (session_id, session_id.strip().upper()))
    session = cursor.fetchone()
    if not session:
        conn.close()
        raise HTTPException(status_code=404, detail="Active session not found")

    real_session_id = session["id"]
    participant_id = str(uuid.uuid4())[:8]
    now = time.time()
    cursor.execute('''
    INSERT INTO participants (id, session_id, student_id, student_name, preferred_language, raised_hand, can_speak, joined_at)
    VALUES (?, ?, ?, ?, ?, 0, 0, ?)
    ''', (participant_id, real_session_id, req.student_id, req.student_name, req.preferred_language, now))
    conn.commit()
    conn.close()

    return {
        "participant_id": participant_id,
        "session_id": real_session_id,
        "student_name": req.student_name,
        "preferred_language": req.preferred_language,
        "course_name": session["course_name"],
        "grade": session["grade"],
        "teaching_language": session["teaching_language"]
    }

# Speech Translation Broadcast
@app.post("/api/speech/broadcast")
async def broadcast_speech(req: BroadcastSpeechRequest):
    # Main 3 working languages: Hindi (hi), Santali (sat), English (en)
    # Target only the remaining languages (excluding original source language)
    target_languages = [l for l in ["hi", "sat", "en"] if l != req.source_lang]
    if not target_languages:
        target_languages = ["hi", "sat", "en"]

    # Perform Fan-Out Translation
    translation_result = translate_speech(req.original_text, req.source_lang, target_languages)
    
    now = time.time()
    conn = get_db_connection()
    cursor = conn.cursor()
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

@app.post("/api/speech/mic-state")
async def update_mic_state(req: TeacherMicStateRequest):
    event = {
        "type": "TEACHER_MIC_STATE",
        "session_id": req.session_id,
        "is_live": req.is_live,
        "speaker_name": req.speaker_name,
        "timestamp": time.time()
    }
    await manager.broadcast_to_session(req.session_id, event)
    return {"status": "SUCCESS", "is_live": req.is_live}

@app.post("/api/speech/stream-chunk")
async def process_stream_chunk(req: StreamChunkRequest):
    import base64
    import numpy as np

    if not req.audio_base64 or not req.audio_base64.strip():
        if req.is_final:
            await manager.broadcast_to_session(req.session_id, {
                "type": "STREAM_FLUSH_COMPLETED",
                "session_id": req.session_id,
                "seq_num": req.seq_num
            })
        return {"text": "", "is_speech": False, "is_final": req.is_final}

    try:
        raw_bytes = base64.b64decode(req.audio_base64)
        audio_array = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        asr_res = transcribe_audio_chunk(audio_array, sample_rate=16000, lang=req.source_lang or "hi")
        
        text = asr_res.get("text", "").strip()
        if text:
            target_languages = [l for l in ["hi", "sat", "en"] if l != req.source_lang]
            if not target_languages:
                target_languages = ["hi", "sat", "en"]

            tr_res = translate_speech(text, req.source_lang, target_languages)
            now = time.time()
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('''
            INSERT INTO transcripts (session_id, speaker_role, speaker_name, original_text, source_lang, translations_json, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (req.session_id, req.speaker_role, req.speaker_name, text, req.source_lang, json.dumps(tr_res["translations"]), now))
            conn.commit()
            conn.close()

            ws_event = {
                "type": "SPEECH_TRANSLATED",
                "session_id": req.session_id,
                "speaker_name": req.speaker_name,
                "speaker_role": req.speaker_role,
                "original_text": text,
                "source_lang": req.source_lang,
                "translations": tr_res["translations"],
                "ttfa_seconds": tr_res["ttfa_seconds"],
                "timestamp": now,
                "seq_num": req.seq_num,
                "is_final": req.is_final
            }
            await manager.broadcast_to_session(req.session_id, ws_event)

            if req.is_final:
                await manager.broadcast_to_session(req.session_id, {
                    "type": "STREAM_FLUSH_COMPLETED",
                    "session_id": req.session_id,
                    "seq_num": req.seq_num
                })

            return ws_event

        if req.is_final:
            await manager.broadcast_to_session(req.session_id, {
                "type": "STREAM_FLUSH_COMPLETED",
                "session_id": req.session_id,
                "seq_num": req.seq_num
            })

        return {"text": "", "is_speech": False, "is_final": req.is_final}

    except Exception as e:
        if req.is_final:
            await manager.broadcast_to_session(req.session_id, {
                "type": "STREAM_FLUSH_COMPLETED",
                "session_id": req.session_id,
                "seq_num": req.seq_num
            })
        raise HTTPException(status_code=400, detail=f"Streaming chunk error: {str(e)}")

# Raise Hand & Permissions
@app.post("/api/sessions/{session_id}/raise-hand")
async def raise_hand(session_id: str, participant_id: str, raised: bool = True):
    conn = get_db_connection()
    cursor = conn.cursor()
    val = 1 if raised else 0
    cursor.execute("UPDATE participants SET raised_hand = ? WHERE id = ? AND session_id = ?", (val, participant_id, session_id))
    cursor.execute("SELECT * FROM participants WHERE id = ?", (participant_id,))
    p = cursor.fetchone()
    conn.commit()
    conn.close()

    if p:
        event = {
            "type": "RAISE_HAND_UPDATED",
            "participant_id": participant_id,
            "student_name": p["student_name"],
            "raised_hand": raised
        }
        await manager.broadcast_to_session(session_id, event)
        return {"status": "SUCCESS", "raised_hand": raised}
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
    # Fetch all transcripts from this session to build a rich lesson summary
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT original_text, source_lang FROM transcripts WHERE session_id = ? ORDER BY timestamp ASC LIMIT 50",
        (req.session_id,)
    )
    rows = cursor.fetchall()

    target_lang = req.language
    cursor.execute("SELECT teaching_language, course_name FROM sessions WHERE id = ?", (req.session_id,))
    s_row = cursor.fetchone()
    if not target_lang and s_row and s_row["teaching_language"]:
        target_lang = s_row["teaching_language"]
    subject_val = req.course_name or (s_row["course_name"] if s_row and s_row["course_name"] else "Mathematics")
    conn.close()

    # Build a combined lesson transcript from actual speech
    lesson_texts = [r["original_text"] for r in rows if r["original_text"] and r["original_text"].strip()]
    if req.transcript_summary and req.transcript_summary.strip() and req.transcript_summary.strip() not in lesson_texts:
        lesson_texts.append(req.transcript_summary.strip())

    FALLBACK_LESSON_SUMMARIES = {
        "hi": "आज का प्राथमिक पाठ एवं अभ्यास",
        "sat": "ᱛᱮᱦᱮᱧᱟᱜ ᱪᱟᱱᱚᱪ ᱨᱮᱱᱟᱜ ᱢᱩᱬᱩᱛ ᱯᱟᱴ",
        "bn": "আজকের ক্লাসের প্রাথমিক পাঠ",
        "mr": "आजच्या वर्गाचा प्राथमिक पाठ",
        "ta": "இன்றைய பாடத்தின் முக்கிய பகுதிகள்",
        "te": "ఈ రోజు పాఠం యొక్క ప్రాథమిక విషయాలు",
        "en": "Today's Primary Lesson"
    }
    fallback_summary = FALLBACK_LESSON_SUMMARIES.get(target_lang or "en", "Today's Primary Lesson")
    full_transcript = " ".join(lesson_texts) if lesson_texts else req.transcript_summary or fallback_summary

    activity_data = generate_nipun_content(full_transcript, req.grade, req.activity_type, lang=target_lang or "en", subject=subject_val)
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

@app.get("/api/sessions/{session_id}/raised-hands")
def get_raised_hands(session_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, student_id, student_name, preferred_language FROM participants WHERE session_id = ? AND raised_hand = 1 ORDER BY joined_at ASC", (session_id,))
    rows = cursor.fetchall()
    conn.close()
    return {"raised_hands": [dict(r) for r in rows]}

@app.get("/api/sessions/{session_id}/activities")
def get_session_activities(session_id: str, status: Optional[str] = None, lang: Optional[str] = None):
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
        raw_content = json.loads(item["content_json"])
        if lang:
            item["content"] = translate_activity_content(raw_content, lang)
        else:
            item["content"] = raw_content
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
