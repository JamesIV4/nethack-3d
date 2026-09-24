// Per-instance facial motion. No clip, animation mixer, timer, or global state.
export function createBlinkController(model, { random = Math.random } = {}) {
  const targets = [];
  model.traverse((object) => {
    const index = object.morphTargetDictionary?.Blink;
    if (index !== undefined && object.morphTargetInfluences) {
      targets.push({ object, index });
    }
  });
  const close = .075, hold = .035, open = .14;
  const duration = close + hold + open;
  const interval = () => 2.2 + random() * 3.8;
  let untilNext = targets.length ? interval() : Infinity;
  let elapsed = null;
  let doubleBlink = false;
  let disposed = false;
  const smooth = (t) => t * t * (3 - 2 * t);
  const apply = (weight) => {
    for (const { object, index } of targets) object.morphTargetInfluences[index] = weight;
  };
  apply(0);
  return {
    supported: targets.length > 0,
    update(delta) {
      if (disposed || !targets.length || !Number.isFinite(delta) || delta < 0) return;
      // A suspended/hidden tab resumes with open eyes rather than replaying a
      // backlog of blinks. The normal render delta is independent of clip speed.
      if (delta > 1) {
        elapsed = null;
        doubleBlink = false;
        untilNext = interval();
        apply(0);
        return;
      }
      if (elapsed === null) {
        untilNext -= delta;
        if (untilNext > 0) { apply(0); return; }
        elapsed = -untilNext;
      } else elapsed += delta;
      if (elapsed >= duration) {
        elapsed = null;
        if (!doubleBlink && random() < .10) {
          untilNext = .12 + random() * .12;
          doubleBlink = true;
        } else {
          untilNext = interval();
          doubleBlink = false;
        }
        apply(0);
        return;
      }
      const weight = elapsed < close ? smooth(elapsed / close)
        : elapsed < close + hold ? 1
          : 1 - smooth((elapsed - close - hold) / open);
      apply(weight);
    },
    dispose() {
      apply(0);
      targets.length = 0;
      disposed = true;
    },
  };
}
