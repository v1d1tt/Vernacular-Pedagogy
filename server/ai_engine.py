import time
import json
import logging
from typing import Dict, Any, List, Optional
import numpy as np

from model_manager import edge_ai, INDIC_LANG_MAP, WHISPER_SANTALI_HF_ID

logger = logging.getLogger("ai_engine")

# Supported classroom languages
LANGUAGES = {
    "hi": "Hindi (हिंदी)",
    "bn": "Bengali (বাংলা)",
    "mr": "Marathi (मराठी)",
    "ta": "Tamil (தமிழ்)",
    "te": "Telugu (తెలుగు)",
    "en": "English",
    "sat": "Santali (ᱥᱟᱱᱛᱟᱲᱤ)"
}

# Local NIPUN Bharat FLN Knowledge Base
NIPUN_KNOWLEDGE_BASE = [
    {
        "domain": "Literacy",
        "grade": 1,
        "skill": "Letter Sounds & Vocabulary",
        "outcome": "Identify initial sounds of common words and name everyday objects",
        "sample_words": {
            "hi": ["फल", "सेब", "पेड़", "सूरज"],
            "bn": ["ফল", "আপেল", "গাছ", "সূর্য"],
            "mr": ["फळ", "सफरचंद", "झाड", "सूर्य"],
            "en": ["Fruit", "Apple", "Tree", "Sun"],
            "sat": ["ᱫᱟᱨᱮ", "ᱥᱮᱣ", "ᱵᱟᱦᱟ", "ᱧᱤᱫᱟᱹ"]
        }
    },
    {
        "domain": "Literacy",
        "grade": 2,
        "skill": "Sentence Reading & Comprehension",
        "outcome": "Read short sentences with understanding and answer simple questions",
        "sample_words": {
            "hi": ["रोहन स्कूल जाता है।", "चिड़िया गाना गाती है।"],
            "en": ["Rohan goes to school.", "The bird sings a song."],
            "sat": ["ᱨᱚᱦᱟᱱ ᱤᱥᱠᱩᱞ ᱡᱟᱣᱟ᱾", "ᱪᱮᱬᱮ ᱦᱩᱲᱩ ᱫᱟᱲᱮᱭᱟᱭ᱾"]
        }
    },
    {
        "domain": "Numeracy",
        "grade": 1,
        "skill": "Counting & Number Sense",
        "outcome": "Count objects up to 20 and compare quantities",
        "sample_concepts": ["Counting apples", "Matching numbers with visuals"]
    },
    {
        "domain": "Numeracy",
        "grade": 2,
        "skill": "Addition & Subtraction",
        "outcome": "Add and subtract 2-digit numbers using visual groups and number lines",
        "sample_concepts": ["Visual group addition", "Number line jumps"]
    },
    {
        "domain": "Numeracy",
        "grade": 3,
        "skill": "Basic Multiplication & Shapes",
        "outcome": "Multiply single-digit numbers and identify basic geometric shapes",
        "sample_concepts": ["Times tables (2x, 3x)", "Triangle, Square, Circle identification"]
    },
]

# Curated classroom phrase translations (fast lookup before neural MT)
# Santali entries are in native Ol Chiki script
CLASSROOM_LEXICON = {
    "नमस्ते बच्चों, आज हम गणित में जोड़ना सीखेंगे।": {
        "en": "Hello children, today we will learn addition in mathematics.",
        "hi": "नमस्ते बच्चों, आज हम गणित में जोड़ना सीखेंगे।",
        "bn": "নমস্কার বাচ্চারা, আজ আমরা গণিতে যোগ শিখব।",
        "mr": "नमस्ते मुलांनो, आज आपण गणितात बेरीज शिकणार आहोत.",
        "ta": "வணக்கம் குழந்தைகளே, இன்று நாம் கணிதத்தில் கூட்டல் கற்போம்.",
        "te": "నమస్తే పిల్లలు, ఈ రోజు మనం గణితంలో కూడిక నేర్చుకుందాం.",
        "sat": "ᱡᱚᱦᱟᱨ ᱜᱤᱫᱽᱨᱟᱹ, ᱛᱮᱦᱮᱧ ᱟᱵᱚ ᱮᱞᱠᱷᱟ ᱨᱮ ᱡᱚᱲ ᱵᱚᱱ ᱪᱮᱫᱚᱜᱼᱟ᱾",
    },
    "Hello children, today we will learn new things in mathematics.": {
        "en": "Hello children, today we will learn new things in mathematics.",
        "hi": "नमस्ते बच्चों, आज हम गणित में नई चीज़ें सीखेंगे।",
        "bn": "নমস্কার বাচ্চারা, আজ আমরা গণিতে নতুন কিছু শিখব।",
        "mr": "नमस्कार मुलांनो, आज आपण गणितात नवीन गोष्टी शिकणार आहोत.",
        "ta": "வணக்கம் குழந்தைகளே, இன்று நாம் கணிதத்தில் புதிய விஷயங்களைக் கற்றுக்கொள்வோம்.",
        "te": "నమస్కారం పిల్లలు, ఈరోజు మనం గణితంలో కొత్త విషయాలు నేర్చుకుందాం.",
        "sat": "ᱡᱚᱦᱟᱨ ᱜᱤᱫᱽᱨᱟᱹ, ᱛᱮᱦᱮᱧ ᱟᱵᱚ ᱮᱞᱠᱷᱟ ᱨᱮ ᱱᱟᱶᱟ ᱡᱤᱱᱤᱥ ᱵᱚᱱ ᱪᱮᱫᱚᱜᱼᱟ᱾",
    },
    "Today we will learn addition in mathematics.": {
        "en": "Today we will learn addition in mathematics.",
        "hi": "आज हम गणित में जोड़ना सीखेंगे।",
        "bn": "আজ আমরা গণিতে যোগ শিখব।",
        "mr": "आज आपण गणितात बेरीज शिकणार आहोत.",
        "ta": "இன்று நாம் கணிதத்தில் கூட்டல் கற்போம்.",
        "te": "ఈ రోజు మనం గణితంలో కూడిక నేర్చుకుందాం.",
        "sat": "ᱛᱮᱦᱮᱧ ᱟᱵᱚ ᱮᱞᱠᱷᱟ ᱨᱮ ᱡᱚᱲ ᱵᱚᱱ ᱪᱮᱫᱚᱜᱼᱟ᱾",
    },
    "पेड़ पर कितने सेब हैं?": {
        "en": "How many apples are on the tree?",
        "hi": "पेड़ पर कितने सेब हैं?",
        "bn": "গাছে কয়টি আপেল আছে?",
        "mr": "झाडावर किती सफरचंद आहेत?",
        "ta": "மரத்தில் எத்தனை ஆப்பிள்கள் உள்ளன?",
        "te": "చెట్టుపై ఎన్ని ఆపిల్స్ ఉన్నాయి?",
        "sat": "ᱫᱟᱨᱮ ᱨᱮ ᱛᱤᱱᱟᱹᱜ ᱥᱮᱣ ᱢᱮᱱᱟᱜᱼᱟ?",
    },
    "How many apples are on the tree?": {
        "en": "How many apples are on the tree?",
        "hi": "पेड़ पर कितने सेब हैं?",
        "bn": "গাছে কয়টি আপেল আছে?",
        "mr": "झाडावर किती सफरचंद आहेत?",
        "ta": "மரத்தில் எத்தனை ஆப்பிள்கள் உள்ளன?",
        "te": "చెట్టుపై ఎన్ని ఆపిల్స్ ఉన్నాయి?",
        "sat": "ᱫᱟᱨᱮ ᱨᱮ ᱛᱤᱱᱟᱹᱜ ᱥᱮᱣ ᱢᱮᱱᱟᱜᱼᱟ?",
    },
    "तीन में दो जोड़ने पर कितना होगा?": {
        "en": "What do we get when we add two to three?",
        "bn": "তিনের সাথে দুই যোগ করলে কত হয়?",
        "mr": "तीन अधिक दोन किती होतात?",
        "ta": "மூன்றுடன் இரண்டைக் கூட்டினால் எவ்வளவு?",
        "te": "మూడుకు రెండు కలిపితే ఎంత అవుతుంది?",
        "sat": "ᱯᱮ ᱨᱮ ᱵᱟᱨ ᱡᱚᱲ ᱞᱮᱠᱷᱟᱱ ᱛᱤᱱᱟᱹᱜ ᱦᱩᱭᱩᱜᱼᱟ?",
    },
    "What do we get when we add two to three?": {
        "hi": "तीन में दो जोड़ने पर कितना होगा?",
        "bn": "তিনের সাথে দুই যোগ করলে কত হয়?",
        "mr": "तीन अधिक दोन किती होतात?",
        "ta": "மூன்றுடன் இரண்டைக் கூட்டினால் எவ்வளவு?",
        "te": "మూడుకు రెండు కలిపితే ఎంత అవుతుంది?",
        "en": "What do we get when we add two to three?",
        "sat": "ᱯᱮ ᱨᱮ ᱵᱟᱨ ᱡᱚᱲ ᱞᱮᱠᱷᱟᱱ ᱛᱤᱱᱟᱹᱜ ᱦᱩᱭᱩᱜᱼᱟ?",
    },
    "शाबाश! बहुत बढ़िया!": {
        "en": "Well done! Excellent!",
        "bn": "সাবাশ! খুব ভালো হয়েছে!",
        "mr": "शाब्बास! खूप छान!",
        "ta": "அருமை! நன்று!",
        "te": "శభాష్! చాలా బాగుంది!",
        "sat": "ᱵᱮᱥ ᱠᱟᱹᱢᱤ! ᱟᱹᱰᱤ ᱱᱟᱯᱟᱭ!",
    },
    "Well done! Excellent!": {
        "hi": "शाबाश! बहुत बढ़िया!",
        "bn": "সাবাশ! খুব ভালো হয়েছে!",
        "mr": "शाब्बास! खूप छान!",
        "ta": "அருமை! நன்று!",
        "te": "శభాష్! చాలా బాగుంది!",
        "en": "Well done! Excellent!",
        "sat": "ᱵᱮᱥ ᱠᱟᱹᱢᱤ! ᱟᱹᱰᱤ ᱱᱟᱯᱟᱭ!",
    },
}

