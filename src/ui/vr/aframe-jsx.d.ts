import type { DetailedHTMLProps, HTMLAttributes } from "react";

type AframeElementProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> &
  Record<string, unknown>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "a-scene": AframeElementProps;
      "a-assets": AframeElementProps;
      "a-asset-item": AframeElementProps;
      "a-mixin": AframeElementProps;
      "a-entity": AframeElementProps;
    }
  }
}

export {};
