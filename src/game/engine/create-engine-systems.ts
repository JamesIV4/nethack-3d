import { LevelTerrainCache } from "./world/level-terrain-cache";
import { DarkCorridorInference } from "./world/dark-corridor-inference";
import { Minimap } from "./ui/minimap";
import { TileUpdates } from "./world/tile-updates";
import { WorldClassification } from "./world/world-classification";
import { RuntimeEntityTracking } from "./world/runtime-entity-tracking";
import { PlayerMovement } from "./world/player-movement";
import { EntityMovement } from "./world/entity-movement";
import { CombatAttribution } from "./world/combat-attribution";
import { RunTelemetry } from "./world/run-telemetry";
import { GameOver } from "./ui/game-over";
import { PlayerStatus } from "./ui/player-status";
import { AudioHapticsPlatform } from "./audio/audio-haptics-platform";
import { FpsDiagnostics } from "./diagnostics/fps-diagnostics";
import { HeldWeaponAnimationDebug } from "./diagnostics/held-weapon-animation-debug";
import { VultureProjectionDebug } from "./diagnostics/vulture-projection-debug";
import { Lighting } from "./rendering/lighting";
import { RenderPipeline } from "./rendering/render-pipeline";
import { WebXrPresentation } from "./rendering/webxr-presentation";
import { QuestSceneExport } from "./rendering/quest-scene-export-system";
import { BloodGround } from "./effects/blood-ground";
import { TilesetAssets } from "./rendering/tileset-assets";
import { VultureProjection } from "./rendering/vulture-projection";
import { WallOverlays } from "./rendering/wall-overlays";
import { VultureWalls } from "./rendering/vulture-walls";
import { GlyphTextures } from "./rendering/glyph-textures";
import { TileMaterials } from "./rendering/tile-materials";
import { FloorOcclusion } from "./rendering/floor-occlusion";
import { WallGeometry } from "./rendering/wall-geometry";
import { DamageFlashes } from "./effects/damage-flashes";
import { BloodParticles } from "./effects/blood-particles";
import { DamageNumbers } from "./effects/damage-numbers";
import { BillboardShatter } from "./effects/billboard-shatter";
import { EntityBillboards } from "./rendering/entity-billboards";
import { TerminalRendering } from "./rendering/terminal-rendering";
import { TileRendering } from "./rendering/tile-rendering";
import { HeldWeapon } from "./rendering/held-weapon";
import { Camera } from "./camera/camera";
import { PositionSelection } from "./input/position-selection";
import { InputCommands } from "./input/input-commands";
import { ExtendedCommands } from "./ui/extended-commands";
import { QuestionMenus } from "./ui/question-menus";
import { PromptDialogs } from "./ui/prompt-dialogs";
import { MenuPreviews } from "./ui/menu-previews";
import { DirectionPrompts } from "./ui/direction-prompts";
import { MovementInput } from "./input/movement-input";
import { KeyboardInput } from "./input/keyboard-input";
import { ModalNavigation } from "./ui/modal-navigation";
import { PointerLock } from "./input/pointer-lock";
import { PointerTargeting } from "./input/pointer-targeting";
import { TileContextActions } from "./ui/tile-context-actions";
import { AimHighlights } from "./ui/aim-highlights";
import { TouchInput } from "./input/touch-input";
import { MouseInput } from "./input/mouse-input";
import { ControllerGameplay } from "./input/controller-gameplay";
import { ControllerDialogs } from "./input/controller-dialogs";
import { EngineState } from "./runtime/engine-state";
import { EngineMessages } from "./ui/engine-messages";
import type { EngineCoordinator } from "./engine-coordinator";

