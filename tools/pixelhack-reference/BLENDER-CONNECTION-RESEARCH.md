# Astra to Blender: connection research

Researched 2026-09-24. This recommendation is based on current official OpenAI
documentation, upstream integration code, and this repository's existing
reference/export/render tools. It is not an end-to-end token benchmark.

## Recommendation

Use Astra's existing filesystem and shell tools to author reusable Blender
Python (`bpy`) scripts, execute them with Blender's `--background --python`
interface, and inspect saved comparison renders. This has the smallest
additional tool surface in our current environment and keeps model generation
reproducible. Add a small local MCP connection when retaining an interactive
Blender scene becomes useful.

OpenAI's [Astra architectural visualization case study](https://developers.openai.com/blog/architectural-visualization-with-astra)
describes this approach: editable geometry through `bpy`, scripts run through
Blender's background executable, and repeated inspection of saved renders.
It demonstrates the approach's capabilities, but does not provide comparative
token measurements or establish which method makes the best organic creatures.

## Connection comparison

| Method | Expected token efficiency | Main benefit | Main cost |
| --- | --- | --- | --- |
| Python files + Blender CLI + image inspection | Best default here | Reusable scripts, compact invocations, repeatable artifacts | Process startup and scene loading on each run |
| Small persistent MCP bridge executing Python | Competitive with CLI when carefully scoped | Keeps a live scene available for edits and inspection | Additional tool definitions and server maintenance |
| Full general-purpose Blender MCP installation | Depends on exposed tools and responses | Ready-made inspection, code execution, export, and asset integrations | Unneeded capabilities and verbose responses can consume context |
| Mouse/keyboard control of Blender | Expected to require more interactions | Reaches UI-only operations and helps inspect application state | Repeated screenshots, navigation, and recovery |

Both scripted routes use Blender's Python API. Model quality depends on the
geometry/material code and the visual correction loop. Keeping Blender running
primarily reduces startup latency; reusable code, concise responses, and fewer
unnecessary observations reduce tokens. STDIO versus HTTP is a transport choice
and has no inherent token advantage when the model-visible payload is the same.

## If we use MCP

[ahujasid/mcp-for-blender](https://github.com/ahujasid/mcp-for-blender) is the
general-purpose baseline for comparison. Its README includes Codex
configuration and its tools support Python execution, viewport images,
scene/object inspection, API lookup, and export.

I inspected [server.py at commit 35de9ba](https://github.com/ahujasid/mcp-for-blender/blob/35de9ba202a5dc212b139820eef9f9d999a2edb2/src/blender_mcp/server.py).
It declares 32 MCP tools with 24,144 characters of tool docstrings. This is a
source-code measurement, not a token count or a claim that every description
is loaded on every turn. Many tools integrate external asset services that
the PixelHack modeling loop does not require.

Start with these tools enabled: `get_addon_status`, `get_scene_info`,
`get_object_info`, `execute_blender_code`, `get_viewport_screenshot`,
`describe_node_type`, `bpy_api_lookup`, and `export_scene`. Codex supports
an [`enabled_tools` allow list](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
Use local STDIO for this Windows workstation. Pin a tested server/add-on version
once its Blender 5.1 behavior is verified.

[blender-remote](https://github.com/igamenovoer/blender-remote) is an alternative
with Python/CLI/MCP access and a documented persistent background mode. Its
design is relevant if process startup becomes a bottleneck; its documentation
alone does not establish better output quality or lower token use.

## Custom MCP versus the standard bridge

[mohakmalviya/blender-astra-mcp](https://github.com/mohakmalviya/blender-astra-mcp)
is a relevant third-party custom implementation, independent of OpenAI. Its
four tools cover inspection, operation discovery, batched execution, and
image capture. The current README describes a Python operation for full API
access and says the newer capabilities are not fully validated. I confirmed
the four advertised functions by inspecting
[server.py at commit 164f2d5](https://github.com/mohakmalviya/blender-astra-mcp/blob/164f2d5b1a9daeff7c94fe737d71e77293b2f1bf/src/compact_mcp/server.py).

The author's [validation report](https://github.com/mohakmalviya/blender-astra-mcp/blob/main/docs/validation.md)
reports 1,949 argument/result tokens for 50 separate transforms versus 1,018
for one batch, a 47.77% reduction. It uses `cl100k_base` and invokes no model.
It excludes reasoning, images, history, discovery, caching, and tool-call
envelopes. It is an internal batching comparison, not a comparison with the
standard bridge or a measurement of Astra's total cost or model quality.

The standard bridge can already batch arbitrary `bpy` work through
`execute_blender_code`. A custom bridge's useful advantages would therefore be
predictable small responses, project-specific review/export helpers, compact
tool definitions, and reliable state management. A standard bridge restricted
to relevant tools can capture much of the same benefit. More tools in a fork
do not establish better token efficiency or better artwork; for example,
[harveyxiacn/blender-mcp](https://github.com/harveyxiacn/blender-mcp) documents
profiles ranging from 29 to hundreds of tools, with additional groups loaded
on demand.

For our own bridge, the proposed interface would be:

- `run_model_script(path, parameters)`: execute a saved script and return a
  bounded result, preserving Blender Python access for unusual geometry;
- `inspect_model(names, fields)`: inspect only the relevant objects;
- `render_review(tile_id, views)`: use the existing tile and camera conventions
  to produce images for visual review;
- `export_model(path, format)`: export with the agreed asset contract;
- `job_status(id)`: observe long renders without resubmitting the mutation.

This would be a thin adapter over the same reusable Python helpers used by the
CLI. It is a proposed design, not an installed implementation. Start with the
CLI version; adopt the persistent adapter if live iteration or process startup
cost justifies maintaining it.

## PixelHack execution loop

1. Load the chosen subject brief and relevant variant notes, plus its exact
   tile crop on the original, light, and dark backgrounds.
2. Write a model script using reusable local helpers for palettes, materials,
   common creature forms, the review cameras, and export. Patch that script
   during revisions rather than repeatedly emitting complete replacements.
3. Execute a meaningful modeling stage in one call. Keep loops over limbs,
   mesh elements, and material variants inside Python.
4. Return a short structured result: success/failure, changed objects, bounds,
   triangle/material counts, and output paths. Keep detailed logs on disk.
5. Inspect a compact sheet of the tile and matching model view. Add side and
   three-quarter views at geometry checkpoints. Use a close crop for fine
   features such as the ant's antennae whenever the overview is insufficient.
6. Save the editable `.blend`, source script, and final exported asset.

The existing tile exporter and `pixelhack-blender-review.py` provide starting
pieces for this loop. Production work still needs agreed scale/orientation,
model budgets, and an in-game appearance check.

OpenAI recommends [small tool namespaces and deferred loading](https://developers.openai.com/api/docs/guides/tools-tool-search),
and documents [programmatic filtering of intermediate tool results](https://developers.openai.com/api/docs/guides/tools-programmatic-tool-calling).
Its [Astra prompting guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)
also favors concise, relevant instructions and loading supporting material only
when needed. These support the proposed design, but do not imply a particular
percentage saving in this Codex session.

## Establishing measured performance

Compare CLI and restricted MCP on an ant, a potion, and a humanoid using the
same brief, references, Blender version, and acceptance criteria. Measure total
tokens per accepted asset, elapsed time, correction cycles, and failures.
Evaluate silhouette, palette, defining features, unseen-side geometry, and
export correctness before comparing efficiency. Reusing one scene across
agents should be avoided during this comparison; each worker needs its own
scene or Blender process.