def parse_voice_command(text: str) -> Optional[Dict[str, Any]]:
    """
    Parses teacher voice command shortcuts for automated classroom actions.
    Examples:
    - "generate quiz on addition" / "क्विज़ बनाओ" -> TRIGGER_QUIZ
    - "generate flashcards" / "फ्लैशकार्ड" -> TRIGGER_FLASHCARD
    - "mute all students" / "सबको म्यूट करो" -> MUTE_ALL
    """
    if not text:
        return None
    t_lower = text.lower().strip()
    if any(k in t_lower for k in ["generate quiz", "create quiz", "क्विज़", "क्विज़ बनाओ", "quiz"]):
        return {"command": "TRIGGER_QUIZ", "action": "Generate Quiz Activity"}
    elif any(k in t_lower for k in ["flashcards", "flashcard", "फ्लैशकार्ड", "कार्ड"]):
        return {"command": "TRIGGER_FLASHCARD", "action": "Generate Flashcards"}
    elif any(k in t_lower for k in ["mute all", "mute students", "म्यूट करो", "शांत"]):
        return {"command": "MUTE_ALL", "action": "Mute All Students"}
    return None

def transcribe_audio_chunk(audio_array: np.ndarray, sample_rate: int = 16000, lang: str = "hi") -> Dict[str, Any]:
    """
    Runs real Silero VAD and ASR pipeline.
    - Fast noise pre-filter (RMS/Energy check) to skip CPU compute on background silence
    - Santali (sat): whisper-small-santali-ol-chiki -> native Ol Chiki script
    - All other languages: sherpa-onnx Whisper-Tiny INT8
    """
    t_start = time.time()

    if audio_array is None or len(audio_array) == 0:
        return {
            "text": "",
            "is_speech": False,
            "latency_seconds": 0.0
        }

    # 0. Noise / Silence Fast Pre-filtering
    max_amp = np.max(np.abs(audio_array))
    mean_amp = np.mean(np.abs(audio_array))
    if max_amp < 0.012 or mean_amp < 0.0015:
        return {
            "text": "",
            "is_speech": False,
            "latency_seconds": round(time.time() - t_start, 3)
        }

    # 1. Voice Activity Detection
    has_speech = edge_ai.is_speech(audio_array[:min(512, len(audio_array))], sample_rate=sample_rate)
    if not has_speech and len(audio_array) < 16000:
        return {
            "text": "",
            "is_speech": False,
            "latency_seconds": round(time.time() - t_start, 3)
        }

    # 2. ASR Transcription (routes to correct model based on lang)
    text = edge_ai.transcribe(audio_array, sample_rate=sample_rate, language=lang)
    latency = round(time.time() - t_start, 3)

    engine = (
        WHISPER_SANTALI_HF_ID if lang == "sat"
        else "sherpa-onnx (indicconformer-hi)" if lang == "hi"
        else "sherpa-onnx (whisper-tiny-int8)"
    )
    voice_cmd = parse_voice_command(text)

    return {
        "text": text,
        "is_speech": bool(text and text.strip()),
        "latency_seconds": latency,
        "engine": engine,
        "detected_command": voice_cmd
    }

def translate_speech(original_text: str, source_lang: str, target_languages: List[str], start_time: Optional[float] = None) -> Dict[str, Any]:
    """
    Translates classroom speech from source language to target student languages.
    Uses native phrase mappings and IndicTrans2 runtime.
    Calculates actual end-to-end execution latency in seconds.
    """
    t_start = start_time if start_time is not None else time.time()
    translations: Dict[str, str] = {}
    clean_text = original_text.strip()

    # Check curated dictionary first
    lexicon_match = CLASSROOM_LEXICON.get(clean_text)
    if not lexicon_match:
        for lex_key, lex_translations in CLASSROOM_LEXICON.items():
            if lex_key.lower() in clean_text.lower() or clean_text.lower() in lex_key.lower():
                lexicon_match = lex_translations
                break

    # Always include the source language so students listening in the
    # teacher's own language get the original (callers may omit it).
    translations[source_lang] = clean_text

    for tgt in target_languages:
        if tgt == source_lang:
            translations[tgt] = clean_text
        elif lexicon_match and tgt in lexicon_match:
            translations[tgt] = lexicon_match[tgt]
        else:
            # Neural translation via IndicTrans2 ONNX INT8
            try:
                translated = edge_ai.translate_indic(clean_text, src_lang=source_lang, tgt_lang=tgt)
                if translated and translated.strip() and not translated.strip().startswith("["):
                    translations[tgt] = translated.strip()
                else:
                    translations[tgt] = translate_activity_item(clean_text, tgt)
            except Exception as e:
                logger.warning(f"Translation error: {e}")
                translations[tgt] = translate_activity_item(clean_text, tgt)

    # Calculate real TTFA (actual execution latency in seconds)
    elapsed = time.time() - t_start
    ttfa = round(max(0.03, elapsed), 2)

    return {
        "source_lang": source_lang,
        "original_text": original_text,
        "translations": translations,
        "ttfa_seconds": ttfa,
        "status": "SUCCESS",
        "edge_runtime": "ONNX Runtime (CPU/XNNPACK)"
    }

MULTILINGUAL_STOP_WORDS = {
    # English
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "shall",
    "should", "may", "might", "must", "can", "could", "this", "that",
    "these", "those", "i", "we", "you", "he", "she", "it", "they", "them",
    "our", "your", "his", "her", "its", "their", "what", "which", "who",
    "whom", "when", "where", "why", "how", "all", "each", "every", "both",
    "few", "more", "most", "other", "some", "such", "no", "nor", "not",
    "only", "same", "so", "than", "too", "very", "just", "and", "but",
    "or", "for", "of", "in", "on", "to", "at", "by", "from", "with",
    "about", "into", "through", "during", "before", "after", "above",
    "below", "up", "down", "out", "off", "over", "under", "again",
    "then", "once", "here", "there", "today", "learn", "learning",
    "will", "class", "grade", "children", "students", "let", "us",
    "hello", "namaste", "today", "about", "lesson", "topic",
    # Hindi
    "आज", "हम", "आप", "तुम", "मैं", "यह", "वह", "ये", "वे", "इस", "उस",
    "में", "को", "का", "की", "के", "से", "पर", "तक", "द्वारा", "ने",
    "है", "हैं", "था", "थी", "थे", "होगा", "होगी", "होंगे", "होना",
    "और", "तथा", "या", "अथवा", "लेकिन", "किंतु", "परंतु", "भी", "ही", "नहीं",
    "नमस्ते", "बच्चों", "बच्चे", "क्लास", "पाठ", "सीखेंगे", "सीखना", "करेंगे",
    "करो", "करें", "कहो", "बताओ", "चलो", "दीजिये", "लीजिये", "विषय",
    # Santali (Ol Chiki)
    "ᱛᱮᱦᱮᱧ", "ᱟᱵᱚ", "ᱤᱧ", "ᱟᱢ", "ᱩᱱᱤ", "ᱚᱱᱟ", "ᱱᱚᱣᱟ", "ᱨᱮ", "ᱨᱮᱱᱟᱜ", "ᱠᱷᱚᱱ",
    "ᱵᱚᱱ", "ᱜᱤᱫᱽᱨᱟᱹ", "ᱡᱚᱦᱟᱨ", "ᱦᱩᱭᱩᱜᱼᱟ", "ᱪᱮᱫᱚᱜᱼᱟ", "ᱢᱮᱱᱟᱜᱼᱟ", "ᱞᱟᱹᱭ", "ᱢᱮ", "ᱯᱟᱴ"
}

