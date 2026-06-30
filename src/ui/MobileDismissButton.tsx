import type { ButtonHTMLAttributes } from "react";
import { Nh3dIcon, Nh3dIconX } from "./icons";

type MobileDismissButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> & {
  label: string;
};

export function MobileDismissButton({
  className,
  label,
  type = "button",
  ...props
}: MobileDismissButtonProps): JSX.Element {
  return (
    <button
      aria-label={label}
      className={["nh3d-dismiss-button", className].filter(Boolean).join(" ")}
      type={type}
      {...props}
    >
      <Nh3dIcon icon={Nh3dIconX} size={15} strokeWidth={2.7} />
    </button>
  );
}
