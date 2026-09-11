# Agent Steering

Start here before making changes.

## Project Summary

- NetHack 3D is a browser-first TypeScript and React app.
- `src/game/Nethack3DEngine.ts` is the main orchestration layer for rendering, input, camera control, and runtime events.
- `src/game/engine/` contains the engine subsystems. Each class owns its state and declares the exact members it needs from other subsystems through typed dependency contracts.
- `src/runtime/runtime-worker.ts` hosts the NetHack runtime inside a Web Worker.
- `src/runtime/LocalNetHackRuntime.ts` adapts NetHack callbacks, input waits, and status or map events.
- `src/runtime/WorkerRuntimeBridge.ts` is the main-thread transport to the worker.
- `src/ui/App.tsx` is the React entry point; `src/ui/app/` contains feature hooks, components and helpers for startup, dialogs, input, scores and client options.

## Core Paths

- App bootstrap: `src/main.tsx`.
- Debug helpers: `src/app.ts`.
- Main engine: `src/game/Nethack3DEngine.ts`.
- Engine implementation by responsibility: `src/game/engine/` (camera, input, UI, rendering, world state, effects, and diagnostics).
- Engine assembly: `src/game/engine/create-engine-systems.ts`; root-operation contract: `src/game/engine/engine-coordinator.ts`.
- Engine barrel: `src/game/index.ts`.
- Runtime barrel: `src/runtime/index.ts`.
- Runtime worker entry: `src/runtime/runtime-worker.ts`.
- Runtime callback adapter: `src/runtime/LocalNetHackRuntime.ts`.
- Worker bridge: `src/runtime/WorkerRuntimeBridge.ts`.
- Runtime command and event types: `src/runtime/types.ts`.
- Client state store: `src/state/gameStore.ts`.
- UI-to-store adapter: `src/state/engineUiAdapter.ts`.

## User Options And Persistence

- Client option schema/defaults/normalization: `src/game/ui-types.ts`.
- Controller binding schema/defaults/normalization: `src/game/controller-bindings.ts`.
- Client options UI and draft/apply flow: `src/ui/app/settings/`; option descriptors and tabs: `settings/config.ts`.
- Client options and startup preference persistence: `src/storage/client-options-storage.ts`.
- Startup init option schema and serialization: `src/runtime/startup-init-options.ts`.
- Engine-side option application: `src/game/Nethack3DEngine.ts`.

## Steering Docs

- [Engine architecture and task-to-owner hotspots](../../src/game/engine/README.md)
- [React UI architecture and task-to-owner hotspots](../../src/ui/README.md)
- [Project structure](project-structure.md)
- [Change playbook](logic-hotspots.md)
- [Movement and input flow](movement-flow.md)
- [World/runtime event flows](../../docs/engine-world-runtime.md)

## Steering Docs Are Living Docs

- Treat `.agents/rules/AGENTS.md`, `.agents/rules/project-structure.md`, `.agents/rules/logic-hotspots.md`, and `.agents/rules/movement-flow.md` as living documentation.
- If you change architecture, runtime flows, event contracts, file ownership, or hot paths, update the matching docs in the same task whenever practical.
- Prefer small, accurate doc edits over leaving stale guidance behind.

## Working Rules For Agents

- Treat `src/game/*`, `src/runtime/*`, `src/state/*`, `src/storage/*`, `src/update/*`, and `src/ui/*` as source of truth.
- Do not edit generated runtime bundles or other build outputs directly. The checked-in runtime assets in `public/` and the generated files under `src/game/glyphs/*.generated.ts` are inputs to the app, not hand-authored source.
- Treat generated glyph catalogs as fallback/reference data, not authoritative truth for all tile resolution cases; prefer live NetHack/WASM data paths and callbacks whenever possible.
- Prefer adding new gameplay/runtime features in focused files by function rather than growing `src/game/Nethack3DEngine.ts` further.
- Keep `src/game/Nethack3DEngine.ts` focused on ordered orchestration and public delegation; wire subsystem dependencies in `src/game/engine/create-engine-systems.ts`.
- Extend the subsystem that owns the behavior and state. Keep startup, runtime event ordering, frame sequencing, and coordinated disposal in the engine; preserve the public `Nethack3DEngineController` API when moving implementation.
- Dependency contracts should expose only the members a subsystem uses. Avoid passing the entire engine into a subsystem or adding untyped access to its internals.
- Use type-only peer imports. Dependency getters do not remove initialization requirements: eager initializer dependencies must be constructed before their consumers. Start browser/runtime work only after assembly and option assignment.
- Use React components when it reduces duplication and keeps the UI and CSS maintainable.
  - If refactoring to make code DRY is needed, suggest it to the user, or do it if it is clearly within the task scope.
  - Store components in logical subfolders instead of dumping everything into one UI folder.
  - Renaming or regrouping a component folder to keep things organized is fine when it improves clarity.