export interface EngineSystems {
  readonly levelTerrainCache: LevelTerrainCache;
  readonly darkCorridorInference: DarkCorridorInference;
  readonly minimap: Minimap;
  readonly tileUpdates: TileUpdates;
  readonly worldClassification: WorldClassification;
  readonly runtimeEntityTracking: RuntimeEntityTracking;
  readonly playerMovement: PlayerMovement;
  readonly entityMovement: EntityMovement;
  readonly combatAttribution: CombatAttribution;
  readonly runTelemetry: RunTelemetry;
  readonly gameOver: GameOver;
  readonly playerStatus: PlayerStatus;
  readonly audioHapticsPlatform: AudioHapticsPlatform;
  readonly fpsDiagnostics: FpsDiagnostics;
  readonly heldWeaponAnimationDebug: HeldWeaponAnimationDebug;
  readonly vultureProjectionDebug: VultureProjectionDebug;
  readonly lighting: Lighting;
  readonly renderPipeline: RenderPipeline;
  readonly questSceneExport: QuestSceneExport;
  readonly webXrPresentation: WebXrPresentation;
  readonly bloodGround: BloodGround;
  readonly tilesetAssets: TilesetAssets;
  readonly vultureProjection: VultureProjection;
  readonly wallOverlays: WallOverlays;
  readonly vultureWalls: VultureWalls;
  readonly glyphTextures: GlyphTextures;
  readonly tileMaterials: TileMaterials;
  readonly floorOcclusion: FloorOcclusion;
  readonly wallGeometry: WallGeometry;
  readonly damageFlashes: DamageFlashes;
  readonly bloodParticles: BloodParticles;
  readonly damageNumbers: DamageNumbers;
  readonly billboardShatter: BillboardShatter;
  readonly entityBillboards: EntityBillboards;
  readonly terminalRendering: TerminalRendering;
  readonly tileRendering: TileRendering;
  readonly heldWeapon: HeldWeapon;
  readonly camera: Camera;
  readonly positionSelection: PositionSelection;
  readonly inputCommands: InputCommands;
  readonly extendedCommands: ExtendedCommands;
  readonly questionMenus: QuestionMenus;
  readonly promptDialogs: PromptDialogs;
  readonly menuPreviews: MenuPreviews;
  readonly directionPrompts: DirectionPrompts;
  readonly movementInput: MovementInput;
  readonly keyboardInput: KeyboardInput;
  readonly modalNavigation: ModalNavigation;
  readonly pointerLock: PointerLock;
  readonly pointerTargeting: PointerTargeting;
  readonly tileContextActions: TileContextActions;
  readonly aimHighlights: AimHighlights;
  readonly touchInput: TouchInput;
  readonly mouseInput: MouseInput;
  readonly controllerGameplay: ControllerGameplay;
  readonly controllerDialogs: ControllerDialogs;
  readonly engineState: EngineState;
  readonly engineMessages: EngineMessages;
}

/**
 * Wire narrowly typed subsystem dependencies. Getters resolve mutually dependent
 * systems after construction; eager field dependencies are initialized first.
 * Constructors must not start runtime work or register browser callbacks.
 */
