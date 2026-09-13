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

def transliterate_ol_chiki_to_devanagari(text: str) -> str:
    """Converts Santali Ol Chiki script into Devanagari script for Hindi Piper VITS."""
    if not text:
        return ""
    return "".join(OL_CHIKI_TO_DEVANAGARI.get(ch, ch) for ch in text)