- Keep React feature behavior in `src/ui/app/` and the app composition focused on wiring exact typed dependencies. Preserve unconditional hook order, effect registration order, callback dependencies, DOM ids/classes and animated-dialog mounting when extracting UI code. Separate hook sites may be intentional because other feature effects run between them.
- If adding or changing runtime event payloads, update both:
  - emit sites in `src/runtime/LocalNetHackRuntime.ts`
  - event handling in `src/game/Nethack3DEngine.ts`
- Keep async menu and input behavior stable in runtime state handling, especially:
  - `activeInputRequest`
  - `awaitingQuestionInput`
  - `pendingMenuSelection`
  - `menuSelectionReadyCount`
  - `farLookMode`
- Engine prompt state has separate owners: `positionInputModeActive` in `src/game/engine/input/position-selection.ts`, question selections in `src/game/engine/ui/question-menus.ts`, and direction state in `src/game/engine/ui/direction-prompts.ts`. Preserve their synchronous transitions with runtime events.
- Validate rendering-impacting changes by checking:
  - player position updates
  - tile refresh commands
  - question dialogs, including direction and inventory flows
- Coding conventions:
  - Avoid timeouts unless there is no better alternative, because they tend to create bugs, race conditions, and brittle behavior.

## NetHack Reference

- The WSL-hosted NetHack code is the source of truth for game behavior, data files, and shim expectations:
  - Forked NetHack WASM monorepo reference: `\\wsl.localhost\Ubuntu\home\james\Repos\forked\neth4ck-monorepo`.
  - Forked 3.6.7 WASM package path: `\\wsl.localhost\Ubuntu\home\james\Repos\forked\neth4ck-monorepo\packages\wasm-367`.
  - Forked NetHack 3.6.7 source inside that package: `\\wsl.localhost\Ubuntu\home\james\Repos\forked\neth4ck-monorepo\packages\wasm-367\NetHack`.
  - Forked 3.7 WASM package path: `\\wsl.localhost\Ubuntu\home\james\Repos\forked\neth4ck-monorepo\packages\wasm-37`.
  - Forked NetHack 3.7 source inside that package: `\\wsl.localhost\Ubuntu\home\james\Repos\forked\neth4ck-monorepo\packages\wasm-37\NetHack`.
  - Forked SLASH-EM (NetHack 3.4.3-based variant) WASM build and source code: `\\wsl.localhost\Ubuntu\home\james\Repos\slashem-wasm`.
- Never modify the imported NetHack source unless the user explicitly asks for it.
- Prefer not patching WASM shims, as changes there are expensive. Adjust our runtime integration instead when possible. If shim changes are unavoidable, call that out clearly before doing it and confirm with the user first.

## Vulture Reference

- Vulture source code lives in `third_party/vulture`.
- Do not modify Vulture source code.
- If a Vulture asset or reference file is needed at runtime, place it under `imported/vulture` or the app asset tree instead of editing the vendor copy.
- The port is still in progress from 3.60 to 3.6.7, so be careful when reading old assumptions in Vulture code or docs.

## Current WASM Shim Caveats

- `shim_getmsghistory` and `shim_get_color_string` are declared as string-return callbacks. The current marshalling path is not a reliable `char *` return pathway, so keep returning empty strings for now.
- `set_shim_font_name` uses return type `"2"` in shim metadata, but the current helper marshalling does not implement that return type explicitly. Treat it as unsupported or no-op and return `0`.
- `shim_askname` in 3.6.7 is declared as `void`. The JS return value is not authoritative, so the runtime should write the chosen name into runtime globals and treat the return value as advisory only.

## Validation

- Do not run the build.
- The user will run build and package validation.
- A safe post-task check is `npm run check:tsc` to catch TS and TSX regressions without formatting noise.
- Run focused regression tests with `npm test -- <test-file>` as appropriate; input, world-state and rendering-resource tests live alongside the engine subsystems. Use browser checks for rendering and device interaction changes.
