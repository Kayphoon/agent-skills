# Third-Party Notice — Codex native agents

The role instructions in `agents/flash_explorer.toml` and
`agents/flash_librarian.toml` are modified adaptations of MIT-licensed upstream
agent prompts. They are not unmodified upstream files and are not endorsed by
the upstream author. Copyright (c) 2026 Yeongyu Kim is retained in the bundled
[MIT license](LICENSE.txt).

## Adaptation and scope

These self-contained Codex native agent definitions were adapted from this
repository's `skills/explorer/references/role.md` and
`skills/librarian/references/role.md`. Their full role instructions are embedded
in `developer_instructions`; installation does not require the skills directory
or a caller to paste role text or append a special task heading.

The adaptations preserve the local explorer's absolute-path evidence,
`<request>`/`<results>` response contract, search depth, capability fallbacks,
and read-only boundaries. The public `<request>` block replaces the upstream
`<analysis>` heading and is not an invitation to expose private reasoning.
The librarian retains its TYPE A/B/C/D classification, version awareness,
commit-pinned code evidence, official-documentation citations, failure recovery,
and caller-authorized optional scratch cloning. Context7 remains the preferred
documentation index when available through the parent session's enabled MCP
connections, with official-documentation fallbacks.

Harness-specific tool aliases and fixed invocation formats have been replaced
with capability descriptions and ordinary subagent task prompts. Model and
reasoning defaults are configuration fields, not promises about availability,
cost, or speed. Permissions, provider, and MCP servers remain inherited from the
parent session. The read-only instructions are behavioral constraints, not an
independent sandbox.

The bundled license and this notice cover the adapted role content distributed
in these two agent files. They do not relicense unrelated projects or skills.
No SUL/OpenCode variant prompt text was used.

## Pinned upstream provenance

Repository: <https://github.com/code-yeongyu/oh-my-openagent> (formerly
`oh-my-opencode`). The source revision recorded by the repository's existing
role distributions is
[`6803303cfc3391e2eed90e54a6670595fb6ef66f`](https://github.com/code-yeongyu/oh-my-openagent/tree/6803303cfc3391e2eed90e54a6670595fb6ef66f),
version 5.1.49, Codex / `omo-codex` ultrawork variant.

Upstream explorer:
<https://github.com/code-yeongyu/oh-my-openagent/blob/6803303cfc3391e2eed90e54a6670595fb6ef66f/packages/omo-codex/plugin/components/ultrawork/agents/explorer.toml>

Upstream librarian:
<https://github.com/code-yeongyu/oh-my-openagent/blob/6803303cfc3391e2eed90e54a6670595fb6ef66f/packages/omo-codex/plugin/components/ultrawork/agents/librarian.toml>

Upstream license:
<https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/6803303cfc3391e2eed90e54a6670595fb6ef66f/packages/omo-codex/plugin/components/ultrawork/LICENSE>

Upstream notice:
<https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/6803303cfc3391e2eed90e54a6670595fb6ef66f/packages/omo-codex/plugin/components/ultrawork/NOTICE>

The full MIT license is bundled locally as `LICENSE.txt`, so retaining the
copyright and permission notice does not depend on network access.
