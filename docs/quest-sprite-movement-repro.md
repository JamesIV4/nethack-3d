# Quest standing-loot movement reproduction

Captured from the connected release APK on 2026-09-22 using `NH3DSprites`.
Local raw captures are under `quest/build/diagnostics/vr-sprite-trace-*.log`.

## Observed sequence

- Sequence 824: destination `(5,14)` receives player glyph 338 while the client player is still `(4,14)`. Flattening is off and cached loot glyph 2194 exists, but the renderer chooses no billboard and puts glyph 2194 on the floor.
- Sequence 825: the existing loot billboard is detached.
- Sequence 827: 38 ms later, `player_position` arrives for `(5,14)`.
- Sequence 830: the same cached loot becomes a standing billboard again, with ordinary floor glyph 2380 underneath.
- The same sequence repeats for `(5,15)`, `(5,16)`, and `(4,16)`, with position updates arriving 50, 71, and 73 ms after the corresponding destination-glyph updates.

## Fix and validation

Preserve cached standing loot during an explicit player-glyph update for a predicted or animated-step destination. Apply the same rule to unchanged tile signatures so repeated payloads cannot remove the billboard. Regression tests cover player-ID and glyph-only payloads, both movement paths, arrival, and authoritative loot removal. Inferred-wall and doorway preservation tests also pass.

Only the actual player tile receives the separate hotbar foreground layer; this fix does not give neighboring/predicted tiles that priority. Release tracing remains enabled pending another headset reproduction with the rebuilt APK. Source tests do not confirm that rebuilt headset result.
