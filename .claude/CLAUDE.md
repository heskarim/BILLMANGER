# CLAUDE.md

This file provides instructions and guidelines to Claude Code when working in this workspace. It governs the agent's behavior, engineering principles, workflows, and tool integrations.

---

## 1. Core Workflow: Conversation & Planning First

The agent must strictly follow a three-phase progression for any new task, feature, or project:

1.  **Phase 1: Discussion & Alignment (Ask & Understand)**
    *   **NEVER** start coding or proposing plans immediately.
    *   Start by discussing the feature or product with the user. Ask clarifying questions, align on requirements, and ensure a deep, mutual understanding of the user's intent.
    *   Confirm with the user when alignment is reached.
2.  **Phase 2: Build the Implementation Plan**
    *   Once the user gives the go-ahead, draft a clear, sequential implementation plan (`implementation_plan.md` style).
    *   Highlight what comes first, second, and third, detailing boundaries and APIs.
    *   Wait for the user's explicit approval/green light before starting the build.
3.  **Phase 3: Execution & Building**
    *   Once approved, begin building the actual product step-by-step.
    *   Track progress using a task list (e.g., `task.md`).

---

## 2. Dependency & Source Code Integration Policy

*   **Code-Level Source of Truth:** Rely on actual source code instead of guessing or using outdated documentation.
*   **The `opensrc` Directory:** Use the `opensrc` tool/methodology to download and clone the source code of frameworks, libraries, or APIs being used (e.g., Svelte, Convex, MCP repo) into the `f:\dev\Aiapps\opensrc/` directory.
*   **Deep Digging:** When stuck, integrating a complex library, or facing conflicting docs, inspect the relevant cloned source code under `opensrc/` to understand exactly how the tool works under the hood. Keep prompt context lean by only loading specific relevant files.

---

## 3. Engineering Skills & Tool Guidelines

The agent must leverage specific skills and tools to maintain optimal engineering quality:

### A. Code Structure & Architecture Skills
*   **`code-structure` ([code-structure Skill](https://github.com/michaelshimeles/skills/blob/main/code-structure/SKILL.md)):** Use to design clean, simple code structures. Avoid over-complication, and never duplicate logic or copy-paste identical code across features. Build single, reusable sources of truth (functions, components, or services).
*   **`improve-codebase-architecture` ([improve-codebase-architecture Skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/improve-codebase-architecture/SKILL.md)):** Refactor code diligently after meaningful features are added. Ensure the codebase remains modular, clean, and easy for other agents and humans to navigate.

### B. Terminal & Commands optimization
*   **`rtk` ([rtk Command/Skill](https://github.com/rtk-ai/rtk)):** Use the `rtk` skill to run compressed terminal commands, minimizing token consumption and keeping the interaction concise.

### C. Repository Mapping & Visualization
*   **`graphy` / `graphify`:** Use the `graphify` skill to map, cluster, and visualize the workspace repository. This helps the agent construct a mental map of features, boundaries, and dependencies.

### D. PR Review & Iteration Loop
*   **Small PR Policy:** Avoid making large, monolithic Pull Requests. Proactively split changes into smaller, logical chunks (ideally under 1,000 lines) so reviewers can safely inspect them.
*   **Greploop Workflow:**
    1.  Implement the feature/fix.
    2.  Push changes and create a PR. Output the PR link to the user.
    3.  Run `/greploop` to trigger the Greptile reviewer agent.
    4.  Iteratively fix any comments, bugs, or suggestions raised by Greptile.
    5.  Repeat until the review score reaches a perfect **5/5**.

---

## 4. Preferred Stack Bias

*   **Language:** Focus heavily on **TypeScript-first** tools. Since TypeScript is highly inspectable and provides strong type context, the agent is exceptionally powerful here.
*   **Frontend: Svelte / SvelteKit**
    *   Preferred framework for web apps and dashboards.
    *   Its clean HTML-and-TypeScript-centered architecture is easier for agents to read, modify, and verify compared to React.
*   **Backend: Convex**
    *   Preferred backend tool.
    *   Since schemas, queries, mutations, and actions live in inspectable TypeScript code, the agent can understand and modify database logic with extreme precision.

---

## 5. Memory Syncing & Obsidian Integration

*   **Memory Files:** Maintain a clean, general-purpose project memory template (`memory.md` or similar) to track decisions and project-specific contexts.
*   **Sync Rules:** Update the memory files **ONLY** when explicitly instructed by the user to avoid polluting chat history or introducing unnecessary file edits.
*   **Obsidian Vault Sync:**
    *   The user's personal vault is located at: `F:\dev\personel projects\Second braind Vault\.claude`
    *   If requested, the agent can write notes, markdown documentation, or synced files directly to this directory so the user can easily reference them in their Obsidian second brain.

---

## 6. General Style (Karpathy Style)

*   Reason from first principles.
*   Prefer simple, readable, and highly legible solutions over speculative architecture.
*   Build the smallest useful version first, then iterate with tests and direct validation.

---

## Agent skills

### Issue tracker

Local Markdown. Issues and PRDs live under `.scratch/`. See [issue-tracker.md](file:///d:/Dev/Abdlattife%20projects/BILLING/docs/agents/issue-tracker.md).

### Triage labels

Standard roles (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See [triage-labels.md](file:///d:/Dev/Abdlattife%20projects/BILLING/docs/agents/triage-labels.md).

### Domain docs

Single-context repository layout. See [domain.md](file:///d:/Dev/Abdlattife%20projects/BILLING/docs/agents/domain.md).
