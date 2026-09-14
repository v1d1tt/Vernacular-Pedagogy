/**
 * ContinuousAudioStreamer captures real-time microphone input continuously
 * and emits resampled 16kHz mono 16-bit PCM base64 chunks every ~1.5-2.0 seconds.
 * 
 * Supports complete buffer flushing on stop/mute so zero spoken content is dropped.
 */
export type ChunkCallback = (base64Pcm: string, seqNum: number, isFinal: boolean) => Promise<void>;

export class ContinuousAudioStreamer {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private pcmBuffer: Float32Array[] = [];
  private totalSamplesInBuffer: number = 0;
  private isStreaming: boolean = false;
  private sequenceNumber: number = 0;
  private onChunk: ChunkCallback | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;
  private sampleRate: number = 44100;
  private chunkDurationSeconds: number = 1.8; // 1.8 second windows

  async start(onChunk: ChunkCallback): Promise<void> {
    if (this.isStreaming) return;

    this.onChunk = onChunk;
    this.sequenceNumber = 0;
    this.pcmBuffer = [];
    this.totalSamplesInBuffer = 0;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    this.sampleRate = this.audioContext.sampleRate;
    const source = this.audioContext.createMediaStreamSource(this.stream);

    // Buffer size 4096, 1 input channel, 1 output channel
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isStreaming) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const copy = new Float32Array(inputData);
      this.pcmBuffer.push(copy);
      this.totalSamplesInBuffer += copy.length;
    };

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    this.isStreaming = true;

    // Flush chunk periodically every chunkDurationSeconds
    const checkIntervalMs = Math.round(this.chunkDurationSeconds * 1000);
    this.intervalTimer = setInterval(async () => {
      if (!this.isStreaming) return;
      await this.emitChunk(false);
    }, checkIntervalMs);
  }

  private async emitChunk(isFinal: boolean): Promise<void> {
    if (this.pcmBuffer.length === 0 && !isFinal) return;

    const chunksToProcess = [...this.pcmBuffer];
    const samplesCount = this.totalSamplesInBuffer;

    // Clear buffer for next window
    this.pcmBuffer = [];
    this.totalSamplesInBuffer = 0;

    if (samplesCount === 0 && isFinal) {
      if (this.onChunk) {
        await this.onChunk("", this.sequenceNumber++, true);
      }
      return;
    }

    const merged = new Float32Array(samplesCount);
    let offset = 0;
    for (const chunk of chunksToProcess) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Resample merged buffer to 16kHz
    const resampled = this.resampleTo16k(merged, this.sampleRate);
    if (resampled.length === 0 && !isFinal) return;

    // Convert Float32 to Int16 PCM Base64
    const base64 = this.float32ToBase64Pcm(resampled);
    if (this.onChunk) {
      await this.onChunk(base64, this.sequenceNumber++, isFinal);
    }
  }

  /**
   * Stop microphone hardware and flush ALL remaining audio in buffer.
   * Guarantees 100% of recorded teacher speech is processed.
   */
  async flushAndStop(): Promise<void> {
    if (!this.isStreaming) return;

    this.isStreaming = false;

    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    // Stop mic tracks immediately so no new audio comes in
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Emit final remaining chunk
    await this.emitChunk(true);
  }

  private resampleTo16k(audioData: Float32Array, origSampleRate: number): Float32Array {
    if (origSampleRate === 16000 || audioData.length === 0) return audioData;
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

  private float32ToBase64Pcm(resampled: Float32Array): string {
    const int16Buffer = new Int16Array(resampled.length);
    for (let i = 0; i < resampled.length; i++) {
      const s = Math.max(-1, Math.min(1, resampled[i]));
      int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    const uint8Bytes = new Uint8Array(int16Buffer.buffer);
    let binary = "";
    const len = uint8Bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Bytes[i]);
    }
    return window.btoa(binary);
  }
}
