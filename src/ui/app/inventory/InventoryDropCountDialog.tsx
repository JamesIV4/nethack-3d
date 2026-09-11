import {
  type ChangeEvent
} from "react";
import AnimatedDialog from "../../modals/AnimatedDialog";
import type * as React from "react";
import type {
  InventoryDropCountDialogState
} from "./types";
import {
  commonStrings,
  t
} from "../shared/translations";

export interface InventoryDropCountDialogProps {
  inventoryDropCountDialog: InventoryDropCountDialogState | null;
  closeInventoryDropCountModal: () => void;
  submitInventoryDropCount: () => void;
  inventoryDropCountMaxValue: number;
  setInventoryDropCountValue: React.Dispatch<React.SetStateAction<number>>;
  clampInventoryDropCountValue: (nextValue: number) => number;
  inventoryDropCountSliderRef: React.MutableRefObject<HTMLInputElement | null>;
  inventoryDropCountValue: number;
  stepInventoryDropCountValue: (delta: number) => void;
}

export function InventoryDropCountDialog({
  inventoryDropCountDialog,
  closeInventoryDropCountModal,
  submitInventoryDropCount,
  inventoryDropCountMaxValue,
  setInventoryDropCountValue,
  clampInventoryDropCountValue,
  inventoryDropCountSliderRef,
  inventoryDropCountValue,
  stepInventoryDropCountValue,
}: InventoryDropCountDialogProps) {
  return (
    <AnimatedDialog
      className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions"
      id="nh3d-inventory-drop-count-dialog"
      open={Boolean(inventoryDropCountDialog)}
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          closeInventoryDropCountModal();
          return;
        }
        if (event.key !== "Enter" && event.key !== "NumpadEnter") {
          return;
        }
        const target = event.target as HTMLElement | null;
        if (target?.tagName === "BUTTON") {
          return;
        }
        event.preventDefault();
        submitInventoryDropCount();
      }}
      onKeyUp={(event) => {
        event.stopPropagation();
      }}
    >
      {inventoryDropCountDialog ? (
        <>
          <div className="nh3d-question-text">
            {t.dialogs.inventoryDropCount.title}
          </div>
          <div className="nh3d-inventory-drop-count-description">
            {inventoryDropCountDialog.itemText}
          </div>
          <div className="nh3d-inventory-drop-count-hint">
            {t.dialogs.inventoryDropCount.chooseAmount(
              inventoryDropCountMaxValue,
            )}
          </div>
          <div className="nh3d-inventory-drop-count-controls">
            <div className="nh3d-option-slider-control nh3d-inventory-drop-count-slider-control">
              <input
                aria-label={t.dialogs.inventoryDropCount.ariaLabel}
                className="nh3d-option-slider"
                max={inventoryDropCountMaxValue}
                min={1}
                onInput={(event: ChangeEvent<HTMLInputElement>) => {
                  setInventoryDropCountValue(
                    clampInventoryDropCountValue(
                      Number(event.currentTarget.value),
                    ),
                  );
                }}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setInventoryDropCountValue(
                    clampInventoryDropCountValue(
                      Number(event.currentTarget.value),
                    ),
                  );
                }}
                ref={inventoryDropCountSliderRef}
                step={1}
                type="range"
                value={inventoryDropCountValue}
              />
              <div className="nh3d-option-slider-value">
                {inventoryDropCountValue} / {inventoryDropCountMaxValue}
              </div>
            </div>
            <div className="nh3d-inventory-drop-count-step-actions">
              <button
                aria-label={t.dialogs.inventoryDropCount.setMinimum}
                className="nh3d-menu-action-button nh3d-inventory-drop-count-step-button"
                disabled={inventoryDropCountValue <= 1}
                onClick={() => {
                  setInventoryDropCountValue(1);
                }}
                type="button"
              >
                {"<<"}
              </button>
              <button
                aria-label={t.dialogs.inventoryDropCount.decrease}
                className="nh3d-menu-action-button nh3d-inventory-drop-count-step-button"
                disabled={inventoryDropCountValue <= 1}
                onClick={() => {
                  stepInventoryDropCountValue(-1);
                }}
                type="button"
              >
                {"<"}
              </button>
              <button
                aria-label={t.dialogs.inventoryDropCount.increase}
                className="nh3d-menu-action-button nh3d-inventory-drop-count-step-button"
                disabled={
                  inventoryDropCountValue >= inventoryDropCountMaxValue
                }
                onClick={() => {
                  stepInventoryDropCountValue(1);
                }}
                type="button"
              >
                {">"}
              </button>
              <button
                aria-label={t.dialogs.inventoryDropCount.setMaximum}
                className="nh3d-menu-action-button nh3d-inventory-drop-count-step-button"
                disabled={
                  inventoryDropCountValue >= inventoryDropCountMaxValue
                }
                onClick={() => {
                  setInventoryDropCountValue(inventoryDropCountMaxValue);
                }}
                type="button"
              >
                {">>"}
              </button>
            </div>
          </div>
          <div className="nh3d-menu-actions">
            <button
              className="nh3d-menu-action-button nh3d-menu-action-confirm"
              onClick={submitInventoryDropCount}
              type="button"
            >
              {t.dialogs.inventoryDropMenu.title}
            </button>
            <button
              className="nh3d-menu-action-button nh3d-menu-action-cancel"
              onClick={closeInventoryDropCountModal}
              type="button"
            >
              {commonStrings.cancel}
            </button>
          </div>
        </>
      ) : null}
    </AnimatedDialog>
  );
}
