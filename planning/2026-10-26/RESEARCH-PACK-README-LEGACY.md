# Research Pack

The workbench is optional. User CLI/API prepares and authorizes a round; `node research-pack/codex-role.mjs ... --all` advances actual Codex roles through MCP without HTTP or a browser, stopping at user review. See [../HEADLESS_RESEARCH_TEAM.md](../HEADLESS_RESEARCH_TEAM.md). This remains sequential self_review, not native DSH Team membership.

One default `dsh-research` Skill guides research without requiring Core, Team or model credentials. Its references load only for the current task. With Core connected, the same Skill uses the research CLI/MCP and verifies each saved result. It does not start an agent loop or grant DSH sessions.

The actor is fixed by the process. A tool argument cannot set `kind` to `user`. One agent completing every stage is `self_review`, not an independent review.

Start at [SKILL.md](SKILL.md). Transport details live in [references/operations.md](references/operations.md). Legacy prototype guides are isolated under references/prototype and are not separate discoverable Skills.

```
npm run research -- init --workspace <dir> --goal "..."
npm run research:mcp -- --workspace <dir>
```

Start with `get_research_context`. Active Bootstrap workspaces use `workspace_query/action`, `paper_query/action` and `foundation_query/action`; unmigrated prototypes retain the original tools. Source permissions and user decisions cannot be nominated in a model payload. The shared operations guide documents both branches.

Preview or install the umbrella skill and a reviewable MCP configuration into a workspace (never a global client configuration):

```powershell
node research-pack/install.mjs --workspace "F:\my-research"
node research-pack/install.mjs --workspace "F:\my-research" --write
```

The installer validates a single SKILL.md and all installed Markdown links before writing; it copies only the root Skill, references and protocol JSON. It refuses existing destinations and directory links. It writes `.agents/skills/dsh-research` and `.agents/dsh-research.mcp.json`; merge the latter into the client you actually use. It does not start an Agent or copy API keys. Keep the runtime directory at the absolute location shown in the generated configuration.