TEMPLATE_LEXICON = {
    # Titles & Stems
    "Quiz": {"hi": "प्रश्नोत्तरी (क्विज़)", "sat": "ᱠᱩᱠᱞᱤ ᱯᱟᱴ", "en": "Quiz"},
    "Vocabulary": {"hi": "शब्दावली", "sat": "ᱟᱹᱲᱟᱹ ᱜᱽᱭᱟᱱ", "en": "Vocabulary"},
    "Worksheet": {"hi": "कार्यपत्रक", "sat": "ᱠᱟᱹᱢᱤ ᱯᱟᱴ", "en": "Worksheet"},
    "Game": {"hi": "खेल गतिविधियाँ", "sat": "ᱮᱱᱮᱡ ᱠᱟᱹᱢᱤ", "en": "Interactive Game"},

    # Questions
    "Which main concept was taught in today's lesson?": {
        "hi": "आज के पाठ में मुख्य अवधारणा क्या सिखाई गई?",
        "sat": "ᱛᱮᱦᱮᱧᱟᱜ ᱯᱟᱴ ᱨᱮ ᱪᱮᱫ ᱢᱩᱬᱩᱛ ᱡᱤᱱᱤᱥ ᱵᱚᱱ ᱪᱮᱫᱮᱱᱟ?",
        "en": "Which main concept was taught in today's lesson?"
    },
    "How many letters are in the word?": {
        "hi": "शब्द में कितने अक्षर हैं?",
        "sat": "ᱟᱹᱲᱟᱹ ᱨᱮ ᱛᱤᱱᱟᱹᱜ ᱟᱠᱷᱚᱨ ᱢᱮᱱᱟᱜᱼᱟ?",
        "en": "How many letters are in the word?"
    },
    "Count and choose: 🌟🌟🌟 = ?": {
        "hi": "गिनें और चुनें: 🌟🌟🌟 = ?",
        "sat": "ᱞᱮᱠᱷᱟᱭ ᱢᱮ ᱟᱨ ᱵᱟᱪᱷᱟᱣ ᱢᱮ: 🌟🌟🌟 = ?",
        "en": "Count and choose: 🌟🌟🌟 = ?"
    },
    "In today's lesson, how many main ideas were shared?": {
        "hi": "आज के पाठ में कितने मुख्य विचार साझा किए गए?",
        "sat": "ᱛᱮᱦᱮᱧᱟᱜ ᱯᱟᱴ ᱨᱮ ᱛᱤᱱᱟᱹᱜ ᱢᱩᱬᱩᱛ ᱠᱟᱛᱷᱟ ᱞᱟᱹᱭᱮᱱᱟ?",
        "en": "In today's lesson, how many main ideas were shared?"
    },
    "What is 6 + 4?": {
        "hi": "6 + 4 का मान क्या है?",
        "sat": "᱖ + ᱔ ᱛᱤᱱᱟᱹᱜ ᱦᱩᱭᱩᱜᱼᱟ?",
        "en": "What is 6 + 4?"
    },
    "What is 3 × 4?": {
        "hi": "3 × 4 का मान क्या है?",
        "sat": "᱓ × ᱔ ᱛᱤᱱᱟᱹᱜ ᱦᱩᱭᱩᱜᱼᱟ?",
        "en": "What is 3 × 4?"
    },
    "Which word best describes the lesson topic?": {
        "hi": "पाठ के विषय का सबसे अच्छा वर्णन कौन सा शब्द करता है?",
        "sat": "ᱯᱟᱴ ᱨᱮᱱᱟᱜ ᱥᱟᱛᱟᱢ ᱚᱠᱟ ᱟᱹᱲᱟᱹ ᱥᱟᱹᱨᱤ ᱞᱟᱹᱭᱮᱫᱼᱟ?",
        "en": "Which word best describes the lesson topic?"
    },

    # Worksheet Tasks
    "Write 2 sentences about today's topic from class.": {
        "hi": "आज की कक्षा के विषय के बारे में 2 वाक्य लिखें।",
        "sat": "ᱛᱮᱦᱮᱧᱟᱜ ᱪᱟᱱᱚᱪ ᱨᱮᱱᱟᱜ ᱥᱟᱛᱟᱢ ᱵᱟᱵᱚᱛ ᱛᱮ ᱒ ᱴᱟᱝ ᱠᱟᱛᱷᱟ ᱚᱞ ᱢᱮ᱾",
        "en": "Write 2 sentences about today's topic from class."
    },
    "Draw or describe what the main concept means.": {
        "hi": "मुख्य अवधारणा का क्या अर्थ है, चित्र बनाएं या वर्णन करें।",
        "sat": "ᱢᱩᱬᱩᱛ ᱠᱟᱛᱷᱟ ᱨᱮᱱᱟᱜ ᱢᱮᱱᱮᱛ ᱪᱮᱫ ᱠᱟᱱᱟ, ᱪᱤᱛᱟᱹᱨ ᱵᱮᱱᱟᱣ ᱢᱮ ᱥᱮ ᱞᱟᱹᱭ ᱢᱮ᱾",
        "en": "Draw or describe what the main concept means."
    },
    "Fill in the blank: Today I learned about ______": {
        "hi": "रिक्त स्थान भरें: आज मैंने ______ के बारे में सीखा।",
        "sat": "ᱯᱮᱨᱮᱡ ᱢᱮ: ᱛᱮᱦᱮᱧ ᱤᱧ ______ ᱵᱟᱵᱚᱛ ᱛᱤᱧ ᱪᱮᱫᱮᱱᱟ᱾",
        "en": "Fill in the blank: Today I learned about ______"
    },

    # Flashcards
    "A key concept from today's lesson": {
        "hi": "आज के पाठ की एक मुख्य अवधारणा",
        "sat": "ᱛᱮᱦᱮᱧᱟᱜ ᱯᱟᱴ ᱨᱮᱱᱟᱜ ᱢᱤᱫ ᱢᱩᱬᱩᱛ ᱠᱟᱛᱷᱟ",
        "en": "A key concept from today's lesson"
    },
    "आज की कक्षा में किस मुख्य विषय या अवधारणा के बारे में सीखा गया?": {
        "hi": "आज की कक्षा में किस मुख्य विषय या अवधारणा के बारे में सीखा गया?",
        "sat": "ᱛᱮᱦᱮᱧᱟᱜ ᱪᱟᱱᱚᱪ ᱨᱮ ᱢᱩᱬᱩᱛ ᱞᱮᱠᱟᱛᱮ ᱪᱮᱫ ᱥᱟᱛᱟᱢ ᱪᱮᱛᱟᱱ ᱨᱮ ᱜᱟᱞᱢᱟᱨᱟᱣ ᱦᱩᱭᱮᱱᱟ?",
        "en": "What was the main topic or concept taught in today's lesson?",
        "bn": "আজকের ক্লাসে কোন মূল ধারণা বা বিষয়টি শেখানো হয়েছে?",
        "mr": "आजच्या पाठात मुख्यत्वे कोणत्या संकल्पनेवर चर्चा झाली?"
    },
    "Today's Topic": {
        "hi": "आज का विषय",
        "sat": "ᱛᱮᱦᱮᱧᱟᱜ ᱥᱟᱛᱟᱢ",
        "en": "Today's Topic"
    },
    "Learning": {
        "hi": "अधिगम (सीखना)",
        "sat": "ᱪᱮᱫᱚᱜ",
        "en": "Learning"
    },
    "Practice": {
        "hi": "अभ्यास",
        "sat": "ᱢᱩᱦᱤᱛ ᱚᱞ",
        "en": "Practice"
    }
}


# Curated educational terms and subject vocabulary translations across all supported languages
ACTIVITY_LEXICON: Dict[str, Dict[str, str]] = {
    "Grade 1": {"hi": "कक्षा 1", "sat": "ᱪᱟᱱᱟᱪ ᱑", "bn": "শ্রেণী ১", "mr": "वर्ग १", "ta": "வகுப்பு 1", "te": "తరగతి 1", "en": "Grade 1"},
    "Grade 2": {"hi": "कक्षा 2", "sat": "ᱪᱟᱱᱟᱪ ᱒", "bn": "শ্রেণী ২", "mr": "वर्ग २", "ta": "வகுப்பு 2", "te": "తరగతి 2", "en": "Grade 2"},
    "Grade 3": {"hi": "कक्षा 3", "sat": "ᱪᱟᱱᱟᱪ ᱓", "bn": "শ্রেণী ৩", "mr": "वर्ग ३", "ta": "வகுப்பு 3", "te": "తరగతి 3", "en": "Grade 3"},
    "Quiz": {"hi": "प्रश्नोत्तरी", "sat": "ᱠᱩᱠᱞᱤ ᱠᱷᱮᱞ", "bn": "কুইজ", "mr": "प्रश्नोत्तरी", "ta": "வினாடி வினா", "te": "క్విజ్", "en": "Quiz"},
    "Worksheet": {"hi": "कार्यपत्रक", "sat": "ᱣᱟᱨᱠᱥᱤᱴ", "bn": "ওয়ার্কশীট", "mr": "वर्कशीट", "ta": "பணித்தாள்", "te": "వర్క్‌షీట్", "en": "Worksheet"},
    "Vocabulary": {"hi": "शब्दावली", "sat": "ᱯᱷᱞᱮᱥ ᱠᱟᱨᱰ", "bn": "শব্দভাণ্ডার", "mr": "शब्दावली", "ta": "சொற்களஞ்சியம்", "te": "పదజాలం", "en": "Vocabulary"},
    "Concept": {"hi": "अवधारणा", "sat": "ᱥᱟᱛᱟᱢ", "bn": "ধারণা", "mr": "संकल्पना", "ta": "கருத்து", "te": "భావన", "en": "Concept"},
    "Answer:": {"hi": "उत्तर:", "sat": "ᱛᱮᱞᱟ:", "bn": "উত্তর:", "mr": "उत्तर:", "ta": "பதில்:", "te": "సమాధానం:", "en": "Answer:"},
    "Mathematics": {"hi": "गणित", "sat": "ᱮᱞᱠᱷᱟ", "bn": "গণিত", "mr": "गणित", "ta": "கணிதம்", "te": "గణితం", "en": "Mathematics"},
    "Literacy": {"hi": "साक्षरता एवं भाषा", "sat": "ᱚᱞ ᱟᱨ ᱯᱟᱹᱨᱥᱤ", "bn": "সাক্ষরতা", "mr": "साक्षरता", "ta": "எழுத்தறிவு", "te": "అక్షరాస్యత", "en": "Literacy"},
    "Science": {"hi": "पर्यावरण एवं विज्ञान", "sat": "ᱯᱚᱨᱤᱵᱮᱥ ᱟᱨ ᱥᱟᱭᱤᱱᱥ", "bn": "বিজ্ঞান", "mr": "विज्ञान", "ta": "அறிவியல்", "te": "సైన్స్", "en": "Science"},
    "EVS": {"hi": "पर्यावरण अध्ययन", "sat": "ᱯᱚᱨᱤᱵᱮᱥ ᱪᱮᱫᱚᱜ", "bn": "পরিবেশ পরিচিতি", "mr": "पर्यावरण अभ्यास", "ta": "சூழ்நிலையியல்", "te": "పరిసరాల విజ్ఞానం", "en": "EVS"},
    "General Knowledge": {"hi": "सामान्य ज्ञान", "sat": "ᱥᱟᱫᱷᱟᱨᱚᱱ ᱡᱟᱱᱟᱢ", "bn": "সাধারণ জ্ঞান", "mr": "सामान्य ज्ञान", "ta": "பொது அறிவு", "te": "సాధారణ పరిజ్ఞానం", "en": "General Knowledge"},
    "History": {"hi": "इतिहास", "sat": "ᱤᱛᱤᱦᱟᱥ", "bn": "ইতিহাস", "mr": "इतिहास", "ta": "வரலாறு", "te": "చరిత్ర", "en": "History"},
    "Geography": {"hi": "भूगोल", "sat": "ᱵᱷᱩᱜᱳᱞ", "bn": "ভূগোল", "mr": "भूगोल", "ta": "புவியியல்", "te": "భూగోళశాస్త్రం", "en": "Geography"},
    "Astronomy": {"hi": "खगोल विज्ञान", "sat": "ᱤᱯᱤᱞ ᱥᱟᱭᱤᱱᱥ", "bn": "জ্যোতির্বিদ্যা", "mr": "खगोलशास्त्र", "ta": "வானியல்", "te": "ఖగోళ శాస్త్రం", "en": "Astronomy"},
    "Cooking": {"hi": "पाक कला", "sat": "ᱫᱟᱠᱟ ᱩᱛᱩ", "bn": "রন্ধনশিল্প", "mr": "पाककला", "ta": "சமையல்", "te": "వంట", "en": "Cooking"},
    "Music": {"hi": "संगीत", "sat": "ᱥᱮᱨᱮᱧ", "bn": "সঙ্গীত", "mr": "संगीत", "ta": "இசை", "te": "<ctrl42>ᱥᱟᱝᱜᱤᱛ", "en": "Music"},
    "Painting": {"hi": "चित्रकला", "sat": "ᱪᱤᱛᱟᱹᱨ ᱚᱞ", "bn": "চিত্রকলা", "mr": "चित्रकला", "ta": "ஓவியம்", "te": "చిత్రలేఖనం", "en": "Painting"},
    "Reading": {"hi": "पठन (पढ़ना)", "sat": "ᱯᱟᱲᱦᱟᱣ", "bn": "পড়া", "mr": "वाचन", "ta": "வாசிப்பு", "te": "చదవడం", "en": "Reading"},
    "Sentences": {"hi": "वाक्य", "sat": "ᱠᱟᱛᱷᱟ", "bn": "বাক্য", "mr": "वाक्य", "ta": "வாக்கியங்கள்", "te": "వాక్యాలు", "en": "Sentences"},
    "Addition": {"hi": "जोड़ (योग)", "sat": "ᱡᱚᱲ", "bn": "যোগ", "mr": "बेरीज", "ta": "கூட்டல்", "te": "కూడిక", "en": "Addition"},
    "Subtraction": {"hi": "घटाव (अंतर)", "sat": "ᱵᱷᱮᱜᱟᱨ", "bn": "বিয়োগ", "mr": "वजाबाकी", "ta": "கழித்தல்", "te": "తీసివేత", "en": "Subtraction"},
    "Counting": {"hi": "गिनती (संख्याएँ)", "sat": "ᱞᱮᱠᱷᱟ", "bn": "গণনা", "mr": "मोजणी", "ta": "எண்ணிக்கை", "te": "లెక్కించడం", "en": "Counting"},
    "Shapes": {"hi": "आकृतियाँ (आकार)", "sat": "ᱪᱤᱛᱟᱹᱨ", "bn": "আকৃতি", "mr": "आकार", "ta": "வடிவங்கள்", "te": "ఆకారాలు", "en": "Shapes"},
    "Numbers": {"hi": "संख्याएँ", "sat": "ᱮᱞᱠᱷᱟ", "bn": "সংখ্যা", "mr": "संख्या", "ta": "எண்கள்", "te": "సంఖ్యలు", "en": "Numbers"},
    "Lesson": {"hi": "पाठ", "sat": "ᱯᱟᱴ", "bn": "পাঠ", "mr": "पाठ", "ta": "பாடம்", "te": "పాఠం", "en": "Lesson"},
    "General": {"hi": "सामान्य", "sat": "ᱥᱟᱫᱷᱟᱨᱚᱱ", "bn": "সাধারণ", "mr": "सामान्य", "ta": "பொது", "te": "సాధారణ", "en": "General"}
}

