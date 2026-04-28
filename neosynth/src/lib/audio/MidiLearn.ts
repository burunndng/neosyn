/**
 * Web MIDI integration with per-knob paramKey registry.
 *
 *  - Knobs register an `onChange(normalised: 0..1)` handler under a stable
 *    `paramKey` (e.g. "deck.0.gain", "fx.delayWet").
 *  - Bindings map paramKey → { deviceName, channel, cc }.
 *  - Incoming CC messages look up bound paramKeys and fire their handler with
 *    `data2 / 127`.
 *  - When `learnTarget` is set, the next CC capture binds that paramKey
 *    instead of forwarding the value.
 */

export interface MidiBinding {
  /** Device name at the time of binding (used for re-attach on reload). */
  deviceName: string;
  /** MIDI channel 0..15. */
  channel: number;
  /** CC number 0..127. */
  cc: number;
}

type Listener = () => void;
type ParamHandler = (normalized: number) => void;

interface DeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: "connected" | "disconnected";
}

class MidiLearnManager {
  private access: MIDIAccess | null = null;
  private supported = typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;
  private bindings: Map<string, MidiBinding> = new Map();
  private handlers: Map<string, ParamHandler> = new Map();
  private listeners: Set<Listener> = new Set();
  private learnTarget: string | null = null;
  private active = false;
  private requestedAccess = false;

  /** Loaded synchronously from localStorage. */
  private static STORAGE_KEY = "midiBindings";

  constructor() {
    this.loadBindings();
  }

  isSupported(): boolean { return this.supported; }
  isActive(): boolean { return this.active; }
  hasAccess(): boolean { return this.access !== null; }

