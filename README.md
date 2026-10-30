# agent-skills

跨运行时的通用 skills 仓库，包含 `superwiki`、`explorer`、`librarian`。每个 skill 都是遵循 [Agent Skills 规范](https://agentskills.io) 的自包含目录（`SKILL.md` + 支持文件）。

## Codex 原生 agents 已迁移

原生 Codex Flash agents、安装器实现和相关说明已独立到 [Kayphoon/codex-flash-agents](https://github.com/Kayphoon/codex-flash-agents)。新安装请使用独立仓库的入口：

```bash
curl -fsSL https://raw.githubusercontent.com/Kayphoon/codex-flash-agents/main/install.sh | sh
```

本仓库不再包含原生 agent TOML。旧 `install-codex.sh` 和 `agent-skills codex install` 仅作为兼容桥，提示迁移后转交独立仓库安装器；安装参数和失败退出码会保留。此变更不影响下面的通用 skills。

兼容桥每次使用独立的临时 npm 缓存，结束后清理，避免固定 `main` 下载地址复用旧包。

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

本仓库的安装器与文档以 MIT 许可发布，见 [LICENSE](LICENSE)。`explorer`、`librarian` 内容改编自 [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)，其 MIT 许可与第三方声明随各自 skill 目录保留。