def translate_activity_item(text: str, target_lang: str) -> str:
    """Translates text items into target student/teacher language script."""
    if not text:
        return ""
    clean = text.strip()
    if clean in ACTIVITY_LEXICON and target_lang in ACTIVITY_LEXICON[clean]:
        return ACTIVITY_LEXICON[clean][target_lang]
    if clean in TEMPLATE_LEXICON and target_lang in TEMPLATE_LEXICON[clean]:
        return TEMPLATE_LEXICON[clean][target_lang]
    if clean in CLASSROOM_LEXICON and target_lang in CLASSROOM_LEXICON[clean]:
        return CLASSROOM_LEXICON[clean][target_lang]

    # Case-insensitive / substring lookup in ACTIVITY_LEXICON
    for key, val_map in ACTIVITY_LEXICON.items():
        if key.lower() == clean.lower() and target_lang in val_map:
            return val_map[target_lang]

    # Neural MT fallback
    if target_lang != "en":
        try:
            translated = edge_ai.translate_indic(clean, src_lang="en", tgt_lang=target_lang)
            if translated and translated.strip() and not translated.startswith("["):
                return translated.strip()
        except Exception as e:
            logger.warning(f"MT activity translate failed: {e}")

    return clean


def _extract_keywords(transcript: str) -> list:
    """
    Extract meaningful lesson keywords and concepts from a lesson transcript (supports Multilingual/Unicode).
    """
    import re
    if not transcript or not transcript.strip():
        return []

    # Clean punctuation preserving Devanagari/Ol Chiki word characters
    clean_text = re.sub(r"[^\w\s]", " ", transcript)
    words = clean_text.split()

    freq: dict = {}
    for w in words:
        w_clean = w.strip()
        w_lower = w_clean.lower()
        if len(w_clean) >= 2 and w_lower not in MULTILINGUAL_STOP_WORDS and not w_clean.isdigit():
            freq[w_clean] = freq.get(w_clean, 0) + 1

    sorted_kw = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    extracted = [k for k, _ in sorted_kw[:12]]
    return extracted


