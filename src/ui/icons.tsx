import {
  ArrowDown,
  ArrowUp,
  Minus,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

export type Nh3dIconProps = Omit<
  LucideProps,
  "absoluteStrokeWidth" | "size" | "strokeWidth"
> & {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
};

export function Nh3dIcon({
  icon: Icon,
  size = 16,
  strokeWidth = 2.25,
  ...props
}: Nh3dIconProps): JSX.Element {
  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      size={size}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth
      {...props}
    />
  );
}

export const Nh3dIconArrowDown = ArrowDown;
export const Nh3dIconArrowUp = ArrowUp;
export const Nh3dIconMinus = Minus;
export const Nh3dIconX = X;
