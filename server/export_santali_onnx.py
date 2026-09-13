import os
import sys
import logging
from pathlib import Path

logger = logging.getLogger("santali_onnx_exporter")
logging.basicConfig(level=logging.INFO)

def export_santali_tokens():
    """
    Extracts vocabulary tokens for Whisper small and formats tokens.txt for sherpa-onnx.
    """
    output_dir = Path(__file__).parent / "models" / "whisper-small-santali"
    output_dir.mkdir(parents=True, exist_ok=True)
    tokens_file = output_dir / "tokens.txt"

    try:
        from transformers import WhisperTokenizer
        logger.info("Downloading Whisper base tokenizer (openai/whisper-small)...")
        tokenizer = WhisperTokenizer.from_pretrained("openai/whisper-small", language="Hindi", task="transcribe")
        vocab = tokenizer.get_vocab()
        sorted_vocab = sorted(vocab.items(), key=lambda x: x[1])
        with open(tokens_file, "w", encoding="utf-8") as f:
            for token, idx in sorted_vocab:
                f.write(f"{token} {idx}\n")
        logger.info(f"Successfully generated {len(sorted_vocab)} tokens in {tokens_file}")
        return True
    except Exception as e:
        logger.error(f"Error exporting tokens: {e}")
        return False

if __name__ == "__main__":
    export_santali_tokens()