def _build_quiz_from_transcript(transcript: str, grade: int, slm_question: str, lang: str = "hi", subject: str = "Mathematics") -> dict:
    """Next-level NIPUN-aligned adaptive quiz: 5 questions, hints, explanations, difficulty, visuals."""
    import random
    keywords = _extract_keywords(transcript)

    subj_clean = (subject or "Mathematics").lower()
    if "math" in subj_clean or "गणित" in subj_clean or "ᱮᱞᱠᱷᱟ" in subj_clean:
        domain = "Numeracy"
        default_topics = ["Addition", "Subtraction", "Counting", "Shapes", "Numbers"]
        nipun_skill = "Addition & Subtraction" if grade == 2 else "Counting & Number Sense" if grade == 1 else "Basic Multiplication & Shapes"
        nipun_id = "num-3-1" if grade >= 3 else "num-2-1" if grade == 2 else "num-1-1"
        visuals_pool = ["🔢", "➕", "🔷", "🍎🍎🍎", "📐"]
    elif "literacy" in subj_clean or "language" in subj_clean or "भाषा" in subj_clean or "ᱚᱞ" in subj_clean:
        domain = "Literacy"
        default_topics = ["Alphabet", "Sentences", "Reading", "Grammar", "Vocabulary"]
        nipun_skill = "Sentence Reading & Comprehension" if grade >= 2 else "Letter Sounds & Vocabulary"
        nipun_id = "lit-1-2" if grade == 1 else "lit-1-1"
        visuals_pool = ["🔤", "📖", "✍️", "🗣️", "📚"]
    elif "science" in subj_clean or "evs" in subj_clean or "पर्यावरण" in subj_clean or "ᱯᱚᱨᱤᱵᱮᱥ" in subj_clean:
        domain = "EVS"
        default_topics = ["Plants", "Animals", "Water Cycle", "Environment", "Weather"]
        nipun_skill = "Living Things & Environment"
        nipun_id = "evs-1-1"
        visuals_pool = ["🌿", "🐘", "💧", "🌞", "🍃"]
    else:
        domain = "General Knowledge"
        default_topics = ["History", "Geography", "Festivals", "General Knowledge", "Lessons"]
        nipun_skill = "General Awareness"
        nipun_id = "gk-1-1"
        visuals_pool = ["💡", "🌍", "🎯", "🌟", "📚"]

    NOISE_WORDS = {"maths", "math", "tan", "tham", "ev", "abh", "sub", "deg", "var", "the", "and", "lesson", "topic"}
    valid_kw = [k for k in keywords if len(k) >= 3 and k.lower() not in NOISE_WORDS]
    kw_pool = list(valid_kw)
    for fb in default_topics:
        if fb not in kw_pool:
            kw_pool.append(fb)
    # Ensure at least 5 topics
    while len(kw_pool) < 5:
        kw_pool.append(random.choice(default_topics))

    raw_topics = kw_pool[:5]
    topics = [translate_activity_item(rt, lang) for rt in raw_topics]

    distractor_pool = [
        translate_activity_item("History", lang),
        translate_activity_item("Geography", lang),
        translate_activity_item("Astronomy", lang),
        translate_activity_item("Cooking", lang),
        translate_activity_item("Music", lang),
        translate_activity_item("Painting", lang),
    ]

    is_valid_slm = False
    if slm_question and len(slm_question.strip()) > 12 and lang == "en":
        low_q = slm_question.lower()
        off_topic_words = ["france", "capital", "paris", "president", "washington", "country", "scholarship", "election"]
        if not any(w in low_q for w in off_topic_words):
            is_valid_slm = True

    def localized_q(base_en: str, hi: str, sat: str, bn: str, mr: str, ta: str, te: str) -> str:
        mp = {"hi": hi, "sat": sat, "bn": bn, "mr": mr, "ta": ta, "te": te, "en": base_en}
        return mp.get(lang, base_en)

    # Q1: Main topic recall (EASY)
    q1_text = translate_activity_item(slm_question.strip(), lang) if is_valid_slm else localized_q(
        "What was the main topic or concept taught in today's lesson?",
        "आज की कक्षा में किस मुख्य विषय या अवधारणा के बारे में सीखा गया?",
        "ᱛᱮᱦᱮᱧᱟᱜ ᱪᱟᱱᱚᱪ ᱨᱮ ᱢᱩᱬᱩᱛ ᱞᱮᱠᱟᱛᱮ ᱪᱮᱫ ᱥᱟᱛᱟᱢ ᱪᱮᱛᱟᱱ ᱨᱮ ᱜᱟᱞᱢᱟᱨᱟᱣ ᱦᱩᱭᱮᱱᱟ?",
        "আজকের ক্লাসে কোন মূল ধারণা বা বিষয়টি শেখানো হয়েছে?",
        "आजच्या पाठात मुख्यत्वे कोणत्या संकल्पनेवर चर्चा झाली?",
        "இன்றைய பாடத்தில் முக்கியமாக கற்பிக்கப்பட்ட கருத்து என்ன?",
        "ఈరోజు పాఠంలో ప్రధాన అంశం ఏమిటి?"
    )
    q1_opts = [topics[0], topics[1], distractor_pool[0], distractor_pool[1]]
    random.shuffle(q1_opts)

    # Q2: Association (MEDIUM)
    q2_text = localized_q(
        f"In today's lesson, which key idea is directly associated with '{topics[1]}'?",
        f"आज के पाठ के अनुसार, '{topics[1]}' से कौन सी बात सीधे संबंधित है?",
        f"ᱛᱮᱦᱮᱧᱟᱜ ᱯᱟᱴ ᱞᱮᱠᱟᱛᱮ, '{topics[1]}' ᱥᱟᱶ ᱚᱠᱟ ᱠᱟᱛᱷᱟ ᱡᱚᱲᱟᱣ ᱢᱮᱱᱟᱜᱼᱟ?",
        f"আজকের পাঠ অনুসারে, '{topics[1]}'-এর সাথে কোন ধারণাটি সম্পর্কিত?",
        f"आजच्या पाठाच्या संदर्भात, '{topics[1]}' चा मुख्य अर्थ काय आहे?",
        f"இன்றைய பாடத்தில் '{topics[1]}' உடன் நேரடியாக தொடர்புடைய கருத்து எது?",
        f"ఈరోజు పాఠంలో '{topics[1]}' తో నేరుగా సంబంధం ఉన్న భావన ఏది?"
    )
    q2_opts = [topics[1], distractor_pool[2], distractor_pool[3], topics[2]]
    random.shuffle(q2_opts)

    # Q3: Visual / counting (MEDIUM-HARD) - subject adaptive
    if domain == "Numeracy":
        visuals = ["🍎 🍎 🍎", "⭐⭐⭐⭐", "🔷🔷🔷🔷🔷"]
        count_val = 3 if grade == 1 else 4 if grade == 2 else 5
        count_emoji = "🍎 " * count_val
        q3_text = localized_q(
            f"Count and choose: {count_emoji.strip()} = ?",
            f"गिनें और चुनें: {count_emoji.strip()} = ?",
            f"ᱞᱮᱠᱷᱟᱭ ᱢᱮ ᱟᱨ ᱵᱟᱪᱷᱟᱣ ᱢᱮ: {count_emoji.strip()} = ?",
            f"গুনে বাছাই করুন: {count_emoji.strip()} = ?",
            f"मोजा आणि निवडा: {count_emoji.strip()} = ?",
            f"எண்ணி தேர்ந்தெடுக்கவும்: {count_emoji.strip()} = ?",
            f"లెక్కించి ఎంచుకోండి: {count_emoji.strip()} = ?"
        )
        q3_opts = [str(count_val), str(count_val-1), str(count_val+1), str(count_val+2)]
        random.shuffle(q3_opts)
        q3_correct = str(count_val)
        q3_visual = "🔢"
    else:
        q3_text = localized_q(
            "Which word best describes the lesson topic?",
            "पाठ के विषय का सबसे अच्छा वर्णन कौन सा शब्द करता है?",
            "ᱯᱟᱴ ᱨᱮᱱᱟᱜ ᱥᱟᱛᱟᱢ ᱚᱠᱟ ᱟᱹᱲᱟᱹ ᱥᱟᱹᱨᱤ ᱞᱟᱹᱭᱮᱫᱼᱟ?",
            "কোন শব্দটি পাঠের বিষয়কে সবচেয়ে ভালোভাবে বর্ণনা করে?",
            "धड्याच्या विषयाचे सर्वोत्तम वर्णन कोणता शब्द करतो?",
            "பாடத்தின் தலைப்பை சிறப்பாக விவரிக்கும் சொல் எது?",
            "పాఠం అంశాన్ని ఉత్తమంగా వివరించే పదం ఏది?"
        )
        q3_opts = [topics[2], distractor_pool[4], distractor_pool[5], translate_activity_item("General", lang)]
        random.shuffle(q3_opts)
        q3_correct = topics[2]
        q3_visual = visuals_pool[2]

    # Q4: Application / true understanding (HARD)
    q4_text = localized_q(
        f"How would you use '{topics[0]}' in real life?",
        f"'{topics[0]}' का वास्तविक जीवन में उपयोग कैसे करेंगे?",
        f"'{topics[0]}' ᱫᱚ ᱥᱟᱹᱨᱤ ᱡᱤᱭᱚᱱ ᱨᱮ ᱪᱮᱫ ᱞᱮᱠᱟ ᱵᱮᱵᱷᱟᱨᱚᱜᱼᱟ?",
        f"বাস্তব জীবনে '{topics[0]}' কীভাবে ব্যবহার করবে?",
        f"'{topics[0]}' चा प्रत्यक्ष जीवनात वापर कसा कराल?",
        f"'{topics[0]}' ஐ நிஜ வாழ்க்கையில் எவ்வாறு பயன்படுத்துவீர்கள்?",
        f"నిజ జీవితంలో '{topics[0]}' ని ఎలా ఉపయోగిస్తారు?"
    )
    q4_opts = [topics[0], distractor_pool[1], distractor_pool[3], translate_activity_item("General", lang)]
    random.shuffle(q4_opts)

    # Q5: Differentiation / challenge (HARD+ for grade 3)
    if grade >= 3:
        q5_text = localized_q(
            "Which of these shows the deepest understanding of today's lesson?",
            "इनमें से कौन आज के पाठ की सबसे गहरी समझ दिखाता है?",
            "ᱱᱚᱶᱟ ᱠᱚ ᱢᱩᱫᱽ ᱨᱮ ᱚᱠᱟ ᱛᱮᱦᱮᱧᱟᱜ ᱯᱟᱴ ᱨᱮᱱᱟᱜ ᱜᱟᱹᱦᱤᱨ ᱵᱩᱡᱷᱟᱹᱣ ᱥᱚᱫᱚᱨᱮᱫᱼᱟ?",
            "এর মধ্যে কোনটি আজকের পাঠের গভীরতম বোঝাপড়া দেখায়?",
            "यापैकी कोणते आजच्या धड्याचे सर्वात सखोल आकलन दर्शवते?",
            "இவற்றில் எது இன்றைய பாடத்தின் ஆழமான புரிதலைக் காட்டுகிறது?",
            "వీటిలో ఏది ఈరోజు పాఠంపై లోతైన అవగాహనను చూపుతుంది?"
        )
    else:
        q5_text = localized_q(
            "Which of the following concepts was directly explored in today's class?",
            "आज सीखे गए पाठ में इनमें से कौन सा महत्वपूर्ण शब्द/विचार आया था?",
            "ᱛᱮᱦᱮᱧ ᱪᱮᱫ ᱟᱠᱟᱱ ᱯᱟᱴ ᱨᱮ ᱱᱚᱶᱟ ᱠᱚ ᱢᱩᱫᱽ ᱨᱮ ᱚᱠᱟ ᱟᱹᱲᱟᱹ ᱦᱮᱡ ᱞᱮᱱᱟ?",
            "আজকের ক্লাসে নিচের কোন শব্দটি বিশেষভাবে আলোচিত হয়েছে?",
            "वर्गादरम्यान खालीलपैकी कोणता महत्त्वाचा घटक शिकवला गेला?",
            "இன்றைய வகுப்பில் எந்த கருத்து நேரடியாக ஆராயப்பட்டது?",
            "ఈరోజు తరగతిలో ఏ భావనను నేరుగా అన్వేషించారు?"
        )
    q5_opts = [topics[3] if len(topics) > 3 else topics[0], distractor_pool[0], distractor_pool[5], topics[1]]
    random.shuffle(q5_opts)
    q5_correct = topics[3] if len(topics) > 3 else topics[0]

    def hint_for(topic: str) -> str:
        h = {
            "hi": f"संकेत: '{topic}' पाठ में बार-बार आया था",
            "sat": f"ᱦᱤᱸᱛ: '{topic}' ᱯᱟᱴ ᱨᱮ ᱟᱹᱰᱤ ᱫᱷᱟᱣ ᱦᱮᱡ ᱞᱮᱱᱟ",
            "bn": f"ইঙ্গিত: '{topic}' পাঠে বারবার এসেছে",
            "mr": f"संकेत: '{topic}' धड्यात वारंवार आले होते",
            "ta": f"குறிப்பு: '{topic}' பாடத்தில் மீண்டும் மீண்டும் வந்தது",
            "te": f"సూచన: '{topic}' పాఠంలో మళ్లీ మళ్లీ వచ్చింది",
            "en": f"Hint: '{topic}' appeared repeatedly in the lesson",
        }
        return h.get(lang, h["en"])

    def explanation_for(correct: str) -> str:
        ex = {
            "hi": f"'{correct}' आज के पाठ का मुख्य विचार था।",
            "sat": f"'{correct}' ᱫᱚ ᱛᱮᱦᱮᱧᱟᱜ ᱯᱟᱴ ᱨᱮᱱᱟᱜ ᱢᱩᱬᱩᱛ ᱠᱟᱛᱷᱟ ᱛᱟᱦᱮᱸ ᱠᱟᱱᱟ᱾",
            "en": f"'{correct}' was the key concept in today's lesson.",
            "bn": f"'{correct}' আজকের পাঠের মূল ধারণা ছিল।",
            "mr": f"'{correct}' हा आजच्या पाठाचा मुख्य विचार होता.",
            "ta": f"'{correct}' இன்றைய பாடத்தின் முக்கிய கருத்து.",
            "te": f"'{correct}' ఈరోజు పాఠంలో కీలక భావన.",
        }
        return ex.get(lang, ex["en"])

    return {
        "questions": [
            {
                "id": "q1",
                "question": q1_text,
                "options": q1_opts,
                "correct": topics[0],
                "visual": visuals_pool[0],
                "topic": topics[0],
                "hint": hint_for(topics[0]),
                "explanation": explanation_for(topics[0]),
                "difficulty": "EASY",
                "points": 10,
                "nipun_outcome": nipun_id,
                "nipun_skill": nipun_skill,
                "domain": domain,
            },
            {
                "id": "q2",
                "question": q2_text,
                "options": q2_opts,
                "correct": topics[1],
                "visual": visuals_pool[1],
                "topic": topics[1],
                "hint": hint_for(topics[1]),
                "explanation": explanation_for(topics[1]),
                "difficulty": "MEDIUM",
                "points": 10,
                "nipun_outcome": nipun_id,
                "nipun_skill": nipun_skill,
                "domain": domain,
            },
            {
                "id": "q3",
                "question": q3_text,
                "options": q3_opts,
                "correct": q3_correct,
                "visual": q3_visual,
                "hint": hint_for(q3_correct),
                "explanation": explanation_for(q3_correct),
                "difficulty": "MEDIUM",
                "points": 15,
                "nipun_outcome": nipun_id,
                "domain": domain,
            },
            {
                "id": "q4",
                "question": q4_text,
                "options": q4_opts,
                "correct": topics[0],
                "visual": visuals_pool[3],
                "hint": hint_for(topics[0]),
                "explanation": explanation_for(topics[0]),
                "difficulty": "HARD",
                "points": 15,
                "nipun_outcome": nipun_id,
                "domain": domain,
            },
            {
                "id": "q5",
                "question": q5_text,
                "options": q5_opts,
                "correct": q5_correct,
                "visual": visuals_pool[4] if len(visuals_pool) > 4 else "🌟",
                "hint": hint_for(q5_correct),
                "explanation": explanation_for(q5_correct),
                "difficulty": "HARD" if grade >= 3 else "MEDIUM",
                "points": 20,
                "nipun_outcome": nipun_id,
                "domain": domain,
            },
        ]
    }



