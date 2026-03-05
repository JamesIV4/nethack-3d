type XRHandedness = "" | "none" | "left" | "right";
type XRSessionMode = "inline" | "immersive-vr" | "immersive-ar";

interface XRDomOverlayState {
  type: string;
}

interface XRSessionInit {
  optionalFeatures?: string[];
  requiredFeatures?: string[];
  domOverlay?: {
    root: Element;
  };
}

interface XRInputSource {
  handedness: XRHandedness;
  gamepad?: Gamepad | null;
  profiles?: readonly string[];
  targetRayMode?: string;
}

interface XRSessionEventMap {
  end: Event;
}

interface XRSession extends EventTarget {
  inputSources: readonly XRInputSource[];
  domOverlayState?: XRDomOverlayState | null;
  end(): Promise<void>;
  addEventListener<K extends keyof XRSessionEventMap>(
    type: K,
    listener: (this: XRSession, event: XRSessionEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof XRSessionEventMap>(
    type: K,
    listener: (this: XRSession, event: XRSessionEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void;
}

interface XRSystem {
  isSessionSupported(mode: XRSessionMode): Promise<boolean>;
  requestSession(mode: XRSessionMode, options?: XRSessionInit): Promise<XRSession>;
}

interface Navigator {
  xr?: XRSystem;
}
