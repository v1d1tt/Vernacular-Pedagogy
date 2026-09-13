import sqlite3
import json
import time
from typing import Dict, Any, List, Optional

DB_FILE = "edge_classroom.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Sessions table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        teacher_id TEXT NOT NULL,
        teacher_name TEXT NOT NULL,
        course_name TEXT NOT NULL,
        grade INTEGER NOT NULL,
        teaching_language TEXT NOT NULL,
        mode TEXT DEFAULT 'LECTURE',
        is_active INTEGER DEFAULT 1,
        created_at REAL NOT NULL
    )
    ''')

    # Participants table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        preferred_language TEXT NOT NULL,
        raised_hand INTEGER DEFAULT 0,
        can_speak INTEGER DEFAULT 0,
        joined_at REAL NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
    )
    ''')

    # Transcripts log table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        speaker_role TEXT NOT NULL,
        speaker_name TEXT NOT NULL,
        original_text TEXT NOT NULL,
        source_lang TEXT NOT NULL,
        translations_json TEXT NOT NULL,
        timestamp REAL NOT NULL
    )
    ''')

    # NIPUN Activities table (Quizzes, Flashcards, Worksheets)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS nipun_activities (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        title TEXT NOT NULL,
        domain TEXT NOT NULL,
        skill TEXT NOT NULL,
        grade INTEGER NOT NULL,
        content_json TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        created_at REAL NOT NULL
    )
    ''')

    # Submissions table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        activity_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        answers_json TEXT NOT NULL,
        score INTEGER,
        submitted_at REAL NOT NULL
    )
    ''')

    # Registered Teachers table (Google SSO + Password Auth)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS teachers (
        id TEXT PRIMARY KEY,
        email TEXT DEFAULT '',
        name TEXT NOT NULL,
        picture TEXT DEFAULT '',
        preferred_language TEXT DEFAULT 'en',
        subject TEXT DEFAULT '',
        grade INTEGER DEFAULT 2,
        school_name TEXT DEFAULT '',
        password_hash TEXT DEFAULT '',
        created_at REAL NOT NULL
    )
    ''')
    # Migrate: add new columns if they don't exist yet (for existing DBs)
    for col, col_def in [
        ("subject", "TEXT DEFAULT ''"),
        ("grade", "INTEGER DEFAULT 2"),
        ("school_name", "TEXT DEFAULT ''"),
        ("password_hash", "TEXT DEFAULT ''"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE teachers ADD COLUMN {col} {col_def}")
        except Exception:
            pass  # Column already exists

    # Registered Students table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        grade INTEGER NOT NULL,
        section TEXT NOT NULL,
        school_name TEXT NOT NULL,
        preferred_language TEXT NOT NULL,
        created_at REAL NOT NULL
    )
    ''')

    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

init_db()
