# StudySync Agent Instructions

## Repository purpose

StudySync is a capstone application with an existing architecture and established development conventions. Preserve the current design, behavior, naming, and boundaries unless a task explicitly requires a change.

Before performing repository work, read:

- `capstone-code-style-rules.txt`
- Any more-specific `AGENTS.md` that applies to the current working directory
- Relevant implementation, tests, configuration, and project documentation

Treat the current repository and verified runtime behavior as the primary source of truth.

## Core engineering rules

- Match the existing repository style.
- Prefer focused, minimal diffs.
- Do not reformat unrelated code.
- Preserve existing names, ports, adapters, services, schemas, and dependency boundaries.
- Keep LlamaIndex within its existing orchestration/retrieval responsibility.
- Do not bypass StudySync ports or services to access infrastructure directly when an existing boundary already owns that responsibility.
- Do not add abstractions, dependencies, or files unless they solve a concrete problem in the current task.
- Prefer consistency with the existing codebase when multiple industry-valid approaches exist.
- Justify non-obvious implementation or architecture decisions using the existing StudySync design, established software-engineering principles, or relevant industry practice.

## Verification requirements

Do not consider implementation work complete until it is verified.

Use the smallest appropriate verification sequence:

1. Targeted tests for the changed behavior.
2. Broader regression tests when the change can affect existing behavior.
3. A live integration check when correctness depends on an external service, runtime configuration, or adapter integration.

Do not report a task as complete when tests are failing, skipped without justification, or unable to exercise the requested behavior.

## Evidence and review discipline

When reviewing the repository, clearly distinguish:

- **Confirmed:** directly supported by source code, configuration, tests, or observed runtime behavior.
- **Inferred:** strongly suggested by the implementation but not directly verified.
- **Recommended:** a proposed improvement or future change.
- **Unresolved:** information that cannot be determined from the available repository evidence.

Do not describe planned or documented behavior as implemented unless the repository or a live verification demonstrates it.

## Specialist roles

Specialist role definitions live under `.agents/roles/`.

Use the appropriate role when a task matches its responsibility:

- `.agents/roles/infrastructure-auditor.md` — inspect and document the infrastructure that currently exists.
- `.agents/roles/architecture-guardian.md` — evaluate architectural consistency and proposed design changes.
- `.agents/roles/development-coordinator.md` — plan current or future development and synthesize specialist findings.
- `.agents/roles/verification-agent.md` — independently verify implementations, tests, and integrations.

Before acting in one of these roles, read the corresponding role file and follow it in addition to this file.

If the environment supports multi-agent delegation, independent read-only investigations may run concurrently. Avoid assigning multiple agents to modify the same files or shared mutable state at the same time.

## Change authority

Review-oriented specialist roles are read-only unless the user explicitly authorizes implementation.

When implementation is authorized:

- Make only the changes required for the requested task.
- Preserve unrelated behavior.
- Show or summarize exactly what changed.
- Verify the change before declaring success.

## Commands and output

- Provide commands that can be copied directly into the StudySync development environment.
- Do not include shell prompts in copyable commands.
- Prefer concrete file paths, commands, expected behavior, and verification evidence over broad background explanation.
- When a failure occurs, identify the specific cause supported by evidence before proposing broader changes.
