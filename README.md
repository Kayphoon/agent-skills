# agent-skills

Codex 原生搜索子代理的一键安装包，同时保留 `superwiki`、`explorer`、`librarian` 三个跨运行时 skill。

## Codex 原生 agent（一键安装）

需要 Node.js 18+、npm，以及已经安装的 Codex CLI。在终端执行：

```bash
npx --yes github:Kayphoon/agent-skills codex install
```

也可以使用仓库提供的 macOS / Linux 安装脚本，效果相同：

```bash
curl -fsSL https://raw.githubusercontent.com/Kayphoon/agent-skills/main/install-codex.sh | sh
```

安装器把两个自包含 TOML 放入 `~/.codex/agents/`；设置了 `CODEX_HOME` 时使用该目录。角色正文直接存入 `developer_instructions`，Codex 按名称发现并调用，无需先加载 skill 或在每次派发时粘贴角色全文。

| 原生 agent | 工作范围 | 默认模型 / 推理档位 |
|---|---|---|
| `flash_explorer` | 本地代码只读检索、符号和调用链定位，返回绝对路径与证据 | `deepseek-flash` / `low` |
| `flash_librarian` | 外部库和 API 资料研究，优先 Context7，文档附官方链接、源码固定到 commit | `deepseek-flash` / `low` |

默认模型需要你的现有 provider 支持。安装器不添加 provider 或凭据；可以安装时显式指定本机可用的模型和推理档位，agent 名称保持不变：

```bash
npx --yes github:Kayphoon/agent-skills codex install --model gpt-6-luna --effort high
```

Context7 通过 `codex mcp add context7 --url https://mcp.context7.com/mcp` 注册到父会话，再由子代理继承。已有同名连接会完整保留，包括鉴权、地址和启用状态；已有但关闭的连接会提示你在 Codex 中启用。需要鉴权时请在 Codex 的 MCP 设置中完成连接；索引更新时间不代表文档绝对实时。

原生 agent 的模型和推理档位由 TOML 固定，权限、provider 与 MCP 来自父会话。只读属于角色行为约束，不会产生额外的只读沙箱。这些规则依据 [Codex 官方子代理文档](https://learn.chatgpt.com/docs/agent-configuration/subagents) 和 [MCP 文档](https://learn.chatgpt.com/docs/extend/mcp)。

安装完成后新开 Codex 会话，例如：

```text
用 flash_explorer 找出这个项目的认证入口和调用链。
用 flash_librarian 核对当前项目版本对应的官方 API 文档。
```

不同内容的既有 agent 文件默认保留，重复运行不会重复添加 MCP。需要升级或替换模型时使用 `--force`，它会先在原文件旁保存 `.backup-<id>` 副本。新增 Context7 前也会备份已有 `config.toml`。许可和来源声明安装到 `~/.codex/agent-skills-notices/`。

```bash
# 预览目标和计划；不改目标文件
npx --yes github:Kayphoon/agent-skills codex install --dry-run

# 更新 agent 文件，先备份旧文件
npx --yes github:Kayphoon/agent-skills codex install --force

# 只装 TOML；适用于暂时没有 Codex CLI 或自行管理 MCP 的环境
npx --yes github:Kayphoon/agent-skills codex install --skip-context7
```

如果之前装过 `explorer` / `librarian` skills，改用原生 agent 后可在 Codex 的 skills 设置中禁用这两个旧入口，避免重复路由。安装器不会删除它们，其他运行时仍可使用。

## 通用 skills

每个 skill 都是一个自包含目录（`SKILL.md` + 支持文件），遵循 [Agent Skills 规范](https://agentskills.io)。下面的命令安装 skills；Codex 搜索子代理推荐使用上面的 `codex install`。

## 包含的 skill

| skill | 用途 |
|---|---|
| `superwiki` | 项目知识库管理器：维护 `.wiki/skills/` 下的 `wiki-*` 知识模块，以当前代码为真相来源。附带 `superwiki-init` 与 `skills.sh` 两个脚本。 |
| `explorer` | 本地代码库只读探查：把「在不熟悉的仓库里找代码」委派给原生子代理，返回带路径的结论。 |
| `librarian` | 外部资料只读研究员：查外部库、OSS、厂商 API 的官方文档与源码，回到钉到 commit 与代码行的证据。 |

`explorer` 与 `librarian` 是上游 MIT 许可内容的改编版，上游署名与许可全文随目录一起分发：见各自目录下的 `NOTICE.md` 与 `LICENSE.txt`。

## 安装通用 skills

最通用的一条命令，任何支持 skills 协议的 agent 都能装到项目里：

```bash
npx skills add Kayphoon/agent-skills
```

只想装其中一个，并指定 agent：

```bash
npx skills add Kayphoon/agent-skills --skill superwiki -a codex
```

本仓库也自带一个零依赖安装器，直接装到用户级目录。npm 上的包发布前，用 GitHub 协议这条命令即可（可用性已验证）：

```bash
# 全部三个
npx github:Kayphoon/agent-skills install

# 只装指定的
npx github:Kayphoon/agent-skills install superwiki explorer

# 装到 Codex 的 skills 目录
npx github:Kayphoon/agent-skills install --target codex

# 装到某个项目而不是用户目录
npx github:Kayphoon/agent-skills install --project ./my-repo
```

等 `@kayphoon/agent-skills` 发布到 npm 之后，同样的命令可以缩短成：

```bash
# 全部三个
npx @kayphoon/agent-skills install

# 只装指定的
npx @kayphoon/agent-skills install superwiki explorer

# 装到 Codex 的 skills 目录
npx @kayphoon/agent-skills install --target codex

# 装到某个项目而不是用户目录
npx @kayphoon/agent-skills install --project ./my-repo
```

其他命令：

```bash
npx @kayphoon/agent-skills list          # 列出可用 skill 和安装状态
npx @kayphoon/agent-skills info superwiki
npx @kayphoon/agent-skills remove explorer
```

安装完成后新开一次会话，让运行时重新发现 skill。

## 安装位置

默认写入用户级的 agent-compatible 目录 `~/.agents/skills`。`--target` 可选 `agents`（默认）、`codex`、`claude`、`opencode`、`cursor`，可重复指定；加 `--project <dir>` 时改为写进项目的对应目录。

安装器默认复制文件，所以升级包之后不会影响已安装的副本；要覆盖已有同名目录显式加 `--force`，要建立符号链接（开发场景）加 `--link`，只想看会发生什么就加 `--dry-run`。

## 使用 superwiki

装好之后，先用初始化脚本给项目建立知识库入口（只挑你要用的运行时）：

```bash
superwiki-init --codex /path/to/project
```

它会创建 `.wiki/skills/`，并把 `.agents/skills` 指向它（`--opencode`、`--claude`、`--cursor` 同理）。之后知识模块就写在 `.wiki/skills/wiki-*/SKILL.md`，由运行时的原生 skill 发现按 `name` + `description` 路由。

## 许可证

本仓库的安装器与文档以 MIT 许可发布，见 [LICENSE](LICENSE)。`explorer`、`librarian` 及原生 agent 内容改编自 [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)，其 MIT 许可与第三方声明随 skill 目录和 [codex/](codex/NOTICE.md) 保留。
