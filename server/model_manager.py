import os
import time
import logging
import gc
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np

logger = logging.getLogger("edge_ai_manager")
logging.basicConfig(level=logging.INFO)

# Base models directory
MODELS_DIR = Path(__file__).parent / "models"
WHISPER_DIR = MODELS_DIR / "whisper-tiny-int8"
VAD_MODEL_PATH = MODELS_DIR / "silero-vad" / "silero_vad.onnx"
SMOLLM2_DIR = MODELS_DIR / "smollm2-360m"
# IndicTrans2 ONNX models (Dynamic INT8 Quantization)
INDICTRANS_EN_INDIC_ID  = "hari31416/indictrans2-en-indic-dist-200M-ONNX-int8"
INDICTRANS_INDIC_EN_ID  = "hari31416/indictrans2-indic-en-dist-200M-ONNX-int8"
INDICTRANS_LOCAL_DIR    = MODELS_DIR / "indictrans2-1b-int8"
PIPER_TTS_DIR = MODELS_DIR / "vits-piper-hi"
# Real Santali ASR: fine-tuned whisper-small on Mozilla Common Voice Santali (Ol Chiki)
WHISPER_SANTALI_DIR = MODELS_DIR / "whisper-small-santali"
WHISPER_SANTALI_HF_ID = "thunderboltc/whisper-small-santali-ol-chiki"

# Language Code Mapping for IndicTrans2 and TTS
INDIC_LANG_MAP = {
    "hi": {"tag": "hin_Deva", "name": "Hindi", "script": "Devanagari"},
    "bn": {"tag": "ben_Beng", "name": "Bengali", "script": "Bengali"},
    "mr": {"tag": "mar_Deva", "name": "Marathi", "script": "Devanagari"},
    "ta": {"tag": "tam_Taml", "name": "Tamil", "script": "Tamil"},
    "te": {"tag": "tel_Telu", "name": "Telugu", "script": "Telugu"},
    "en": {"tag": "eng_Latn", "name": "English", "script": "Latin"},
    "sat": {"tag": "sat_Olck", "name": "Santali", "script": "Ol Chiki"},
}