export function createEngineSystems(coordinator: EngineCoordinator): EngineSystems {
  const levelTerrainCache: LevelTerrainCache = new LevelTerrainCache({
    get bloodGround() { return bloodGround; },
    get darkCorridorInference() { return darkCorridorInference; },
    get playerStatus() { return playerStatus; },
    get tileRendering() { return tileRendering; },
    get tileUpdates() { return tileUpdates; },
    get vultureWalls() { return vultureWalls; },
    get worldClassification() { return worldClassification; },
  });
  const darkCorridorInference: DarkCorridorInference = new DarkCorridorInference({
    get directionPrompts() { return directionPrompts; },
    get engineState() { return engineState; },
    get entityBillboards() { return entityBillboards; },
    get glyphTextures() { return glyphTextures; },
    get levelTerrainCache() { return levelTerrainCache; },
    get lighting() { return lighting; },
    get minimap() { return minimap; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get playerStatus() { return playerStatus; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get renderPipeline() { return renderPipeline; },
    get terminalRendering() { return terminalRendering; },
    get tileRendering() { return tileRendering; },
    get tileUpdates() { return tileUpdates; },
    get tilesetAssets() { return tilesetAssets; },
    get vultureWalls() { return vultureWalls; },
    get wallGeometry() { return wallGeometry; },
    get wallOverlays() { return wallOverlays; },
    get worldClassification() { return worldClassification; },
  });
  const minimap: Minimap = new Minimap({
    get camera() { return camera; },
    get controllerGameplay() { return controllerGameplay; },
    get directionPrompts() { return directionPrompts; },
    get engineState() { return engineState; },
    get heldWeaponAnimationDebug() { return heldWeaponAnimationDebug; },
    get levelTerrainCache() { return levelTerrainCache; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get terminalRendering() { return terminalRendering; },
    get worldClassification() { return worldClassification; },
  });
  const tileUpdates: TileUpdates = new TileUpdates({
    get camera() { return camera; },
    get darkCorridorInference() { return darkCorridorInference; },
    get engineState() { return engineState; },
    get entityBillboards() { return entityBillboards; },
    get entityMovement() { return entityMovement; },
    get fpsDiagnostics() { return fpsDiagnostics; },
    get levelTerrainCache() { return levelTerrainCache; },
    get minimap() { return minimap; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get playerStatus() { return playerStatus; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get runtimeEntityTracking() { return runtimeEntityTracking; },
    get tileRendering() { return tileRendering; },
    get vultureWalls() { return vultureWalls; },
    get worldClassification() { return worldClassification; },
  });
  const worldClassification: WorldClassification = new WorldClassification({
    get darkCorridorInference() { return darkCorridorInference; },
    get engineState() { return engineState; },
    get entityBillboards() { return entityBillboards; },
    get levelTerrainCache() { return levelTerrainCache; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get tileRendering() { return tileRendering; },
    get tileUpdates() { return tileUpdates; },
    get tilesetAssets() { return tilesetAssets; },
  });
  const runtimeEntityTracking: RuntimeEntityTracking = new RuntimeEntityTracking({
    get entityBillboards() { return entityBillboards; },
    get entityMovement() { return entityMovement; },
    get levelTerrainCache() { return levelTerrainCache; },
    get minimap() { return minimap; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get tileUpdates() { return tileUpdates; },
    get worldClassification() { return worldClassification; },
  });
  const playerMovement: PlayerMovement = new PlayerMovement({
    get camera() { return camera; },
    get directionPrompts() { return directionPrompts; },
    get engineState() { return engineState; },
    get entityMovement() { return entityMovement; },
    get fpsDiagnostics() { return fpsDiagnostics; },
    get levelTerrainCache() { return levelTerrainCache; },
    get movementInput() { return movementInput; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get runtimeEntityTracking() { return runtimeEntityTracking; },
    get tileRendering() { return tileRendering; },
  });
  const entityMovement: EntityMovement = new EntityMovement({
    get billboardShatter() { return billboardShatter; },
    get camera() { return camera; },
    get engineState() { return engineState; },
    get entityBillboards() { return entityBillboards; },
    get glyphTextures() { return glyphTextures; },
    get levelTerrainCache() { return levelTerrainCache; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get renderPipeline() { return renderPipeline; },
    get runtimeEntityTracking() { return runtimeEntityTracking; },
    get tileRendering() { return tileRendering; },
    get tileUpdates() { return tileUpdates; },
    get tilesetAssets() { return tilesetAssets; },
    get worldClassification() { return worldClassification; },
  });
  const combatAttribution: CombatAttribution = new CombatAttribution({
    get audioHapticsPlatform() { return audioHapticsPlatform; },
    get billboardShatter() { return billboardShatter; },
    get bloodParticles() { return bloodParticles; },
    get camera() { return camera; },
    get damageFlashes() { return damageFlashes; },
    get damageNumbers() { return damageNumbers; },
    get engineState() { return engineState; },
    get entityBillboards() { return entityBillboards; },
    get entityMovement() { return entityMovement; },
    get heldWeapon() { return heldWeapon; },
    get minimap() { return minimap; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get runtimeEntityTracking() { return runtimeEntityTracking; },
    get tileRendering() { return tileRendering; },
    get worldClassification() { return worldClassification; },
  });
  const runTelemetry: RunTelemetry = new RunTelemetry({
    get gameOver() { return gameOver; },
    get heldWeapon() { return heldWeapon; },
    get playerStatus() { return playerStatus; },
    get runtimeEntityTracking() { return runtimeEntityTracking; },
  });
  const gameOver: GameOver = new GameOver({
    get combatAttribution() { return combatAttribution; },
    get directionPrompts() { return directionPrompts; },
    get engineState() { return engineState; },
    get keyboardInput() { return keyboardInput; },
    get movementInput() { return movementInput; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get runTelemetry() { return runTelemetry; },
  });
  const playerStatus: PlayerStatus = new PlayerStatus({
    get audioHapticsPlatform() { return audioHapticsPlatform; },
    get combatAttribution() { return combatAttribution; },
    get damageNumbers() { return damageNumbers; },
    get darkCorridorInference() { return darkCorridorInference; },
    get engineState() { return engineState; },
    get extendedCommands() { return extendedCommands; },
    get inputCommands() { return inputCommands; },
    get levelTerrainCache() { return levelTerrainCache; },
    get playerMovement() { return playerMovement; },
    get terminalRendering() { return terminalRendering; },
    get tileUpdates() { return tileUpdates; },
    get tilesetAssets() { return tilesetAssets; },
  });
  const audioHapticsPlatform: AudioHapticsPlatform = new AudioHapticsPlatform({
    get directionPrompts() { return directionPrompts; },
    get engineState() { return engineState; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
  });
  const fpsDiagnostics: FpsDiagnostics = new FpsDiagnostics({
    get engineState() { return engineState; },
    get pointerLock() { return pointerLock; },
    get renderPipeline() { return renderPipeline; },
  });
  const heldWeaponAnimationDebug: HeldWeaponAnimationDebug = new HeldWeaponAnimationDebug({
    get engineState() { return engineState; },
    get heldWeapon() { return heldWeapon; },
    get menuPreviews() { return menuPreviews; },
    get movementInput() { return movementInput; },
  });
  const vultureProjectionDebug: VultureProjectionDebug = new VultureProjectionDebug({
    get engineState() { return engineState; },
    get tileUpdates() { return tileUpdates; },
    get tilesetAssets() { return tilesetAssets; },
    get vultureProjection() { return vultureProjection; },
  });
  const renderPipeline: RenderPipeline = new RenderPipeline({
    get camera() { return camera; },
    get engineState() { return engineState; },
    get heldWeaponAnimationDebug() { return heldWeaponAnimationDebug; },
    get minimap() { return minimap; },
  });
  const bloodGround: BloodGround = new BloodGround({
    get audioHapticsPlatform() { return audioHapticsPlatform; },
    get engineState() { return engineState; },
    get levelTerrainCache() { return levelTerrainCache; },
    get lighting() { return lighting; },
    get renderPipeline() { return renderPipeline; },
    get terminalRendering() { return terminalRendering; },
    get tilesetAssets() { return tilesetAssets; },
  });
  const tilesetAssets: TilesetAssets = new TilesetAssets({
    get engineState() { return engineState; },
    get entityBillboards() { return entityBillboards; },
    get glyphTextures() { return glyphTextures; },
    get heldWeapon() { return heldWeapon; },
    get menuPreviews() { return menuPreviews; },
    get playerStatus() { return playerStatus; },
    get promptDialogs() { return promptDialogs; },
    get renderPipeline() { return renderPipeline; },
    get tileUpdates() { return tileUpdates; },
    get vultureProjection() { return vultureProjection; },
    get vultureProjectionDebug() { return vultureProjectionDebug; },
    get vultureWalls() { return vultureWalls; },
    get wallGeometry() { return wallGeometry; },
    get wallOverlays() { return wallOverlays; },
  });
  const vultureProjection: VultureProjection = new VultureProjection({
    get engineState() { return engineState; },
    get tileUpdates() { return tileUpdates; },
    get tilesetAssets() { return tilesetAssets; },
  });
  const wallOverlays: WallOverlays = new WallOverlays({
    get engineState() { return engineState; },
    get glyphTextures() { return glyphTextures; },
    get lighting() { return lighting; },
    get movementInput() { return movementInput; },
    get tileRendering() { return tileRendering; },
    get tilesetAssets() { return tilesetAssets; },
    get vultureProjection() { return vultureProjection; },
  });
  const vultureWalls: VultureWalls = new VultureWalls({
    get camera() { return camera; },
    get darkCorridorInference() { return darkCorridorInference; },
    get engineState() { return engineState; },
    get entityBillboards() { return entityBillboards; },
    get levelTerrainCache() { return levelTerrainCache; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get tileMaterials() { return tileMaterials; },
    get tileRendering() { return tileRendering; },
    get tilesetAssets() { return tilesetAssets; },
    get wallOverlays() { return wallOverlays; },
  });
  const glyphTextures: GlyphTextures = new GlyphTextures({
    get engineState() { return engineState; },
    get lighting() { return lighting; },
    get tilesetAssets() { return tilesetAssets; },
    get vultureProjection() { return vultureProjection; },
    get vultureProjectionDebug() { return vultureProjectionDebug; },
  });
  const tileMaterials: TileMaterials = new TileMaterials({
    get camera() { return camera; },
    get damageFlashes() { return damageFlashes; },
    get engineState() { return engineState; },
    get glyphTextures() { return glyphTextures; },
    get lighting() { return lighting; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get tileRendering() { return tileRendering; },
    get tilesetAssets() { return tilesetAssets; },
    get vultureWalls() { return vultureWalls; },
    get wallGeometry() { return wallGeometry; },
    get wallOverlays() { return wallOverlays; },
    get worldClassification() { return worldClassification; },
  });
  const floorOcclusion: FloorOcclusion = new FloorOcclusion({
    get engineState() { return engineState; },
    get lighting() { return lighting; },
    get movementInput() { return movementInput; },
    get renderPipeline() { return renderPipeline; },
    get tileRendering() { return tileRendering; },
    get wallGeometry() { return wallGeometry; },
  });
  const wallGeometry: WallGeometry = new WallGeometry({
    get darkCorridorInference() { return darkCorridorInference; },
    get engineState() { return engineState; },
    get floorOcclusion() { return floorOcclusion; },
    get glyphTextures() { return glyphTextures; },
    get lighting() { return lighting; },
    get movementInput() { return movementInput; },
    get renderPipeline() { return renderPipeline; },
    get tileMaterials() { return tileMaterials; },
    get tileRendering() { return tileRendering; },
    get tilesetAssets() { return tilesetAssets; },
    get vultureWalls() { return vultureWalls; },
    get wallOverlays() { return wallOverlays; },
    get worldClassification() { return worldClassification; },
  });
  const damageFlashes: DamageFlashes = new DamageFlashes({
    get engineState() { return engineState; },
    get entityBillboards() { return entityBillboards; },
    get glyphTextures() { return glyphTextures; },
    get tileRendering() { return tileRendering; },
    get tilesetAssets() { return tilesetAssets; },
  });
  const damageNumbers: DamageNumbers = new DamageNumbers({
    get bloodGround() { return bloodGround; },
    get bloodParticles() { return bloodParticles; },
    get camera() { return camera; },
    get combatAttribution() { return combatAttribution; },
    get damageFlashes() { return damageFlashes; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get renderPipeline() { return renderPipeline; },
    get tileRendering() { return tileRendering; },
    get tilesetAssets() { return tilesetAssets; },
  });
  const billboardShatter: BillboardShatter = new BillboardShatter({
    get bloodParticles() { return bloodParticles; },
    get camera() { return camera; },
    get engineState() { return engineState; },
    get entityBillboards() { return entityBillboards; },
    get lighting() { return lighting; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get renderPipeline() { return renderPipeline; },
    get runtimeEntityTracking() { return runtimeEntityTracking; },
    get tilesetAssets() { return tilesetAssets; },
  });
  const entityBillboards: EntityBillboards = new EntityBillboards({
    get billboardShatter() { return billboardShatter; },
    get camera() { return camera; },
    get damageFlashes() { return damageFlashes; },
    get engineState() { return engineState; },
    get glyphTextures() { return glyphTextures; },
    get lighting() { return lighting; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get positionSelection() { return positionSelection; },
    get renderPipeline() { return renderPipeline; },
    get terminalRendering() { return terminalRendering; },
    get tilesetAssets() { return tilesetAssets; },
    get vultureProjection() { return vultureProjection; },
    get worldClassification() { return worldClassification; },
  });
  const terminalRendering: TerminalRendering = new TerminalRendering({
    get bloodGround() { return bloodGround; },
    get camera() { return camera; },
    coordinator,
    get darkCorridorInference() { return darkCorridorInference; },
    get engineState() { return engineState; },
    get entityBillboards() { return entityBillboards; },
    get floorOcclusion() { return floorOcclusion; },
    get glyphTextures() { return glyphTextures; },
    get levelTerrainCache() { return levelTerrainCache; },
    get lighting() { return lighting; },
    get minimap() { return minimap; },
    get positionSelection() { return positionSelection; },
    get renderPipeline() { return renderPipeline; },
    get runtimeEntityTracking() { return runtimeEntityTracking; },
    get tileRendering() { return tileRendering; },
    get tileUpdates() { return tileUpdates; },
    get wallGeometry() { return wallGeometry; },
    get wallOverlays() { return wallOverlays; },
    get worldClassification() { return worldClassification; },
  });
  const tileRendering: TileRendering = new TileRendering({
    get darkCorridorInference() { return darkCorridorInference; },
    get engineState() { return engineState; },
    get entityBillboards() { return entityBillboards; },
    get floorOcclusion() { return floorOcclusion; },
    get fpsDiagnostics() { return fpsDiagnostics; },
    get glyphTextures() { return glyphTextures; },
    get levelTerrainCache() { return levelTerrainCache; },
    get lighting() { return lighting; },
    get minimap() { return minimap; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get renderPipeline() { return renderPipeline; },
    get runtimeEntityTracking() { return runtimeEntityTracking; },
    get terminalRendering() { return terminalRendering; },
    get tileMaterials() { return tileMaterials; },
    get tileUpdates() { return tileUpdates; },
    get tilesetAssets() { return tilesetAssets; },
    get vultureWalls() { return vultureWalls; },
    get wallGeometry() { return wallGeometry; },
    get wallOverlays() { return wallOverlays; },
    get worldClassification() { return worldClassification; },
  });
  const heldWeapon: HeldWeapon = new HeldWeapon({
    get audioHapticsPlatform() { return audioHapticsPlatform; },
    get billboardShatter() { return billboardShatter; },
    get camera() { return camera; },
    get combatAttribution() { return combatAttribution; },
    get damageNumbers() { return damageNumbers; },
    get engineState() { return engineState; },
    get glyphTextures() { return glyphTextures; },
    get heldWeaponAnimationDebug() { return heldWeaponAnimationDebug; },
    get menuPreviews() { return menuPreviews; },
    get movementInput() { return movementInput; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get renderPipeline() { return renderPipeline; },
    get tilesetAssets() { return tilesetAssets; },
  });
  const camera: Camera = new Camera({
    get bloodParticles() { return bloodParticles; },
    get damageNumbers() { return damageNumbers; },
    get directionPrompts() { return directionPrompts; },
    get engineState() { return engineState; },
    get heldWeapon() { return heldWeapon; },
    get minimap() { return minimap; },
    get mouseInput() { return mouseInput; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get renderPipeline() { return renderPipeline; },
    get terminalRendering() { return terminalRendering; },
    get tileRendering() { return tileRendering; },
    get tileUpdates() { return tileUpdates; },
    get tilesetAssets() { return tilesetAssets; },
  });
  const positionSelection: PositionSelection = new PositionSelection({
    get camera() { return camera; },
    get engineMessages() { return engineMessages; },
    get engineState() { return engineState; },
    get entityBillboards() { return entityBillboards; },
    get inputCommands() { return inputCommands; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get pointerLock() { return pointerLock; },
    get pointerTargeting() { return pointerTargeting; },
    get promptDialogs() { return promptDialogs; },
    get renderPipeline() { return renderPipeline; },
    get tileContextActions() { return tileContextActions; },
    get tileRendering() { return tileRendering; },
    get tileUpdates() { return tileUpdates; },
    get tilesetAssets() { return tilesetAssets; },
  });
  const inputCommands: InputCommands = new InputCommands({
    get audioHapticsPlatform() { return audioHapticsPlatform; },
    get camera() { return camera; },
    get combatAttribution() { return combatAttribution; },
    get controllerGameplay() { return controllerGameplay; },
    get darkCorridorInference() { return darkCorridorInference; },
    get directionPrompts() { return directionPrompts; },
    get engineMessages() { return engineMessages; },
    get engineState() { return engineState; },
    get extendedCommands() { return extendedCommands; },
    get gameOver() { return gameOver; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get runTelemetry() { return runTelemetry; },
    get tileContextActions() { return tileContextActions; },
    get tileUpdates() { return tileUpdates; },
    get tilesetAssets() { return tilesetAssets; },
  });
  const extendedCommands: ExtendedCommands = new ExtendedCommands({
    get camera() { return camera; },
    get directionPrompts() { return directionPrompts; },
    get inputCommands() { return inputCommands; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get renderPipeline() { return renderPipeline; },
  });
  const questionMenus: QuestionMenus = new QuestionMenus({
    get audioHapticsPlatform() { return audioHapticsPlatform; },
    get directionPrompts() { return directionPrompts; },
    get engineState() { return engineState; },
    get gameOver() { return gameOver; },
    get inputCommands() { return inputCommands; },
    get menuPreviews() { return menuPreviews; },
    get pointerLock() { return pointerLock; },
    get runTelemetry() { return runTelemetry; },
    get tileUpdates() { return tileUpdates; },
    get tilesetAssets() { return tilesetAssets; },
    get worldClassification() { return worldClassification; },
  });
  const promptDialogs: PromptDialogs = new PromptDialogs({
    get directionPrompts() { return directionPrompts; },
    get engineMessages() { return engineMessages; },
    get engineState() { return engineState; },
    get extendedCommands() { return extendedCommands; },
    get gameOver() { return gameOver; },
    get inputCommands() { return inputCommands; },
    get menuPreviews() { return menuPreviews; },
    get minimap() { return minimap; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get pointerLock() { return pointerLock; },
    get positionSelection() { return positionSelection; },
    get questionMenus() { return questionMenus; },
    get tileContextActions() { return tileContextActions; },
    get tileUpdates() { return tileUpdates; },
    get tilesetAssets() { return tilesetAssets; },
  });
  const menuPreviews: MenuPreviews = new MenuPreviews({
    get engineState() { return engineState; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get tilesetAssets() { return tilesetAssets; },
  });
  const directionPrompts: DirectionPrompts = new DirectionPrompts({
    get audioHapticsPlatform() { return audioHapticsPlatform; },
    get camera() { return camera; },
    get controllerGameplay() { return controllerGameplay; },
    get engineState() { return engineState; },
    get extendedCommands() { return extendedCommands; },
    get inputCommands() { return inputCommands; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get pointerLock() { return pointerLock; },
    get pointerTargeting() { return pointerTargeting; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get renderPipeline() { return renderPipeline; },
    get terminalRendering() { return terminalRendering; },
    get tileContextActions() { return tileContextActions; },
    get touchInput() { return touchInput; },
  });
  const movementInput: MovementInput = new MovementInput({
    get aimHighlights() { return aimHighlights; },
    get audioHapticsPlatform() { return audioHapticsPlatform; },
    get camera() { return camera; },
    get engineState() { return engineState; },
    get inputCommands() { return inputCommands; },
    get playerMovement() { return playerMovement; },
    get terminalRendering() { return terminalRendering; },
    get tileRendering() { return tileRendering; },
  });
  const keyboardInput: KeyboardInput = new KeyboardInput({
    get audioHapticsPlatform() { return audioHapticsPlatform; },
    get camera() { return camera; },
    get controllerDialogs() { return controllerDialogs; },
    get controllerGameplay() { return controllerGameplay; },
    get directionPrompts() { return directionPrompts; },
    get engineMessages() { return engineMessages; },
    get engineState() { return engineState; },
    get extendedCommands() { return extendedCommands; },
    get fpsDiagnostics() { return fpsDiagnostics; },
    get gameOver() { return gameOver; },
    get heldWeaponAnimationDebug() { return heldWeaponAnimationDebug; },
    get inputCommands() { return inputCommands; },
    get minimap() { return minimap; },
    get modalNavigation() { return modalNavigation; },
    get mouseInput() { return mouseInput; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get pointerLock() { return pointerLock; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get renderPipeline() { return renderPipeline; },
    get runTelemetry() { return runTelemetry; },
    get tileContextActions() { return tileContextActions; },
    get touchInput() { return touchInput; },
  });
  const modalNavigation: ModalNavigation = new ModalNavigation({
    get controllerDialogs() { return controllerDialogs; },
    get directionPrompts() { return directionPrompts; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
  });
  const pointerLock: PointerLock = new PointerLock({
    get directionPrompts() { return directionPrompts; },
    get extendedCommands() { return extendedCommands; },
    get fpsDiagnostics() { return fpsDiagnostics; },
    get movementInput() { return movementInput; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get renderPipeline() { return renderPipeline; },
    get tileContextActions() { return tileContextActions; },
  });
  const pointerTargeting: PointerTargeting = new PointerTargeting({
    get camera() { return camera; },
    get engineState() { return engineState; },
    get entityBillboards() { return entityBillboards; },
    get playerMovement() { return playerMovement; },
    get renderPipeline() { return renderPipeline; },
    get terminalRendering() { return terminalRendering; },
    get tileContextActions() { return tileContextActions; },
    get tileRendering() { return tileRendering; },
    get tilesetAssets() { return tilesetAssets; },
  });
  const tileContextActions: TileContextActions = new TileContextActions({
    get aimHighlights() { return aimHighlights; },
    get camera() { return camera; },
    get controllerGameplay() { return controllerGameplay; },
    get darkCorridorInference() { return darkCorridorInference; },
    get directionPrompts() { return directionPrompts; },
    get engineMessages() { return engineMessages; },
    get engineState() { return engineState; },
    get entityBillboards() { return entityBillboards; },
    get extendedCommands() { return extendedCommands; },
    get inputCommands() { return inputCommands; },
    get levelTerrainCache() { return levelTerrainCache; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get pointerLock() { return pointerLock; },
    get pointerTargeting() { return pointerTargeting; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get renderPipeline() { return renderPipeline; },
    get terminalRendering() { return terminalRendering; },
    get tileRendering() { return tileRendering; },
    get tileUpdates() { return tileUpdates; },
    get tilesetAssets() { return tilesetAssets; },
    get worldClassification() { return worldClassification; },
  });
  const aimHighlights: AimHighlights = new AimHighlights({
    get camera() { return camera; },
    get directionPrompts() { return directionPrompts; },
    get entityBillboards() { return entityBillboards; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get renderPipeline() { return renderPipeline; },
    get tileRendering() { return tileRendering; },
    get tilesetAssets() { return tilesetAssets; },
    get wallOverlays() { return wallOverlays; },
  });
  const touchInput: TouchInput = new TouchInput({
    get audioHapticsPlatform() { return audioHapticsPlatform; },
    get camera() { return camera; },
    get combatAttribution() { return combatAttribution; },
    get directionPrompts() { return directionPrompts; },
    get engineMessages() { return engineMessages; },
    get engineState() { return engineState; },
    get extendedCommands() { return extendedCommands; },
    get gameOver() { return gameOver; },
    get inputCommands() { return inputCommands; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get pointerTargeting() { return pointerTargeting; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get renderPipeline() { return renderPipeline; },
    get terminalRendering() { return terminalRendering; },
    get tileContextActions() { return tileContextActions; },
    get tileRendering() { return tileRendering; },
  });
  const mouseInput: MouseInput = new MouseInput({
    get audioHapticsPlatform() { return audioHapticsPlatform; },
    get camera() { return camera; },
    get combatAttribution() { return combatAttribution; },
    get directionPrompts() { return directionPrompts; },
    get engineMessages() { return engineMessages; },
    get engineState() { return engineState; },
    get extendedCommands() { return extendedCommands; },
    get gameOver() { return gameOver; },
    get inputCommands() { return inputCommands; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get pointerLock() { return pointerLock; },
    get pointerTargeting() { return pointerTargeting; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get renderPipeline() { return renderPipeline; },
    get terminalRendering() { return terminalRendering; },
    get tileContextActions() { return tileContextActions; },
    get tileRendering() { return tileRendering; },
  });
  const controllerGameplay: ControllerGameplay = new ControllerGameplay({
    get audioHapticsPlatform() { return audioHapticsPlatform; },
    get camera() { return camera; },
    get combatAttribution() { return combatAttribution; },
    get controllerDialogs() { return controllerDialogs; },
    get directionPrompts() { return directionPrompts; },
    get engineMessages() { return engineMessages; },
    get engineState() { return engineState; },
    get extendedCommands() { return extendedCommands; },
    get inputCommands() { return inputCommands; },
    get minimap() { return minimap; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get terminalRendering() { return terminalRendering; },
    get tileContextActions() { return tileContextActions; },
    get tileRendering() { return tileRendering; },
  });
  const controllerDialogs: ControllerDialogs = new ControllerDialogs({
    get controllerGameplay() { return controllerGameplay; },
    get directionPrompts() { return directionPrompts; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get tileContextActions() { return tileContextActions; },
  });
  const engineState: EngineState = new EngineState({
    coordinator,
  });
  const engineMessages: EngineMessages = new EngineMessages({
    get audioHapticsPlatform() { return audioHapticsPlatform; },
    get combatAttribution() { return combatAttribution; },
    get directionPrompts() { return directionPrompts; },
    get engineState() { return engineState; },
    get entityBillboards() { return entityBillboards; },
    get extendedCommands() { return extendedCommands; },
    get levelTerrainCache() { return levelTerrainCache; },
    get positionSelection() { return positionSelection; },
    get promptDialogs() { return promptDialogs; },
    get questionMenus() { return questionMenus; },
    get tileRendering() { return tileRendering; },
    get tileUpdates() { return tileUpdates; },
    get worldClassification() { return worldClassification; },
  });
  const lighting: Lighting = new Lighting({
    get bloodGround() { return bloodGround; },
    get camera() { return camera; },
    get engineState() { return engineState; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get renderPipeline() { return renderPipeline; },
  });
  const bloodParticles: BloodParticles = new BloodParticles({
    get bloodGround() { return bloodGround; },
    get engineState() { return engineState; },
    get movementInput() { return movementInput; },
    get playerMovement() { return playerMovement; },
    get renderPipeline() { return renderPipeline; },
    get tileRendering() { return tileRendering; },
  });
  const webXrPresentation = new WebXrPresentation({
    get camera() { return camera; },
    get engineState() { return engineState; },
    get playerMovement() { return playerMovement; },
    get renderPipeline() { return renderPipeline; },
    get heldWeapon() { return heldWeapon; },
  });
  const questSceneExport = new QuestSceneExport({
    coordinator,
    get camera() { return camera; },
    get engineState() { return engineState; },
    get lighting() { return lighting; },
    get playerMovement() { return playerMovement; },
    get renderPipeline() { return renderPipeline; },
    get terminalRendering() { return terminalRendering; },
  });
  return {
    questSceneExport,
    webXrPresentation,
    levelTerrainCache,
    darkCorridorInference,
    minimap,
    tileUpdates,
    worldClassification,
    runtimeEntityTracking,
    playerMovement,
    entityMovement,
    combatAttribution,
    runTelemetry,
    gameOver,
    playerStatus,
    audioHapticsPlatform,
    fpsDiagnostics,
    heldWeaponAnimationDebug,
    vultureProjectionDebug,
    lighting,
    renderPipeline,
    bloodGround,
    tilesetAssets,
    vultureProjection,
    wallOverlays,
    vultureWalls,
    glyphTextures,
    tileMaterials,
    floorOcclusion,
    wallGeometry,
    damageFlashes,
    bloodParticles,
    damageNumbers,
    billboardShatter,
    entityBillboards,
    terminalRendering,
    tileRendering,
    heldWeapon,
    camera,
    positionSelection,
    inputCommands,
    extendedCommands,
    questionMenus,
    promptDialogs,
    menuPreviews,
    directionPrompts,
    movementInput,
    keyboardInput,
    modalNavigation,
    pointerLock,
    pointerTargeting,
    tileContextActions,
    aimHighlights,
    touchInput,
    mouseInput,
    controllerGameplay,
    controllerDialogs,
    engineState,
    engineMessages
  };
}