def _build_flashcards_from_transcript(transcript: str, grade: int, lang: str = "hi", subject: str = "Mathematics") -> list:
    """Next-level flashcards: spaced-repetition ready, phonics, example sentence, audio cue, NIPUN-tagged."""
    keywords = _extract_keywords(transcript)
    # Visual & colour palette - more distinct per domain
    VISUALS_MAP = {
        "math": ["🔢", "➕", "🔷", "🍎", "📐", "💡", "🌟", "🎯"],
        "literacy": ["🔤", "📖", "✍️", "🗣️", "📚", "🌿", "💬", "🎨"],
        "science": ["🌿", "🐘", "💧", "🌞", "🔬", "🌍", "🍃", "⭐"],
        "general": ["📚", "🌟", "🎯", "💡", "🌍", "🔤", "📖", "🎨"],
    }
    COLORS = ["#FB773C", "#2EB9DF", "#EB3678", "#EC4899", "#22c55e", "#8b5cf6", "#f59e0b", "#06b6d4"]

    NOISE_WORDS = {"maths", "math", "tan", "tham", "ev", "abh", "sub", "deg", "var"}
    valid_kw = [k for k in keywords if len(k) >= 3 and k.lower() not in NOISE_WORDS]

    subj_clean = (subject or "Mathematics").lower()
    if "math" in subj_clean or "गणित" in subj_clean or "ᱮᱞᱠᱷᱟ" in subj_clean:
        domain = "math"
        subject_defaults = ["Addition", "Subtraction", "Counting", "Shapes", "Numbers", "Equation"]
        nipun_skill = "Numeracy & Shapes"
    elif "literacy" in subj_clean or "language" in subj_clean or "भाषा" in subj_clean or "ᱚᱞ" in subj_clean:
        domain = "literacy"
        subject_defaults = ["Sentences", "Reading", "Vocabulary", "Grammar", "Alphabet", "Story"]
    elif "science" in subj_clean or "evs" in subj_clean or "पर्यावरण" in subj_clean:
        domain = "science"
        subject_defaults = ["Plants", "Animals", "Water", "Air", "Sun", "Environment"]
    else:
        domain = "general"
        subject_defaults = ["General Knowledge", "Lesson", "Concept", "Idea", "Learning", "Discovery"]

    for fb in subject_defaults:
        if fb not in valid_kw:
            valid_kw.append(fb)
    while len(valid_kw) < 8:
        valid_kw.append(valid_kw[len(valid_kw) % len(subject_defaults)])

    VISUALS = VISUALS_MAP.get(domain, VISUALS_MAP["general"])
    meaning_text = translate_activity_item("A key concept from today's lesson", lang)

    # Example sentence templates per language
    ex_templates = {
        "hi": "वाक्य: '{w}' — आज हमने '{w}' के बारे में सीखा।",
        "sat": "ᱠᱟᱛᱷᱟ: '{w}' — ᱛᱮᱦᱮᱧ ᱟᱵᱚ '{w}' ᱵᱟᱵᱚᱛ ᱵᱚᱱ ᱪᱮᱫᱮᱱᱟ᱾",
        "bn": "বাক্য: '{w}' — আজ আমরা '{w}' নিয়ে শিখেছি।",
        "mr": "वाक्य: '{w}' — आज आपण '{w}' शिकलो।",
        "ta": "வாக்கியம்: '{w}' — இன்று நாம் '{w}' பற்றி கற்றோம்.",
        "te": "వాక్యం: '{w}' — ఈరోజు మనం '{w}' గురించి నేర్చుకున్నాం.",
        "en": "Example: Today we learned about '{w}'.",
    }

    level_for_grade = {1: "FOUNDATION", 2: "INTERMEDIATE", 3: "ADVANCED"}

    cards = []
    for i, kw in enumerate(valid_kw[:8]):
        translated_word = translate_activity_item(kw, lang)
        # Phonics: smarter - split into syllables by characters (handles Ol Chiki/Devanagari)
        chars = list(translated_word)
        phonics = "-".join(chars[:4]) if len(chars) <= 6 else "-".join(chars[:3]) + "-" + "".join(chars[3:5])
        visual = VISUALS[i % len(VISUALS)]
        color = COLORS[i % len(COLORS)]
        ex = (ex_templates.get(lang) or ex_templates["en"]).format(w=translated_word)
        # NIPUN outcome mapping
        nipun_map = {1: "lit-1-1", 2: "lit-1-2", 3: "num-2-1"}
        cards.append({
            "word": translated_word,
            "phonics": phonics,
            "meaning": meaning_text,
            "example": ex,
            "visual": visual,
            "color": color,
            "audio_text": translated_word,
            "level": level_for_grade.get(grade, "FOUNDATION"),
            "level_num": grade,
            "nipun_skill": nipun_skill,
            "domain": domain,
            "srs_interval": 1 if i < 2 else 3 if i < 5 else 7,
            "hint": f"{visual} {translated_word}",
        })

    return cards