class EdgeModelManager:
    """
    Manages Edge AI inference runtimes for VaaniVerse.
    - VAD: Silero VAD ONNX
    - ASR (hi/bn/mr/ta/te/en): sherpa-onnx Whisper-Tiny INT8
    - ASR (sat): HuggingFace whisper-small-santali-ol-chiki -> native Ol Chiki script
    - TTS: Piper VITS ONNX (Hindi)
    - Translation: IndicTrans2 200M distilled (HuggingFace Transformers)
      Three models covering all 22 Indian languages + English, including Santali (sat_Olck)
    - SLM: SmolLM2-360M (on-demand swapping)
    """

    def __init__(self):
        self._recognizer = None
        self._vad_session = None
        self._vad_state = None
        # IndicTrans2: three lazily-loaded models keyed by direction
        # "en-indic": English → any Indic/Santali
        # "indic-en": any Indic/Santali → English
        # "indic-indic": Indic ↔ Indic (e.g. Hindi→Bengali→Santali)
        self._it2_models: Dict[str, Any] = {}      # {direction: {model, tokenizer}}
        self._it2_processor = None                 # shared IndicProcessor instance
        self._slm_session = None
        self._slm_tokenizer = None
        self._tts = None
        # Real Santali ASR pipeline (whisper-small-santali-ol-chiki)
        self._santali_pipeline = None       # Sentinel: True when model is ready
        self._santali_model = None
        self._santali_tokenizer = None
        self._santali_feature_extractor = None
        self._active_models: Dict[str, Any] = {}
        self.init_vad()
        self.init_asr()
        self.init_tts()
        self.init_santali_asr()

    # ──────────────────────────────────────────────────────────────────────────
    # VAD: Silero VAD ONNX Runtime
    # ──────────────────────────────────────────────────────────────────────────
    def init_vad(self):
        try:
            import onnxruntime as ort
            if VAD_MODEL_PATH.exists():
                opts = ort.SessionOptions()
                opts.intra_op_num_threads = 1
                opts.inter_op_num_threads = 1
                self._vad_session = ort.InferenceSession(str(VAD_MODEL_PATH), sess_options=opts)
                self._vad_state = np.zeros((2, 1, 128), dtype=np.float32)
                self._active_models["silero_vad"] = "ONLINE"
                logger.info("Silero VAD initialized successfully.")
            else:
                logger.warning(f"VAD model not found at {VAD_MODEL_PATH}")
        except Exception as e:
            logger.error(f"Error initializing Silero VAD: {e}")

    def is_speech(self, audio_chunk: np.ndarray, sample_rate: int = 16000, threshold: float = 0.5) -> bool:
        """
        Runs Silero VAD on audio chunk. Expects ~512 samples at 16kHz.
        """
        if self._vad_session is None:
            return True  # Fallback: assume speech if VAD not ready
        try:
            if len(audio_chunk) < 512:
                audio_chunk = np.pad(audio_chunk, (0, 512 - len(audio_chunk)))
            elif len(audio_chunk) > 512:
                audio_chunk = audio_chunk[:512]

            audio_input = audio_chunk.reshape(1, -1).astype(np.float32)
            sr = np.array(sample_rate, dtype=np.int64)

            out, new_state = self._vad_session.run(
                None,
                {"input": audio_input, "state": self._vad_state, "sr": sr}
            )
            self._vad_state = new_state
            prob = float(out[0][0])
            return prob >= threshold
        except Exception as e:
            logger.warning(f"VAD inference error: {e}")
            return True

    # ──────────────────────────────────────────────────────────────────────────
    # ASR: sherpa-onnx Whisper-Tiny INT8 (Hindi, Bengali, Marathi, Tamil, Telugu, English)
    # ──────────────────────────────────────────────────────────────────────────
    def init_asr(self, language: str = "hi"):
        try:
            import sherpa_onnx
            enc = WHISPER_DIR / "tiny-encoder.int8.onnx"
            dec = WHISPER_DIR / "tiny-decoder.int8.onnx"
            tokens = WHISPER_DIR / "tiny-tokens.txt"

            if enc.exists() and dec.exists() and tokens.exists():
                self._recognizer = sherpa_onnx.OfflineRecognizer.from_whisper(
                    encoder=str(enc),
                    decoder=str(dec),
                    tokens=str(tokens),
                    language=language,
                    task="transcribe",
                    num_threads=2
                )
                self._active_models["whisper_asr"] = "ONLINE (tiny-int8)"
                logger.info(f"Whisper-Tiny INT8 ASR initialized for language '{language}'.")
            else:
                logger.warning("Whisper-Tiny INT8 weights not found locally.")
        except Exception as e:
            logger.error(f"Failed to initialize Whisper ASR: {e}")

    # ──────────────────────────────────────────────────────────────────────────
    # Santali ASR: thunderboltc/whisper-small-santali-ol-chiki (HuggingFace)
    # Fine-tuned on Mozilla Common Voice Santali -- outputs native Ol Chiki script
    # ──────────────────────────────────────────────────────────────────────────
    def init_santali_asr(self):
        """
        Loads Santali ASR (thunderboltc/whisper-small-santali-ol-chiki).
        1. PRIMARY: sherpa-onnx INT8 ONNX Runtime (if converted ONNX files exist).
        2. FALLBACK: HuggingFace model components with local cache.
        """
        enc = WHISPER_SANTALI_DIR / "small-encoder.int8.onnx"
        dec = WHISPER_SANTALI_DIR / "small-decoder.int8.onnx"
        tokens = WHISPER_SANTALI_DIR / "tokens.txt"

        if enc.exists() and dec.exists() and tokens.exists():
            try:
                import sherpa_onnx
                self._santali_recognizer = sherpa_onnx.OfflineRecognizer.from_whisper(
                    encoder=str(enc),
                    decoder=str(dec),
                    tokens=str(tokens),
                    language="sat",
                    task="transcribe",
                    num_threads=2
                )
                self._active_models["whisper_santali_asr"] = "ONLINE (sherpa-onnx whisper-small-santali INT8)"
                logger.info("Santali ASR (sherpa-onnx INT8) loaded successfully.")
                return
            except Exception as e:
                logger.error(f"Sherpa-onnx Santali ASR load error: {e}")

        try:
            import torch
            from transformers import (
                WhisperForConditionalGeneration,
                WhisperFeatureExtractor,
                WhisperTokenizer,
            )

            local_path = str(WHISPER_SANTALI_DIR)
            model_source = local_path if WHISPER_SANTALI_DIR.exists() else WHISPER_SANTALI_HF_ID

            logger.info(f"Loading Santali ASR model from: {model_source}")
            self._active_models["whisper_santali_asr"] = "LOADING..."

            self._santali_model = WhisperForConditionalGeneration.from_pretrained(model_source)
            self._santali_model.eval()

            # Tokenizer is in the fine-tuned repo (Ol Chiki tokens added)
            self._santali_tokenizer = WhisperTokenizer.from_pretrained(model_source)

            # Feature extractor is identical to the base model (same mel-spectrogram config)
            fe_source = (local_path if (WHISPER_SANTALI_DIR / "preprocessor_config.json").exists()
                         else "openai/whisper-small")
            self._santali_feature_extractor = WhisperFeatureExtractor.from_pretrained(fe_source)

            # Persist all components locally for offline use
            if not WHISPER_SANTALI_DIR.exists():
                logger.info(f"Caching Santali model to {WHISPER_SANTALI_DIR}")
                WHISPER_SANTALI_DIR.mkdir(parents=True, exist_ok=True)
                self._santali_model.save_pretrained(local_path)
                self._santali_tokenizer.save_pretrained(local_path)
                self._santali_feature_extractor.save_pretrained(local_path)

            self._santali_pipeline = True  # Sentinel: marks pipeline as ready
            self._active_models["whisper_santali_asr"] = "ONLINE (whisper-small-santali-ol-chiki)"
            logger.info("Santali ASR (whisper-small-santali-ol-chiki) loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load Santali ASR: {e}")
            self._active_models["whisper_santali_asr"] = f"ERROR: {e}"
            self._santali_pipeline = None

    def _transcribe_santali(self, audio_data: np.ndarray, sample_rate: int = 16000) -> str:
        """
        Transcribes Santali speech using whisper-small-santali-ol-chiki.
        Returns native Ol Chiki script.
        """
        if hasattr(self, "_santali_recognizer") and self._santali_recognizer is not None:
            try:
                stream = self._santali_recognizer.create_stream()
                stream.accept_waveform(sample_rate, audio_data.astype(np.float32))
                self._santali_recognizer.decode_stream(stream)
                text = stream.result.text.strip()
                if text in ["[silence]", "[sil", "[music]", ""]:
                    return ""
                return text
            except Exception as e:
                logger.error(f"Sherpa Santali ASR error: {e}")

        if self._santali_pipeline is None:
            self.init_santali_asr()

        if self._santali_pipeline is None:
            logger.error("Santali ASR unavailable.")
            return ""
        try:
            import torch
            inputs = self._santali_feature_extractor(
                audio_data.astype(np.float32),
                sampling_rate=sample_rate,
                return_tensors="pt",
            )
            with torch.no_grad():
                predicted_ids = self._santali_model.generate(
                    inputs.input_features,
                    forced_decoder_ids=[[1, None], [2, 50359]],
                    suppress_tokens=[],
                    begin_suppress_tokens=[220, 50257],
                )
            text = self._santali_tokenizer.batch_decode(predicted_ids, skip_special_tokens=True)[0].strip()
            if text.lower() in ["", "[silence]", "[sil]", "[music]", "[ silence ]"]:
                return ""
            logger.info(f"Santali ASR output: '{text}'")
            return text
        except Exception as e:
            logger.error(f"Santali ASR inference error: {e}")
            return ""

    def transcribe(self, audio_data: np.ndarray, sample_rate: int = 16000, language: str = "hi") -> str:
        """
        Transcribes raw float32 audio waveform.
        - Santali (sat): whisper-small-santali-ol-chiki -> native Ol Chiki script
        - All other languages: sherpa-onnx Whisper-Tiny INT8
        """
        if language == "sat":
            return self._transcribe_santali(audio_data, sample_rate)

        if self._recognizer is None:
            self.init_asr(language=language)

        if self._recognizer is None:
            return ""

        try:
            stream = self._recognizer.create_stream()
            stream.accept_waveform(sample_rate, audio_data.astype(np.float32))
            self._recognizer.decode_stream(stream)
            text = stream.result.text.strip()
            if text in ["[silence]", "[sil", "[music]", ""]:
                return ""
            return text
        except Exception as e:
            logger.error(f"ASR transcription error: {e}")
            return ""

    # ──────────────────────────────────────────────────────────────────────────
    # Neural TTS: Piper VITS ONNX Runtime (Female Voice — Priyamvada)
    # Primary: Offline Piper VITS (priyamvada female), Fallback: gTTS (online)
    # ──────────────────────────────────────────────────────────────────────────
    def init_tts(self):
        try:
            import sherpa_onnx
            # Prefer female voice (priyamvada), fall back to male (pratham)
            female_model = PIPER_TTS_DIR / "hi_IN-priyamvada-medium.onnx"
            male_model = PIPER_TTS_DIR / "hi_IN-pratham-medium.onnx"
            model_path = female_model if female_model.exists() else male_model
            tokens_path = PIPER_TTS_DIR / "tokens.txt"
            data_dir = PIPER_TTS_DIR / "espeak-ng-data"

            if model_path.exists() and tokens_path.exists() and data_dir.exists():
                vits_config = sherpa_onnx.OfflineTtsVitsModelConfig(
                    model=str(model_path),
                    tokens=str(tokens_path),
                    data_dir=str(data_dir),
                )
                model_config = sherpa_onnx.OfflineTtsModelConfig(
                    vits=vits_config,
                    num_threads=2,
                    provider="cpu",
                    debug=0
                )
                config = sherpa_onnx.OfflineTtsConfig(model=model_config)
                self._tts = sherpa_onnx.OfflineTts(config)
                voice_name = model_path.stem  # hi_IN-priyamvada-medium or hi_IN-pratham-medium
                self._active_models["piper_vits_tts"] = f"ONLINE ({voice_name})"
                logger.info(f"Piper VITS Neural TTS initialized: {voice_name}")
            else:
                logger.warning("Piper VITS Hindi model files not found locally.")
        except Exception as e:
            logger.error(f"Failed to initialize Piper VITS TTS: {e}")

    def synthesize_speech(self, text: str, language: str = "hi", speed: float = 1.0) -> Optional[bytes]:
        """
        Synthesizes speech. Strategy:
        1. PRIMARY (offline): Piper VITS ONNX - female Hindi voice (priyamvada)
        2. FALLBACK (online-only): gTTS - only used when Piper fails AND network is available
        """
        if not text or not text.strip():
            return None

        # 1. PRIMARY: Offline Piper VITS (female voice)
        if self._tts is None:
            self.init_tts()
        if self._tts is not None:
            try:
                import io
                import wave
                audio = self._tts.generate(text.strip(), sid=0, speed=speed)
                if audio and len(audio.samples) > 0:
                    samples = np.array(audio.samples)
                    samples_int16 = (samples * 32767).clip(-32768, 32767).astype(np.int16)
                    buf = io.BytesIO()
                    with wave.open(buf, "wb") as wf:
                        wf.setnchannels(1)
                        wf.setsampwidth(2)
                        wf.setframerate(audio.sample_rate)
                        wf.writeframes(samples_int16.tobytes())
                    return buf.getvalue()
            except Exception as e:
                logger.error(f"Piper TTS error: {e}")

        # 2. FALLBACK: gTTS (requires internet — only used if Piper fails)
        try:
            from gtts import gTTS
            import io
            gtts_lang = language if language in ["hi", "bn", "mr", "ta", "te", "en"] else "hi"
            tts = gTTS(text=text.strip(), lang=gtts_lang)
            fp = io.BytesIO()
            tts.write_to_fp(fp)
            logger.info("Used gTTS fallback (online) for speech synthesis.")
            return fp.getvalue()
        except Exception as e:
            logger.warning(f"gTTS fallback also failed (expected offline): {e}")

        return None

    # ──────────────────────────────────────────────────────────────────────────
    # SLM: SmolLM2-360M-Instruct ONNX with Dynamic Swapping
    # ──────────────────────────────────────────────────────────────────────────
    def generate_with_slm(self, prompt: str, max_new_tokens: int = 40) -> str:
        """
        Loads SmolLM2 on-demand, generates completion, and frees memory.
        """
        model_file = SMOLLM2_DIR / "onnx" / "model_q4f16.onnx"
        tok_file = SMOLLM2_DIR / "tokenizer.json"

        if not model_file.exists() or not tok_file.exists():
            logger.warning("SmolLM2-360M weights not found. Using curriculum fallback.")
            return ""

        try:
            import onnxruntime as ort
            from tokenizers import Tokenizer

            self._active_models["slm_generator"] = "LOADING (swapped)"
            logger.info("Mounting SmolLM2-360M into RAM...")

            tokenizer = Tokenizer.from_file(str(tok_file))
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 2
            session = ort.InferenceSession(str(model_file), sess_options=opts)
            self._active_models["slm_generator"] = "ONLINE (SmolLM2-360M)"

            # Format prompt with ChatML if not already present
            if "<|im_start|>" not in prompt:
                formatted_prompt = (
                    "<|im_start|>system\n"
                    "You are an AI teaching assistant for Grade 1-3 Indian classrooms."
                    "<|im_end|>\n"
                    f"<|im_start|>user\n{prompt}<|im_end|>\n"
                    "<|im_start|>assistant\n"
                )
            else:
                formatted_prompt = prompt

            encoded = tokenizer.encode(formatted_prompt)
            curr_tokens = list(encoded.ids)
            gen_tokens = []

            past_kv = {f"past_key_values.{i}.key": np.zeros((1, 5, 0, 64), dtype=np.float32) for i in range(32)}
            past_kv.update({f"past_key_values.{i}.value": np.zeros((1, 5, 0, 64), dtype=np.float32) for i in range(32)})

            for step in range(max_new_tokens):
                if step == 0:
                    seq_len = len(curr_tokens)
                    input_ids = np.array([curr_tokens], dtype=np.int64)
                    attention_mask = np.ones((1, seq_len), dtype=np.int64)
                    position_ids = np.arange(0, seq_len, dtype=np.int64).reshape(1, -1)
                else:
                    input_ids = np.array([[curr_tokens[-1]]], dtype=np.int64)
                    attention_mask = np.ones((1, len(curr_tokens)), dtype=np.int64)
                    position_ids = np.array([[len(curr_tokens) - 1]], dtype=np.int64)

                feeds = {
                    "input_ids": input_ids,
                    "attention_mask": attention_mask,
                    "position_ids": position_ids,
                    **past_kv
                }
                outputs = session.run(None, feeds)
                logits = outputs[0]
                for i in range(32):
                    past_kv[f"past_key_values.{i}.key"] = outputs[1 + i * 2]
                    past_kv[f"past_key_values.{i}.value"] = outputs[2 + i * 2]

                next_token = int(np.argmax(logits[0, -1, :]))
                # 0 is <|endoftext|>, 2 is <|im_end|>
                if next_token in [0, 2]:
                    break
                curr_tokens.append(next_token)
                gen_tokens.append(next_token)

            generated_text = tokenizer.decode(gen_tokens)

            # Cleanup
            del session
            del tokenizer
            gc.collect()
            self._active_models["slm_generator"] = "STANDBY (unloaded)"
            logger.info("SmolLM2-360M successfully unmounted from RAM.")

            return generated_text.strip()
        except Exception as e:
            logger.error(f"SLM inference error: {e}")
            self._active_models["slm_generator"] = "ERROR"
            return ""

    # ──────────────────────────────────────────────────────────────────────────
    # IndicTrans2: Neural Machine Translation (ONNX Runtime)
    # Uses IndicTransONNX with:
    # - Local quantized INT8 1B model for Indic <-> Indic (including Santali sat_Olck)
    # - 200M Distilled ONNX models for English <-> Indic (hari31416/indictrans2-*-ONNX)
    # ──────────────────────────────────────────────────────────────────────────

    def _get_it2_direction(self, src_lang: str, tgt_lang: str) -> str:
        """Determine which IndicTrans2 model direction to use."""
        if src_lang == "en":
            return "en-indic"
        if tgt_lang == "en":
            return "indic-en"
        return "indic-indic"

    def _load_it2_model(self, direction: str) -> bool:
        """
        Lazily loads the appropriate IndicTransONNX model instance.
        """
        if direction in self._it2_models and self._it2_models[direction] is not None:
            return True

        from indictrans_onnx import IndicTransONNX

        model_sources = {
            "indic-indic": str(INDICTRANS_LOCAL_DIR),
            "en-indic":    INDICTRANS_EN_INDIC_ID,
            "indic-en":    INDICTRANS_INDIC_EN_ID,
        }
        source = model_sources.get(direction)
        if not source:
            return False

        try:
            self._active_models[f"indictrans2_{direction}"] = "LOADING..."
            logger.info(f"Loading IndicTransONNX [{direction}] from: {source}")
            translator = IndicTransONNX(source)
            self._it2_models[direction] = translator
            self._active_models[f"indictrans2_{direction}"] = f"ONLINE ({Path(source).name if Path(source).exists() else source})"
            logger.info(f"IndicTransONNX [{direction}] loaded successfully.")
            return True
        except Exception as e:
            logger.error(f"Failed to load IndicTransONNX [{direction}]: {e}")
            self._active_models[f"indictrans2_{direction}"] = f"ERROR: {e}"
            return False

    def translate_indic(self, text: str, src_lang: str, tgt_lang: str) -> Optional[str]:
        """
        Translates text between Indian languages + English + Santali (Ol Chiki).
        """
        src_tag = INDIC_LANG_MAP.get(src_lang, {}).get("tag")
        tgt_tag = INDIC_LANG_MAP.get(tgt_lang, {}).get("tag")
        if not src_tag or not tgt_tag or src_tag == tgt_tag:
            return text

        direction = self._get_it2_direction(src_lang, tgt_lang)
        if not self._load_it2_model(direction):
            return None

        try:
            translator = self._it2_models[direction]
            return translator.translate(text, src_lang=src_tag, tgt_lang=tgt_tag)
        except Exception as e:
            logger.warning(f"IndicTransONNX [{direction}] translation failed: {e}")
            return None

    # ──────────────────────────────────────────────────────────────────────────
    # Model Swapping / RAM Budget Management
    # ──────────────────────────────────────────────────────────────────────────
    def unload_asr(self):
        """Unload ASR from RAM to make room for SLM activity generation"""
        if self._recognizer is not None:
            del self._recognizer
            self._recognizer = None
            self._active_models["whisper_asr"] = "UNLOADED (swapped)"
            gc.collect()
            logger.info("ASR model unloaded to free RAM for SLM.")

    def unload_slm(self):
        """Unload SLM after quiz/flashcard generation"""
        gc.collect()
        self._active_models["slm_generator"] = "STANDBY"
        logger.info("SLM unloaded. Resuming ASR/MT pipeline.")

    def get_status(self) -> Dict[str, Any]:
        return {
            "active_models": self._active_models,
            "vad_ready": self._vad_session is not None,
            "asr_ready": self._recognizer is not None,
            "tts_ready": self._tts is not None,
            "santali_asr_ready": self._santali_pipeline is not None,
            "santali_model_id": WHISPER_SANTALI_HF_ID,
            "whisper_santali_cached": WHISPER_SANTALI_DIR.exists(),
            "indictrans2_loaded": list(self._it2_models.keys()),
            "indictrans2_indic_indic_cached": (INDICTRANS_LOCAL_DIR / "encoder_model.onnx").exists(),
            "indictrans2_en_indic_cached": True,
            "indictrans2_indic_en_cached": True,
            "indictrans2_ready": True,
            "slm_installed": (SMOLLM2_DIR / "onnx" / "model_q4f16.onnx").exists(),
            "piper_vits_installed": (PIPER_TTS_DIR / "hi_IN-pratham-medium.onnx").exists(),
            "supported_languages": list(INDIC_LANG_MAP.keys()),
            "models_directory": str(MODELS_DIR),
        }

# Global Singleton
edge_ai = EdgeModelManager()