  /** Idempotent — request MIDI access (resolves true on success). */
  async ensureAccess(): Promise<boolean> {
    if (this.access) return true;
    if (!this.supported) return false;
    if (this.requestedAccess) return false;
    this.requestedAccess = true;
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.attachAllInputs();
      this.access.onstatechange = () => {
        this.attachAllInputs();
        this.notify();
      };
      this.active = true;
      this.notify();
      return true;
    } catch (e) {
      console.warn("[MidiLearn] access denied:", e);
      this.requestedAccess = false;
      return false;
    }
  }

  /** Disable runtime CC routing without revoking MIDI access. */
  setActive(v: boolean) {
    this.active = v;
    this.notify();
  }

  getDevices(): DeviceInfo[] {
    if (!this.access) return [];
    const result: DeviceInfo[] = [];
    this.access.inputs.forEach((input) => {
      result.push({
        id: input.id,
        name: input.name ?? "(unnamed)",
        manufacturer: input.manufacturer ?? "",
        state: input.state,
      });
    });
    return result;
  }

  getLearnTarget(): string | null { return this.learnTarget; }

  setLearnTarget(paramKey: string | null) {
    this.learnTarget = paramKey;
    this.notify();
  }

  /** Returns the binding currently in effect for a paramKey. */
  getBinding(paramKey: string): MidiBinding | null {
    return this.bindings.get(paramKey) ?? null;
  }

  /** All bindings as a snapshot array (for UI listing). */
  getAllBindings(): Array<{ paramKey: string; binding: MidiBinding }> {
    return Array.from(this.bindings.entries()).map(([paramKey, binding]) => ({ paramKey, binding }));
  }

  setBinding(paramKey: string, binding: MidiBinding) {
    // Remove any other paramKey already mapped to the same channel+cc on the same device
    for (const [existingKey, existing] of this.bindings) {
      if (
        existingKey !== paramKey
        && existing.channel === binding.channel
        && existing.cc === binding.cc
        && existing.deviceName === binding.deviceName
      ) {
        this.bindings.delete(existingKey);
      }
    }
    this.bindings.set(paramKey, binding);
    this.persist();
    this.notify();
  }

  clearBinding(paramKey: string) {
    if (this.bindings.delete(paramKey)) {
      this.persist();
      this.notify();
    }
  }

  clearAllBindings() {
    if (this.bindings.size === 0) return;
    this.bindings.clear();
    this.persist();
    this.notify();
  }

  /** Knob calls this on mount. Returns unregister fn. */
  registerKnob(paramKey: string, handler: ParamHandler): () => void {
    this.handlers.set(paramKey, handler);
    return () => {
      if (this.handlers.get(paramKey) === handler) this.handlers.delete(paramKey);
    };
  }

  /** UI subscription for re-render on binding/target changes. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    for (const l of this.listeners) l();
  }

  private attachAllInputs() {
    if (!this.access) return;
    this.access.inputs.forEach((input) => {
      // Replace handler unconditionally — safe even if attached previously.
      input.onmidimessage = (e) => this.onMidiMessage(input, e);
    });
  }

  private onMidiMessage(input: MIDIInput, e: MIDIMessageEvent) {
    if (!this.active || !e.data) return;
    const status = e.data[0];
    const data1 = e.data[1];
    const data2 = e.data[2] ?? 0;
    const messageType = status & 0xf0;
    const channel = status & 0x0f;

    // Only handle CC messages (0xB0)
    if (messageType !== 0xb0) return;

    const cc = data1;
    const value = data2;
    const deviceName = input.name ?? "";

    // Capture mode
    if (this.learnTarget !== null) {
      const target = this.learnTarget;
      this.setBinding(target, { deviceName, channel, cc });
      this.learnTarget = null;
      this.notify();
      return;
    }

    // Forward to bound paramKey(s)
    for (const [paramKey, binding] of this.bindings) {
      if (binding.channel === channel
        && binding.cc === cc
        && (binding.deviceName === "" || binding.deviceName === deviceName)
      ) {
        const h = this.handlers.get(paramKey);
        if (h) h(value / 127);
      }
    }
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private loadBindings() {
    try {
      if (typeof localStorage === "undefined") return;
      const raw = localStorage.getItem(MidiLearnManager.STORAGE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw) as Record<string, MidiBinding>;
      for (const [k, v] of Object.entries(obj)) {
        if (
          typeof v === "object" && v !== null
          && typeof v.channel === "number"
          && typeof v.cc === "number"
          && typeof v.deviceName === "string"
        ) {
          this.bindings.set(k, v);
        }
      }
    } catch (e) {
      console.warn("[MidiLearn] failed to load bindings:", e);
    }
  }

  private persist() {
    try {
      if (typeof localStorage === "undefined") return;
      const obj: Record<string, MidiBinding> = {};
      this.bindings.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem(MidiLearnManager.STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn("[MidiLearn] failed to persist bindings:", e);
    }
  }
}

export const midiLearn = new MidiLearnManager();

/** Format a binding for display in the bindings list. */
export function formatBinding(b: MidiBinding): string {
  return `${b.deviceName || "any"} · ch${b.channel + 1} · CC${b.cc}`;
}

/** Pretty-print a paramKey for the UI. */
export function prettyParamKey(key: string): string {
  // deck.0.gain → "Deck 1 GAIN"
  const parts = key.split(".");
  if (parts[0] === "deck" && parts.length === 3) {
    const idx = parseInt(parts[1]) + 1;
    return `Deck ${idx} ${parts[2].toUpperCase()}`;
  }
  if (parts[0] === "fx") {
    return `FX ${parts.slice(1).join(" ").toUpperCase()}`;
  }
  if (parts[0] === "macro" && parts.length === 2) {
    return `Macro ${parseInt(parts[1]) + 1}`;
  }
  if (parts[0] === "lfo" && parts.length === 3) {
    return `LFO ${parts[1]} ${parts[2].toUpperCase()}`;
  }
  if (parts[0] === "master") {
    return `Master ${parts.slice(1).join(" ").toUpperCase()}`;
  }
  return key;
}
