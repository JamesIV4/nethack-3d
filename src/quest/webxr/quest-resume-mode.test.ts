import { describe, expect, it, vi } from "vitest";
import { QUEST_DESIRED_PRESENTATION_MODE_KEY, QuestResumeMode } from "./quest-resume-mode";

function storage(initial?: string) {
  let value = initial;
  return {
    getItem: vi.fn<(key: string) => string | null>(() => value ?? null),
    setItem: vi.fn<(key: string, value: string) => void>((_key, next) => { value = next; }),
  };
}

function fixture(saved?: string) {
  let visible = true;
  let active = false;
  const savedMode = storage(saved);
  const enterImmersive = vi.fn(async () => { active = true; });
  const exitImmersive = vi.fn(async () => { active = false; });
  const resume = new QuestResumeMode({
    storage: savedMode,
    isVisible: () => visible,
    isImmersiveActive: () => active,
    enterImmersive,
    exitImmersive,
  });
  return {
    resume, savedMode, enterImmersive, exitImmersive,
    setVisible: (next: boolean) => { visible = next; },
    setActive: (next: boolean) => { active = next; },
  };
}

describe("Quest resume presentation mode", () => {
  it("defaults a new install to immersive and restores a saved flat choice after page recreation", async () => {
    const first = fixture();
    expect(first.resume.desired).toBe("immersive");
    await first.resume.chooseFlat();
    expect(first.savedMode.setItem).toHaveBeenCalledWith(QUEST_DESIRED_PRESENTATION_MODE_KEY, "flat");

    const restarted = fixture("flat");
    expect(restarted.resume.desired).toBe("flat");
    await restarted.resume.onVisibilityResume();
    expect(restarted.enterImmersive).not.toHaveBeenCalled();
  });

  it("keeps immersive desired when suspend ends XR and retries once when the page becomes visible", async () => {
    const f = fixture();
    await f.resume.chooseImmersive();
    expect(f.enterImmersive).toHaveBeenCalledTimes(1);

    f.setVisible(false);
    f.setActive(false); // XR end caused by headset idle/suspend, not Exit VR.
    await f.resume.onSessionEnded();
    expect(f.resume.desired).toBe("immersive");
    await f.resume.onVisibilityResume();
    expect(f.enterImmersive).toHaveBeenCalledTimes(1);

    f.setVisible(true);
    await f.resume.onVisibilityResume();
    expect(f.enterImmersive).toHaveBeenCalledTimes(2);
  });

  it("keeps an explicit Exit VR choice flat across a later session end and visibility resume", async () => {
    const f = fixture();
    await f.resume.chooseImmersive();
    await f.resume.chooseFlat();
    expect(f.resume.desired).toBe("flat");
    expect(f.exitImmersive).toHaveBeenCalledTimes(1);

    f.setActive(false);
    await f.resume.onSessionEnded();
    await f.resume.onVisibilityResume();
    expect(f.enterImmersive).toHaveBeenCalledTimes(1);
  });

  it("serializes repeated visibility notifications while an immersive request is pending", async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>(resolve => { release = resolve; });
    let active = false;
    const enterImmersive = vi.fn(async () => { await pending; active = true; });
    const resume = new QuestResumeMode({
      isVisible: () => true,
      isImmersiveActive: () => active,
      enterImmersive,
      exitImmersive: async () => { active = false; },
    });
    const first = resume.onVisibilityResume();
    const second = resume.onVisibilityResume();
    const third = resume.onVisibilityResume();
    await Promise.resolve();
    expect(enterImmersive).toHaveBeenCalledTimes(1);
    release!();
    await Promise.all([first, second, third]);
    expect(enterImmersive).toHaveBeenCalledTimes(1);
  });

  it("uses one retry token when visible is delivered before the suspended XR session ends", async () => {
    const f = fixture();
    await f.resume.chooseImmersive();
    await f.resume.onVisibilityResume(); // Session still reports active at this event.
    f.setActive(false);
    await f.resume.onSessionEnded();
    expect(f.enterImmersive).toHaveBeenCalledTimes(2);

    f.setActive(false);
    await f.resume.onSessionEnded();
    expect(f.enterImmersive).toHaveBeenCalledTimes(2);
  });
});