def _build_worksheet_from_transcript(transcript: str, grade: int, lang: str = "hi", subject: str = "Mathematics") -> list:
    """Next-level worksheet: typed tasks (WRITE/DRAW/FILL/MATCH), rubric, points, NIPUN-tagged."""
    keywords = _extract_keywords(transcript)
    NOISE_WORDS = {"maths", "math", "tan", "tham", "ev", "abh", "sub", "deg", "var"}
    valid_kw = [k for k in keywords if len(k) >= 3 and k.lower() not in NOISE_WORDS]

    subj_clean = (subject or "Mathematics").lower()
    if "math" in subj_clean or "गणित" in subj_clean or "ᱮᱞᱠᱷᱟ" in subj_clean:
        default_kw1, default_kw2, default_kw3 = "Addition", "Counting", "Shapes"
        task_domain = "Numeracy"
    elif "science" in subj_clean or "evs" in subj_clean or "पर्यावरण" in subj_clean:
        default_kw1, default_kw2, default_kw3 = "Plants", "Water", "Animals"
        task_domain = "EVS"
    else:
        default_kw1, default_kw2, default_kw3 = "Lesson", "Concept", "Vocabulary"
        task_domain = "Literacy"

    kw1_raw = valid_kw[0] if len(valid_kw) > 0 else default_kw1
    kw2_raw = valid_kw[1] if len(valid_kw) > 1 else default_kw2
    kw3_raw = valid_kw[2] if len(valid_kw) > 2 else default_kw3

    kw1 = translate_activity_item(kw1_raw, lang)
    kw2 = translate_activity_item(kw2_raw, lang)
    kw3 = translate_activity_item(kw3_raw, lang)

    # Localized prompts
    prompts = {
        "hi": [
            f"आज की कक्षा से '{kw1}' के बारे में 2 वाक्य लिखें। (WRITE ✍️)",
            f"'{kw2}' का क्या अर्थ है? चित्र बनाएं या 1 वाक्य में वर्णन करें। (DRAW 🎨)",
            f"रिक्त स्थान भरें: आज मैंने '{kw1}' के बारे में सीखा। (FILL 📝)",
            f"'{kw3}' को सही चित्र से मिलाएं। (MATCH 🔗)",
        ],
        "sat": [
            f"ᱛᱮᱦᱮᱧᱟᱜ ᱪᱟᱱᱚᱪ ᱠᱷᱚᱱ '{kw1}' ᱵᱟᱵᱚᱛ ᱛᱮ ᱒ ᱴᱟᱝ ᱠᱟᱛᱷᱟ ᱚᱞ ᱢᱮ᱾ (ᱚᱞ ✍️)",
            f"'{kw2}' ᱨᱮᱱᱟᱜ ᱢᱮᱱᱮᱛ ᱪᱮᱫ ᱠᱟᱱᱟ, ᱪᱤᱛᱟᱹᱨ ᱵᱮᱱᱟᱣ ᱢᱮ ᱥᱮ ᱞᱟᱹᱭ ᱢᱮ᱾ (ᱪᱤᱛᱟᱹᱨ 🎨)",
            f"ᱯᱮᱨᱮᱡ ᱢᱮ: ᱛᱮᱦᱮᱧ ᱤᱧ '{kw1}' ᱵᱟᱵᱚᱛ ᱛᱤᱧ ᱪᱮᱫᱮᱱᱟ᱾ (ᱯᱮᱨᱮᱡ 📝)",
            f"'{kw3}' ᱫᱚ ᱥᱟᱹᱨᱤ ᱪᱤᱛᱟᱹᱨ ᱥᱟᱞᱟᱜ ᱡᱚᱲᱟᱣ ᱢᱮ᱾ (ᱡᱚᱲᱟᱣ 🔗)",
        ],
        "en": [
            f"Write 2 sentences about '{kw1}' from today's class. (WRITE ✍️)",
            f"Draw or describe what '{kw2}' means in one sentence. (DRAW 🎨)",
            f"Fill in the blank: Today I learned about '{kw1}'. (FILL 📝)",
            f"Match '{kw3}' with the correct picture. (MATCH 🔗)",
        ],
        "bn": [
            f"আজকের ক্লাস থেকে '{kw1}' সম্পর্কে ২টি বাক্য লিখুন। (লিখুন ✍️)",
            f"'{kw2}' এর অর্থ কী? ছবি আঁকুন বা এক বাক্যে বর্ণনা করুন। (আঁকুন 🎨)",
            f"শূন্যস্থান পূরণ করুন: আজ আমি '{kw1}' সম্পর্কে শিখেছি। (পূরণ 📝)",
            f"'{kw3}' সঠিক ছবির সাথে মিল করুন। (মিল 🔗)",
        ],
        "mr": [
            f"आजच्या वर्गातून '{kw1}' बद्दल २ वाक्ये लिहा। (लिहा ✍️)",
            f"'{kw2}' चा अर्थ काय? चित्र काढा किंवा एका वाक्यात वर्णन करा। (चित्र 🎨)",
            f"रिकामी जागा भरा: आज मी '{kw1}' बद्दल शिकलो। (भरा 📝)",
            f"'{kw3}' योग्य चित्राशी जोडा। (जोडा 🔗)",
        ],
        "ta": [
            f"இன்றைய வகுப்பிலிருந்து '{kw1}' பற்றி 2 வாக்கியங்கள் எழுதுங்கள். (எழுது ✍️)",
            f"'{kw2}' என்றால் என்ன? படம் வரையுங்கள் அல்லது ஒரு வாக்கியத்தில் விவரிக்கவும். (வரை 🎨)",
            f"கோடிட்ட இடத்தை நிரப்பவும்: இன்று நான் '{kw1}' பற்றி கற்றேன். (நிரப்பு 📝)",
            f"'{kw3}' ஐ சரியான படத்துடன் பொருத்தவும். (பொருத்து 🔗)",
        ],
        "te": [
            f"ఈరోజు తరగతి నుండి '{kw1}' గురించి 2 వాక్యాలు రాయండి. (రాయండి ✍️)",
            f"'{kw2}' అంటే ఏమిటి? చిత్రం గీయండి లేదా ఒక వాక్యంలో వివరించండి. (గీయండి 🎨)",
            f"ఖాళీని పూరించండి: ఈరోజు నేను '{kw1}' గురించి నేర్చుకున్నాను. (పూరించండి 📝)",
            f"'{kw3}' ని సరైన చిత్రంతో జత చేయండి. (జత 🔗)",
        ],
    }
    ts = prompts.get(lang, prompts["en"])
    # Grade-differentiated: grade 1 gets 3 tasks, grade 2-3 gets 4
    num_tasks = 3 if grade == 1 else 4
    types = ["WRITE", "DRAW", "FILL", "MATCH"]
    tasks = []
    for i in range(num_tasks):
        tasks.append({
            "task": ts[i],
            "type": types[i],
            "answer": "" if i < 2 else kw1 if i == 2 else "",
            "points": 10 if i < 2 else 5,
            "domain": task_domain,
            "grade": grade,
            "hint": translate_activity_item(f"Think about '{[kw1,kw2,kw1,kw3][i]}'", lang),
        })
    return tasks


def _build_game_from_transcript(transcript: str, grade: int, lang: str = "hi", subject: str = "Mathematics") -> list:
    """Next-level FLN games: 3 progressive games per lesson (count, letter, listen-match)."""
    import random
    keywords = _extract_keywords(transcript)
    NOISE_WORDS = {"maths", "math", "tan", "tham", "ev", "abh", "sub", "deg", "var"}
    valid_kw = [k for k in keywords if len(k) >= 3 and k.lower() not in NOISE_WORDS]
    while len(valid_kw) < 3:
        valid_kw.append("Addition" if "math" in (subject or "").lower() else "Letter")

    kw1 = translate_activity_item(valid_kw[0], lang)
    kw2 = translate_activity_item(valid_kw[1] if len(valid_kw) > 1 else valid_kw[0], lang)
    kw3 = translate_activity_item(valid_kw[2] if len(valid_kw) > 2 else valid_kw[0], lang)

    # Titles per language
    titles = {
        "hi": [f"गिनती खेल: {kw1} कितने हैं?", f"अक्षर पहेली: '{kw2[:1]}' पहचानें", f"सुनो और चुनो: {kw3}"],
        "sat": [f"ᱞᱮᱠᱷᱟ ᱮᱱᱮᱡ: ᱛᱤᱱᱟᱹᱜ {kw1} ᱢᱮᱱᱟᱜᱼᱟ?", f"ᱟᱠᱷᱚᱨ ᱮᱱᱮᱡ: '{kw2[:1]}' ᱪᱤᱱᱦᱟᱹᱣ ᱢᱮ", f"ᱟᱸᱡᱚᱢ ᱟᱨ ᱵᱟᱪᱷᱟᱣ: {kw3}"],
        "bn": [f"গণনা খেলা: {kw1} কয়টি?", f"বর্ণ খেলা: '{kw2[:1]}' চিনুন", f"শুনে বাছাই: {kw3}"],
        "mr": [f"मोजणी खेळ: {kw1} किती?", f"अक्षर खेळ: '{kw2[:1]}' ओळखा", f"ऐका आणि निवडा: {kw3}"],
        "ta": [f"எண்ணும் விளையாட்டு: {kw1} எத்தனை?", f"எழுத்து விளையாட்டு: '{kw2[:1]}'", f"கேட்டு தேர்ந்தெடு: {kw3}"],
        "te": [f"లెక్కల ఆట: {kw1} ఎన్ని?", f"అక్షరాల ఆట: '{kw2[:1]}' గుర్తించు", f"విని ఎంచుకో: {kw3}"],
        "en": [f"Count Game: How many {kw1}?", f"Letter Quest: Spot '{kw2[:1]}'", f"Listen & Match: {kw3}"],
    }
    instrs = {
        "hi": [f"चित्र में दिख रहे {kw1} को गिनें और सही विकल्प चुनें!", f"'{kw2[:1]}' अक्षर वाले विकल्प को चुनें!", f"ऑडियो सुनें और सही '{kw3}' चुनें!"],
        "sat": [f"ᱪᱤᱛᱟᱹᱨ ᱨᱮ ᱛᱤᱱᱟᱹᱜ {kw1} ᱢᱮᱱᱟᱜᱼᱟ ᱞᱮᱠᱷᱟᱭ ᱢᱮ!", f"'{kw2[:1]}' ᱟᱠᱷᱚᱨ ᱢᱮᱱᱟᱜ ᱵᱟᱪᱷᱟᱣ ᱢᱮ!", f"ᱟᱸᱡᱚᱢ ᱟᱨ '{kw3}' ᱵᱟᱪᱷᱟᱣ ᱢᱮ!"],
        "en": [f"Count the {kw1} in the image and tap the correct number!", f"Tap the card that contains '{kw2[:1]}'", f"Listen to the audio and choose the correct '{kw3}'"],
        "bn": [f"ছবিতে {kw1} গুনুন এবং সঠিক সংখ্যা বেছে নিন!", f"'{kw2[:1]}' আছে এমন কার্ড ট্যাপ করুন!", f"অডিও শুনে সঠিক '{kw3}' বাছাই করুন!"],
        "mr": [f"चित्रातील {kw1} मोजा आणि योग्य संख्या निवडा!", f"'{kw2[:1]}' असलेले कार्ड निवडा!", f"ऑडिओ ऐका आणि योग्य '{kw3}' निवडा!"],
        "ta": [f"படத்தில் {kw1} எண்ணி சரியான எண்ணை தேர்ந்தெடுக்கவும்!", f"'{kw2[:1]}' உள்ள அட்டையைத் தேர்ந்தெடுக்கவும்!", f"ஆடியோவைக் கேட்டு சரியான '{kw3}' ஐத் தேர்ந்தெடுக்கவும்!"],
        "te": [f"చిత్రంలో {kw1} లెక్కించి సరైన సంఖ్యను ఎంచుకోండి!", f"'{kw2[:1]}' ఉన్న కార్డును ఎంచుకోండి!", f"ఆడియో విని సరైన '{kw3}' ఎంచుకోండి!"],
    }
    t_titles = titles.get(lang, titles["en"])
    t_instrs = instrs.get(lang, instrs["en"])

    count_val = 3 if grade == 1 else 4 if grade == 2 else 5
    count_emoji = "🍎 " * count_val
    # Game 1: Counting
    g1 = {
        "id": "game_count",
        "title": t_titles[0],
        "instruction": t_instrs[0],
        "visual": count_emoji.strip(),
        "count": count_val,
        "options": [str(count_val), str(count_val+1), str(max(1, count_val-1)), str(count_val+2)],
        "correct": str(count_val),
        "points": 10,
        "level": grade,
        "type": "COUNT",
    }
    random.shuffle(g1["options"])  # type: ignore

    # Game 2: Letter/Phonics (adaptive to language script)
    letter = kw2[:1] if kw2 else "A"
    distractors = [chr(ord(letter)+1) if letter.isascii() else letter+"्", letter+"a", letter]
    # Provide script-appropriate distractors: keep simple
    g2_options = [letter, "K", "M"] if lang == "en" else [letter, "क", "म"] if lang in ["hi","mr"] else [letter, "ক", "ম"] if lang=="bn" else [letter, "க", "ம"] if lang=="ta" else [letter, "క", "మ"] if lang=="te" else [letter, "ᱛ", "ᱜ"]
    g2 = {
        "id": "game_letter",
        "title": t_titles[1],
        "instruction": t_instrs[1],
        "visual": letter,
        "options": g2_options,
        "correct": letter,
        "points": 10,
        "level": grade,
        "type": "LETTER",
    }

    # Game 3: Listen & Match (audio-first)
    g3 = {
        "id": "game_listen",
        "title": t_titles[2],
        "instruction": t_instrs[2],
        "visual": "🔊",
        "audio_text": kw3,
        "options": [kw3, kw1, "Music" if lang=="en" else translate_activity_item("Music", lang)],
        "correct": kw3,
        "points": 15,
        "level": grade,
        "type": "LISTEN",
    }
    random.shuffle(g3["options"])  # type: ignore

    return [g1, g2, g3]


