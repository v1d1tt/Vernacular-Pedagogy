/**
 * Captures microphone audio, resamples to 16kHz mono PCM 16-bit,
 * and encodes to base64 for the Whisper-Tiny INT8 / Silero VAD engine.
 */
export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private pcmChunks: Float32Array[] = [];
  private isRecording: boolean = false;

  async start(): Promise<void> {
    this.pcmChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    const source = this.audioContext.createMediaStreamSource(this.stream);

    // Buffer size 4096, 1 input channel, 1 output channel
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const inputData = e.inputBuffer.getChannelData(0);
      this.pcmChunks.push(new Float32Array(inputData));
    };

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    this.isRecording = true;
  }

  async stop(): Promise<string> {
    this.isRecording = false;

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    const sampleRate = this.audioContext?.sampleRate || 44100;
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Flatten chunks
    const totalSamples = this.pcmChunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Resample to 16000 Hz if needed
    const resampled = this.resampleTo16k(merged, sampleRate);

    // Convert Float32 (-1.0 to 1.0) to Int16 PCM
    const int16Buffer = new Int16Array(resampled.length);
    for (let i = 0; i < resampled.length; i++) {
      const s = Math.max(-1, Math.min(1, resampled[i]));
      int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Convert Int16Array buffer to Base64
    const uint8Bytes = new Uint8Array(int16Buffer.buffer);
    let binary = "";
    const len = uint8Bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Bytes[i]);
    }
    return window.btoa(binary);
  }

  private resampleTo16k(audioData: Float32Array, origSampleRate: number): Float32Array {
    if (origSampleRate === 16000) return audioData;
    const ratio = origSampleRate / 16000;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const origIndex = i * ratio;
      const indexFloor = Math.floor(origIndex);
      const indexCeil = Math.min(audioData.length - 1, Math.ceil(origIndex));
      const t = origIndex - indexFloor;
      result[i] = (1 - t) * (audioData[indexFloor] || 0) + t * (audioData[indexCeil] || 0);
    }
    return result;
  }
}
