# Third-Party Notice — librarian skill

This directory (`librarian/`) is a self-contained distribution. The
notice below and the bundled license cover the content in this directory only,
and include the upstream copyright, license, and provenance for that content.

## This is modified material

The behavior text in [`SKILL.md`](SKILL.md) and
[`references/role.md`](references/role.md) is a **modified adaptation** of an
upstream MIT-licensed agent prompt. It is not the upstream file, and it is not
endorsed by the upstream author. The upstream copyright notice is retained, and
the full MIT license text is bundled at [`LICENSE.txt`](LICENSE.txt).

- Adaptation: converted from a Codex harness agent definition into a portable
  Agent Skill — a discoverable `SKILL.md` entry (plain `name` + `description`
  metadata plus delegation instructions) and a plain-Markdown behavior body in
  `references/role.md`, which is pasted verbatim into a native subagent prompt.
- Harness-specific tool aliases, fixed tool API names, model/nickname/tier
  configuration wrappers, fixed call quotas, and mandatory clone/setup steps
  were replaced with capability descriptions and optional, caller-authorized
  scratch cloning.
- Upstream date awareness was preserved: the current year is read from the
  environment or session rather than assumed. The port clarifies that a
  caller-specified version, tag, or commit takes precedence over newer
  publication dates, so sources for a pinned target stay the better evidence.
- Explicit honesty and fallback constraints were added for missing
  capabilities.
- The TYPE A/B/C/D discovery, evidence, history, failure-recovery, read-only,
  and citation semantics of the original prompt are retained.
- `SKILL.md` is deliberately compact: besides delegation mechanics it records a
  caller-side, per-call preference for a runtime-conditional lightweight/fast
  read-only subagent (explicit caller choice first, otherwise a host-provided
  lightweight type when one exists). It asserts no model identity, price, or
  speed of its own (runtime-provided cost/speed facts may be cited when the host
  exposes them), and does not alter the full behavior body, which stays in
  `references/role.md`.

No SUL/OpenCode variant prompt text was used.

## Upstream source

- Repository: <https://github.com/code-yeongyu/oh-my-openagent> (formerly
  `oh-my-opencode`; the old name redirects to this repository)
- Pinned commit:
  [`6803303cfc3391e2eed90e54a6670595fb6ef66f`](https://github.com/code-yeongyu/oh-my-openagent/tree/6803303cfc3391e2eed90e54a6670595fb6ef66f)
- Version at that commit: 5.1.49
- Variant: Codex / `omo-codex` ultrawork agent prompt
- Upstream file:
  [`packages/omo-codex/plugin/components/ultrawork/agents/librarian.toml`](https://github.com/code-yeongyu/oh-my-openagent/blob/6803303cfc3391e2eed90e54a6670595fb6ef66f/packages/omo-codex/plugin/components/ultrawork/agents/librarian.toml)
- License: MIT
- Copyright: Copyright (c) 2026 Yeongyu Kim
- Bundled license text: [`LICENSE.txt`](LICENSE.txt)

### Upstream license and notice at the pinned commit

The upstream component declares its license with an MIT license file and a
notice recording that the component includes MIT-licensed material:

- Upstream license file:
  <https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/6803303cfc3391e2eed90e54a6670595fb6ef66f/packages/omo-codex/plugin/components/ultrawork/LICENSE>
- Upstream notice file:
  <https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/6803303cfc3391e2eed90e54a6670595fb6ef66f/packages/omo-codex/plugin/components/ultrawork/NOTICE>

Those links are public and immutable at the pinned commit; the MIT license
full text they refer to is bundled here as `LICENSE.txt`, so nothing needed for
compliance depends on network access.

## Scope

The MIT license and copyright above cover the adapted librarian skill content
in this directory. They do not relicense other projects or skills.
