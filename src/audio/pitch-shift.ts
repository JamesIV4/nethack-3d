import { SoundTouchNode } from "@soundtouchjs/audio-worklet";
import soundTouchProcessorUrl from "@soundtouchjs/audio-worklet/processor?url";

const pitchRatioEpsilon = 0.001;
const minPitchRatio = 0.1;
const maxPitchRatio = 4;

const registeredContexts = new WeakMap<BaseAudioContext, Promise<boolean>>();

export type Nh3dPitchShiftNode = SoundTouchNode;

export function clampNh3dPitchShiftRatio(
  value: unknown,
  fallback = 1,
): number {
  const parsed =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(minPitchRatio, Math.min(maxPitchRatio, parsed));
}

export function isNh3dPitchShiftRatioSignificant(value: unknown): boolean {
  return Math.abs(clampNh3dPitchShiftRatio(value, 1) - 1) > pitchRatioEpsilon;
}

async function registerSoundTouchWorklet(
  context: BaseAudioContext,
): Promise<boolean> {
  if (!("audioWorklet" in context)) {
    return false;
  }

  const existing = registeredContexts.get(context);
  if (existing) {
    return existing;
  }

  const registration = SoundTouchNode.register(
    context,
    soundTouchProcessorUrl,
  )
    .then(() => true)
    .catch(() => false);
  registeredContexts.set(context, registration);
  return registration;
}

export async function createNh3dPitchShiftNode(
  context: AudioContext,
  pitchRatio: number,
): Promise<Nh3dPitchShiftNode | null> {
  const ratio = clampNh3dPitchShiftRatio(pitchRatio, 1);
  if (!isNh3dPitchShiftRatioSignificant(ratio)) {
    return null;
  }

  const registered = await registerSoundTouchWorklet(context);
  if (!registered) {
    return null;
  }

  try {
    const node = new SoundTouchNode({
      context,
      interpolationStrategy: "lanczos",
    });
    node.playbackRate.value = 1;
    node.pitch.value = ratio;
    node.setStretchParameters({
      overlapMs: 12,
      quickSeek: false,
    });
    return node;
  } catch {
    return null;
  }
}
