# Workflow

Paradigm: **TDD + machine-enforced gates.** A rule a tool can enforce, a tool
enforces; prose is a fallback.

## Feature loop

1. **TDD implementation** — red → green → refactor; test + code in one commit.
2. **Review** — code-reviewer on every change; security-reviewer when a change
   touches auth, user input, or persistence.
3. **Gates (non-negotiable):**
   - pre-commit: typecheck, ESLint (staged, incl. boundaries), Prettier check
   - commit-msg: commitlint (conventional)
   - pre-push: full Jest suite, coverage ≥ 80%
     Never use `--no-verify`. If a gate is wrong, fix the gate in its own commit.

## Rules for agents

- Read `CLAUDE.md` vocabulary + stack tables before writing code; never
  introduce a library or synonym not listed there.
- Copy the `residents` feature structure for new features.
- If a task seems to require violating a boundary rule, stop and surface it.
- Report failures honestly: failing output verbatim.