def generate_nipun_content(transcript: str, grade: int, activity_type: str, lang: str = "hi", subject: str = "Mathematics") -> Dict[str, Any]:
    """
    Generates NIPUN FLN educational activities based on the actual lesson transcript and class subject.
    Fully localized in target student language (Hindi, Santali Ol Chiki, etc.).
    """
    logger.info(f"Generating {activity_type} for Grade {grade} {subject} FLN (Lang: {lang}) from transcript ({len(transcript)} chars).")

    # Run on-demand SLM inference for question generation
    ai_generated_question = ""
    clean_summary = transcript.strip() if transcript else ""
    if clean_summary:
        try:
            slm_prompt = f"Create 1 simple question for Grade {grade} {subject} students based on this lesson: {clean_summary[:150]}"
            ai_generated_question = edge_ai.generate_with_slm(slm_prompt, max_new_tokens=50)
            logger.info(f"SmolLM2 generated: '{ai_generated_question}'")
        except Exception as e:
            logger.warning(f"SmolLM2 generation error: {e}")

    keywords = _extract_keywords(clean_summary)
    NOISE_WORDS = {"maths", "math", "tan", "tham", "ev", "abh", "sub", "deg", "var"}
    valid_kw = [k for k in keywords if len(k) >= 3 and k.lower() not in NOISE_WORDS]
    topic_raw = valid_kw[0] if valid_kw else subject
    topic = translate_activity_item(topic_raw, lang)

    grade_label = translate_activity_item(f"Grade {grade}", lang)

    if activity_type == "QUIZ":
        quiz_data = _build_quiz_from_transcript(clean_summary, grade, ai_generated_question, lang=lang, subject=subject)
        quiz_title = translate_activity_item("Quiz", lang)
        content = {
            "title": f"{grade_label} {quiz_title}: {topic}",
            **quiz_data
        }
    elif activity_type == "FLASHCARD":
        cards = _build_flashcards_from_transcript(clean_summary, grade, lang=lang, subject=subject)
        vocab_title = translate_activity_item("Vocabulary", lang)
        content = {
            "title": f"{grade_label} {vocab_title}: {topic}",
            "cards": cards
        }
    elif activity_type in ["GAME", "GAMES"]:
        games = _build_game_from_transcript(clean_summary, grade, lang=lang, subject=subject)
        game_title = translate_activity_item("Game", lang)
        content = {
            "title": f"{grade_label} {game_title}: {topic}",
            "games": games
        }
    else:  # WORKSHEET
        tasks = _build_worksheet_from_transcript(clean_summary, grade, lang=lang, subject=subject)
        sheet_title = translate_activity_item("Worksheet", lang)
        content = {
            "title": f"{grade_label} {sheet_title}: {topic}",
            "tasks": tasks
        }

    # Swap back to ASR/MT pipeline
    edge_ai.unload_slm()

    domain_names = {
        "hi": "गणित एवं भाषा कौशल",
        "sat": "ᱮᱞᱠᱷᱟ ᱟᱨ ᱟᱹᱲᱟᱹ ᱜᱽᱭᱟᱱ",
        "bn": "গণিত ও ভাষা দক্ষতা",
        "mr": "गणित व भाषा कौशल्य",
        "ta": "கணிதம் & மொழித்திறன்",
        "te": "గణితం & భాషా నైపుణ్యం",
        "en": "Numeracy & Literacy"
    }
    skill_names = {
        "hi": "निपुण भारत बाल-शिक्षा",
        "sat": "ᱱᱤᱯᱩᱱ ᱵᱷᱟᱨᱚᱛ ᱢᱩᱬᱩᱛ ᱪᱮᱫᱚᱜ",
        "bn": "নিপুণ ভারত প্রাথমিক শিক্ষা",
        "mr": "निपुण भारत प्राथमिक शिक्षण",
        "ta": "நிபுண் பாரத் அடிப்படை கற்றல்",
        "te": "నిపుణ్ భారత్ ప్రాథమిక అభ్యాసం",
        "en": "NIPUN Primary Learning"
    }

    return {
        "activity_type": activity_type,
        "grade": grade,
        "domain": domain_names.get(lang, "Numeracy & Literacy"),
        "skill": skill_names.get(lang, "NIPUN Primary Learning"),
        "content": content,
        "generator": "Edge SLM (SmolLM2-360M) + Multilingual Keyword Extraction",
        "raw_slm_output": ai_generated_question,
        "lesson_keywords": valid_kw[:5],
        "language": lang
    }


def translate_activity_content(content: Dict[str, Any], target_lang: str) -> Dict[str, Any]:
    """
    Translates an entire activity content dictionary into target student language script.
    """
    if not content:
        return content

    import copy
    translated_content = copy.deepcopy(content)

    # Translate main title
    if "title" in translated_content and isinstance(translated_content["title"], str):
        t_str = translated_content["title"]
        for term, mapping in ACTIVITY_LEXICON.items():
            if term in t_str and target_lang in mapping:
                t_str = t_str.replace(term, mapping[target_lang])
        translated_content["title"] = t_str

    # Quiz questions & options (incl. next-level fields)
    if "questions" in translated_content and isinstance(translated_content["questions"], list):
        for q in translated_content["questions"]:
            if "question" in q and isinstance(q["question"], str):
                q["question"] = translate_activity_item(q["question"], target_lang)
            if "options" in q and isinstance(q["options"], list):
                q["options"] = [translate_activity_item(str(opt), target_lang) for opt in q["options"]]
            if "correct" in q and isinstance(q["correct"], str):
                q["correct"] = translate_activity_item(q["correct"], target_lang)
            if "hint" in q and isinstance(q["hint"], str):
                q["hint"] = translate_activity_item(q["hint"], target_lang)
            if "explanation" in q and isinstance(q["explanation"], str):
                q["explanation"] = translate_activity_item(q["explanation"], target_lang)
            if "topic" in q and isinstance(q["topic"], str):
                q["topic"] = translate_activity_item(q["topic"], target_lang)

    # Worksheet tasks
    if "tasks" in translated_content and isinstance(translated_content["tasks"], list):
        for task_obj in translated_content["tasks"]:
            if "task" in task_obj and isinstance(task_obj["task"], str):
                task_obj["task"] = translate_activity_item(task_obj["task"], target_lang)
            if "answer" in task_obj and task_obj["answer"] and isinstance(task_obj["answer"], str):
                task_obj["answer"] = translate_activity_item(task_obj["answer"], target_lang)
            if "hint" in task_obj and isinstance(task_obj["hint"], str):
                task_obj["hint"] = translate_activity_item(task_obj["hint"], target_lang)

    # Flashcards (next-level)
    if "cards" in translated_content and isinstance(translated_content["cards"], list):
        for card in translated_content["cards"]:
            if "word" in card and isinstance(card["word"], str):
                card["word"] = translate_activity_item(card["word"], target_lang)
                card["phonics"] = "-".join(list(card["word"])[:4])
            if "meaning" in card and isinstance(card["meaning"], str):
                card["meaning"] = translate_activity_item(card["meaning"], target_lang)
            if "example" in card and isinstance(card["example"], str):
                card["example"] = translate_activity_item(card["example"], target_lang)
            if "hint" in card and isinstance(card["hint"], str):
                card["hint"] = translate_activity_item(card["hint"], target_lang)
            if "audio_text" in card and isinstance(card["audio_text"], str):
                card["audio_text"] = translate_activity_item(card["audio_text"], target_lang)

    # Games
    if "games" in translated_content and isinstance(translated_content["games"], list):
        for g in translated_content["games"]:
            if "title" in g and isinstance(g["title"], str):
                g["title"] = translate_activity_item(g["title"], target_lang)
            if "instruction" in g and isinstance(g["instruction"], str):
                g["instruction"] = translate_activity_item(g["instruction"], target_lang)
            if "audio_text" in g and isinstance(g["audio_text"], str):
                g["audio_text"] = translate_activity_item(g["audio_text"], target_lang)
            if "correct" in g and isinstance(g["correct"], str):
                g["correct"] = translate_activity_item(g["correct"], target_lang)
            if "options" in g and isinstance(g["options"], list):
                g["options"] = [translate_activity_item(str(o), target_lang) for o in g["options"]]
    return translated_content




