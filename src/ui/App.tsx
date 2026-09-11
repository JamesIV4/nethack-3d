import { useAppModel } from "./app/useAppModel";
import { CanvasRoot } from "./app/layout/CanvasRoot";
import { TerminalMessageGutter } from "./app/messages/TerminalMessageGutter";
import { PauseMenu } from "./app/layout/PauseMenu";
import { StartupBackdrop } from "./app/startup/StartupBackdrop";
import { DebugSessionLogsDialog } from "./app/diagnostics/DebugSessionLogsDialog";
import { StartupLogo } from "./app/startup/StartupLogo";
import { StartupUpdateDialog } from "./app/startup/StartupUpdateDialog";
import { VariantDialog } from "./app/startup/VariantDialog";
import { StartupMenuDialog } from "./app/startup/StartupMenuDialog";
import { ResumeGameDialog } from "./app/startup/ResumeGameDialog";
import { TopScoresDialog } from "./app/scores/TopScoresDialog";
import { TopScoreDetailDialog } from "./app/scores/TopScoreDetailDialog";
import { RandomCharacterDialog } from "./app/startup/RandomCharacterDialog";
import { CreateCharacterDialog } from "./app/startup/CreateCharacterDialog";
import { LoadingOverlay } from "./app/layout/LoadingOverlay";
import { DesktopMessageLog } from "./app/messages/DesktopMessageLog";
import { MobileMessageLog } from "./app/messages/MobileMessageLog";
import { FloatingMessages } from "./app/messages/FloatingMessages";
import { StatusBar } from "./app/status/StatusBar";
import { ClientOptionsDialog } from "./app/settings/ClientOptionsDialog";
import { ResetClientOptionsDialog } from "./app/settings/ResetClientOptionsDialog";
import { ControllerRemapDialog } from "./app/settings/ControllerRemapDialog";
import { TilesetManagerDialog } from "./app/settings/TilesetManagerDialog";
import { DarkWallTilePicker } from "./app/settings/DarkWallTilePicker";
import { BackgroundTilePicker } from "./app/settings/BackgroundTilePicker";
import { BackgroundColorPicker } from "./app/settings/BackgroundColorPicker";
import { TextInputDialog } from "./app/prompts/TextInputDialog";
import { QuestionDialog } from "./app/prompts/QuestionDialog";
import { RuntimeErrorDialog } from "./app/startup/RuntimeErrorDialog";
import { NewGameDialog } from "./app/startup/NewGameDialog";
import { DirectionDialog } from "./app/prompts/DirectionDialog";
import { CharacterInfoDialog } from "./app/character/CharacterInfoDialog";
import { InventoryDialog } from "./app/inventory/InventoryDialog";
import { InventoryContextMenu } from "./app/inventory/InventoryContextMenu";
import { InventoryDropTypePortal } from "./app/inventory/InventoryDropTypePortal";
import { InventoryDropCountDialog } from "./app/inventory/InventoryDropCountDialog";
import { FpsCrosshair } from "./app/context/FpsCrosshair";
import { TileContextMenu } from "./app/context/TileContextMenu";
import { ControllerActionWheel } from "./app/actions/ControllerActionWheel";
import { MobileActionSheet } from "./app/actions/MobileActionSheet";
import { WizardCommandsSheet } from "./app/actions/WizardCommandsSheet";
import { WizardCommandsButton } from "./app/actions/WizardCommandsButton";
import { RepeatActionButton } from "./app/actions/RepeatActionButton";
import { SafeZonePreview } from "./app/settings/SafeZonePreview";
import { DesktopActions } from "./app/actions/DesktopActions";
import { MobileBottomBar } from "./app/actions/MobileBottomBar";
import { PositionDialog } from "./app/prompts/PositionDialog";
import { ControllerSupportDialog } from "./app/controller/ControllerSupportDialog";
import { GlobalConfirmationDialog } from "./app/layout/GlobalConfirmationDialog";

/** UI composition; feature hooks own state and behavior under ./app. */
export default function App(): JSX.Element {
  const model = useAppModel();
  return (
    <>
      <CanvasRoot {...model.canvasRoot} />
      <TerminalMessageGutter {...model.terminalMessageGutter} />
      <PauseMenu {...model.pauseMenu} />
      <StartupBackdrop {...model.startupBackdrop} />
      <DebugSessionLogsDialog {...model.debugSessionLogsDialog} />
      <StartupLogo {...model.startupLogo} />
      <StartupUpdateDialog {...model.startupUpdateDialog} />
      <VariantDialog {...model.variantDialog} />
      <StartupMenuDialog {...model.startupMenuDialog} />
      <ResumeGameDialog {...model.resumeGameDialog} />
      <TopScoresDialog {...model.topScoresDialog} />
      <TopScoreDetailDialog {...model.topScoreDetailDialog} />
      <RandomCharacterDialog {...model.randomCharacterDialog} />
      <CreateCharacterDialog {...model.createCharacterDialog} />
      <LoadingOverlay {...model.loadingOverlay} />
      <DesktopMessageLog {...model.desktopMessageLog} />
      <MobileMessageLog {...model.mobileMessageLog} />
      <FloatingMessages {...model.floatingMessages} />
      <StatusBar {...model.statusBar} />
      <ClientOptionsDialog {...model.clientOptionsDialog} />
      <ResetClientOptionsDialog {...model.resetClientOptionsDialog} />
      <ControllerRemapDialog {...model.controllerRemapDialog} />
      <TilesetManagerDialog {...model.tilesetManagerDialog} />
      <DarkWallTilePicker {...model.darkWallTilePicker} />
      <BackgroundTilePicker {...model.backgroundTilePicker} />
      <BackgroundColorPicker {...model.backgroundColorPicker} />
      <TextInputDialog {...model.textInputDialog} />
      <QuestionDialog {...model.questionDialog} />
      <RuntimeErrorDialog {...model.runtimeErrorDialog} />
      <NewGameDialog {...model.newGameDialog} />
      <DirectionDialog {...model.directionDialog} />
      <CharacterInfoDialog {...model.characterInfoDialog} />
      <InventoryDialog {...model.inventoryDialog} />
      <InventoryContextMenu {...model.inventoryContextMenu} />
      <InventoryDropTypePortal {...model.inventoryDropTypePortal} />
      <InventoryDropCountDialog {...model.inventoryDropCountDialog} />
      <FpsCrosshair {...model.fpsCrosshair} />
      <TileContextMenu {...model.tileContextMenu} />
      <ControllerActionWheel {...model.controllerActionWheel} />
      <MobileActionSheet {...model.mobileActionSheet} />
      <WizardCommandsSheet {...model.wizardCommandsSheet} />
      <WizardCommandsButton {...model.wizardCommandsButton} />
      <RepeatActionButton {...model.repeatActionButton} />
      <SafeZonePreview {...model.safeZonePreview} />
      <DesktopActions {...model.desktopActions} />
      <MobileBottomBar {...model.mobileBottomBar} />
      <PositionDialog {...model.positionDialog} />
      <ControllerSupportDialog {...model.controllerSupportDialog} />
      <GlobalConfirmationDialog {...model.globalConfirmationDialog} />
    </>
  );
}
