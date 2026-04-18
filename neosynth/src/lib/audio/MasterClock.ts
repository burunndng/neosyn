export type ClockDivision = "1/1" | "1/2" | "1/4" | "1/8" | "1/16" | "1/4T" | "1/8T";

export const CLOCK_DIVISIONS: ClockDivision[] = ["1/1", "1/2", "1/4", "1/8", "1/16", "1/4T", "1/8T"];

// Multiplier relative to BPS (bpm/60). e.g. "1/4" = 1 beat/sec at any BPM
const DIVISION_MULTIPLIERS: Record<ClockDivision, number> = {
  "1/1":  0.25,
  "1/2":  0.5,
  "1/4":  1,
  "1/8":  2,
  "1/16": 4,
  "1/4T": 4 / 3,
  "1/8T": 8 / 3,
};

export class MasterClock {
  bpm = 120;
  private tapTimes: number[] = [];
  private tapResetTimer: ReturnType<typeof setTimeout> | null = null;

  setBpm(bpm: number) {
    this.bpm = Math.max(20, Math.min(300, bpm));
  }

  tap(): number {
    const now = performance.now();

    if (this.tapResetTimer) clearTimeout(this.tapResetTimer);
    this.tapResetTimer = setTimeout(() => { this.tapTimes = []; }, 3000);

    this.tapTimes.push(now);
    if (this.tapTimes.length > 8) this.tapTimes.shift();

    if (this.tapTimes.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < this.tapTimes.length; i++) {
        intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      this.bpm = Math.round(Math.max(20, Math.min(300, 60000 / avg)));
    }
    return this.bpm;
  }

  divisionHz(div: ClockDivision): number {
    return (this.bpm / 60) * DIVISION_MULTIPLIERS[div];
  }

  divisionSeconds(div: ClockDivision): number {
    return 1 / this.divisionHz(div);
  }

  /** Convert current BPM quarter-note rate to Hz */
  toHz(): number {
    return this.bpm / 60;
  }

  getDivisionMultiplier(div: ClockDivision): number {
    return DIVISION_MULTIPLIERS[div];
  }
}

export const masterClock = new MasterClock();
