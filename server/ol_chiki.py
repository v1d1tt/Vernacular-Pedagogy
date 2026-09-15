"""
Ol Chiki to Devanagari transliterator for Piper VITS TTS.
Allows Hindi VITS neural TTS models to speak Santali Ol Chiki text fluently.
"""

OL_CHIKI_TO_DEVANAGARI = {
    '\u1C5A': 'अ', '\u1C5F': 'आ', '\u1C64': 'इ', '\u1C69': 'उ', '\u1C6E': 'ए', '\u1C73': 'ओ',
    '\u1C5B': 'त', '\u1C5C': 'ग', '\u1C5D': 'ं', '\u1C5E': 'ल',
    '\u1C60': 'क', '\u1C61': 'ज', '\u1C62': 'म', '\u1C63': 'व',
    '\u1C65': 'स', '\u1C66': 'ह', '\u1C67': 'ञ', '\u1C68': 'र',
    '\u1C6A': 'च', '\u1C6B': 'द', '\u1C6C': 'ण', '\u1C6D': 'य',
    '\u1C6F': 'प', '\u1C70': 'ड', '\u1C71': 'न', '\u1C72': 'ड़',
    '\u1C74': 'ट', '\u1C75': 'ब', '\u1C76': 'व', '\u1C77': 'ह',
    '\u1C78': 'ं', '\u1C79': '',  '\u1C7A': '',  '\u1C7B': '',  '\u1C7C': '',  '\u1C7D': '',
    '\u1C7E': '।', '\u1C7F': '॥',
    '\u1C50': '०', '\u1C51': '१', '\u1C52': '२', '\u1C53': '३', '\u1C54': '४',
    '\u1C55': '५', '\u1C56': '६', '\u1C57': '७', '\u1C58': '८', '\u1C59': '९',
}

OL_CHIKI_TO_ROMAN = {
    '\u1C5A': 'o', '\u1C5F': 'a', '\u1C64': 'i', '\u1C69': 'u', '\u1C6E': 'e', '\u1C73': 'o',
    '\u1C5B': 't', '\u1C5C': 'g', '\u1C5D': 'ng', '\u1C5E': 'l',
    '\u1C60': 'k', '\u1C61': 'j', '\u1C62': 'm', '\u1C63': 'w',
    '\u1C65': 's', '\u1C66': 'h', '\u1C67': 'ny', '\u1C68': 'r',
    '\u1C6A': 'ch', '\u1C6B': 'd', '\u1C6C': 'n', '\u1C6D': 'y',
    '\u1C6F': 'p', '\u1C70': 'd', '\u1C71': 'n', '\u1C72': 'r',
    '\u1C74': 't', '\u1C75': 'b', '\u1C76': 'v', '\u1C77': 'h',
    '\u1C78': 'n', '\u1C79': '',  '\u1C7A': '',  '\u1C7B': '',  '\u1C7C': '',  '\u1C7D': '',
    '\u1C7E': '.', '\u1C7F': '.',
    '\u1C50': '0', '\u1C51': '1', '\u1C52': '2', '\u1C53': '3', '\u1C54': '4',
    '\u1C55': '5', '\u1C56': '6', '\u1C57': '7', '\u1C58': '8', '\u1C59': '9',
}

def transliterate_ol_chiki_to_devanagari(text: str) -> str:
    """Converts Santali Ol Chiki script into Devanagari script for Hindi Piper VITS."""
    if not text:
        return ""
    return "".join(OL_CHIKI_TO_DEVANAGARI.get(ch, ch) for ch in text)

def transliterate_ol_chiki_to_roman(text: str) -> str:
    """Fallback Roman phonetics when Devanagari would be empty or device lacks hi voice."""
    if not text:
        return ""
    return "".join(OL_CHIKI_TO_ROMAN.get(ch, ch) for ch in text)

def has_ol_chiki(text: str) -> bool:
    return any('\u1c50' <= ch <= '\u1c7f' for ch in text)
