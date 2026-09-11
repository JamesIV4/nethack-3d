import type {
  MobileActionEntry
} from "../menus/mobile-actions";

/** Controller radial wheel entries and geometry. */
export type ControllerActionWheelEntry = MobileActionEntry & {
  index: number;
  angleDeg: number;
  clipPath: string;
  labelXPercent: number;
  labelYPercent: number;
};

export const controllerActionWheelOuterRadiusPercent = 50;

export const controllerActionWheelLabelRadiusPercent = 29;

export const controllerActionWheelSliceGapDeg = 1;

export function getControllerActionWheelPolarPoint(
  angleDeg: number,
  radiusPercent: number,
): { x: number; y: number } {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: 50 + Math.cos(radians) * radiusPercent,
    y: 50 + Math.sin(radians) * radiusPercent,
  };
}

export function createControllerActionWheelEntries(
  actions: readonly MobileActionEntry[],
): ControllerActionWheelEntry[] {
  if (actions.length === 0) {
    return [];
  }
  const sliceSpanDeg = 360 / actions.length;
  return actions.map((action, index) => {
    const angleDeg = -90 + index * sliceSpanDeg;
    const halfGapDeg = Math.min(
      sliceSpanDeg * 0.35,
      controllerActionWheelSliceGapDeg / 2,
    );
    const startDeg = angleDeg - sliceSpanDeg / 2 + halfGapDeg;
    const endDeg = angleDeg + sliceSpanDeg / 2 - halfGapDeg;
    const startPoint = getControllerActionWheelPolarPoint(
      startDeg,
      controllerActionWheelOuterRadiusPercent,
    );
    const endPoint = getControllerActionWheelPolarPoint(
      endDeg,
      controllerActionWheelOuterRadiusPercent,
    );
    const labelPoint = getControllerActionWheelPolarPoint(
      angleDeg,
      controllerActionWheelLabelRadiusPercent,
    );
    const clipPath = `polygon(50% 50%, ${startPoint.x.toFixed(2)}% ${startPoint.y.toFixed(2)}%, ${endPoint.x.toFixed(2)}% ${endPoint.y.toFixed(2)}%)`;
    return {
      ...action,
      index,
      angleDeg,
      clipPath,
      labelXPercent: labelPoint.x,
      labelYPercent: labelPoint.y,
    };
  });
}
