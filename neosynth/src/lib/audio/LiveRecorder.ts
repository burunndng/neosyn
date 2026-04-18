export interface RecordedEvent {
  t: number;        // seconds since recording start
  type: string;
  data: unknown;
}

function getSupportedMimeType(): string {
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export class LiveRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startMs = 0;
  events: RecordedEvent[] = [];

  get isRecording() {
    return this.recorder?.state === "recording";
  }

  start(stream: MediaStream) {
    this.chunks = [];
    this.events = [];
    this.startMs = performance.now();

    const mimeType = getSupportedMimeType();
    this.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(100);
  }

  log(type: string, data: unknown) {
    this.events.push({ t: (performance.now() - this.startMs) / 1000, type, data });
  }

  async stop(): Promise<{ audioBlob: Blob; eventsJson: string } | null> {
    if (!this.recorder) return null;
    return new Promise((resolve) => {
      this.recorder!.onstop = () => {
        const audioBlob = new Blob(this.chunks, { type: this.recorder!.mimeType || "audio/webm" });
        const eventsJson = JSON.stringify(this.events, null, 2);
        resolve({ audioBlob, eventsJson });
      };
      this.recorder!.stop();
    });
  }
}

export const liveRecorder = new LiveRecorder();
