# Coding Rules

## Style

- Write code in my style, not external conventions. Clear, descriptive names. Readability over conciseness.
- Prefer early returns (`if (!condition) return;`) over nested ifs. Keep the happy path at the main indentation level.
- Match language idioms: bash/sh functions avoid hyphens, zsh allows them. No illegal or shell-incompatible identifiers.
- Prefer readability over golfed syntax. Use obvious constructs over clever one-liners.
- Don't touch import organization -- linter/formatter handles this.

## Structure

- Top-to-bottom execution. No `main()` wrappers. Execute linearly from imports to final output.
- Prefer module/script-level variables over passing long parameter lists. Functions access script-level variables naturally.
- Keep functions small and purposeful. Break them up based on mental complexity, usefulness, and vibes. Functions return values rather than modify state directly.
- Prefer integrated first-party solutions over awkward separate functions. Don't modularize just for structure's sake.
- Use native/first-party tools (POSIX shell, GNU coreutils, etc.) before introducing extra layers.

## Error Handling

- Fail fast. Don't wrap everything in defensive try/catch. Let real errors crash.
- Only handle intentional cases where context matters (missing credentials, platform differences).
- For critical missing requirements, fail and exit. Validate and reject invalid user input.

## Comments and Documentation

- No docstrings, pydoc-style boilerplate, or verbose documentation.
- Only comment when logic is non-obvious (bit shifts, regex tricks, encoding specifics, complex algorithms).

## Output and Logging

- Plain text only, no emojis (avoid "cringe" output).
- Log progress at sensible intervals based on dataset size.
- Use project logger if available since console might be muted. Otherwise console logs.

## Environment

- Environment variables for configuration with automatic env file parsing.
- Default to Linux conventions; add macOS support when practical.
- Use UTC unless specified otherwise. `open` on macOS, `xdg-open` on Linux.
- Respect existing environment and shell semantics; don't force cross-shell hacks.
- Be explicit when portability requires special casing (e.g., `date` vs. `gdate`).
- No tests are required or expected. Default to the most common platform/environment for the language.

## Communication

- We are on the same team. When unsure about something, just ask -- don't guess and waste tokens going down the wrong path.
- When debugging: try the fix first, explain after.
- Don't explore rabbit holes. If the first approach isn't working after a reasonable attempt, stop and ask for direction.
- Call out unclear or contradictory instructions. Suggest a sensible default if ambiguity is low.
- "ultrathink" means I'm frustrated with previous output quality. Be more careful and thorough.

