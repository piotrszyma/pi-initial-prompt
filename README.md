# Pi initial prompt

Shows the first user prompt from the current conversation in Pi's bottom status bar:

```text
○ Prompt: implement a pi plugin that shows the first prompt
```

## Try it

From this directory:

```sh
pi -e ./index.ts
```

To install it for all projects:

```sh
pi install "$PWD"
```

Run `/reload` in an existing Pi session after installation or code changes.

## Behavior

- Collapses whitespace, trims the ends, and removes terminal control sequences.
- Uses Pi's footer truncation to fit the terminal width, including after resizing.
- Appears after Ponytail on the shared status line, using the theme's dim grey color.
- Keeps the first prompt when later messages arrive.
- Restores it on startup, resume, reload, or fork. Follows the active branch when using `/tree`.
- Keeps the original prompt after context compaction.
- Hides the status in an empty session. Shows `[no text]` for an image-only prompt.
- Runs only in terminal UI mode. Does not change prompts or write session data.

Uses `ctx.ui.setStatus()`, so the normal footer stays intact. Other extension statuses share the same line. A custom footer must render extension statuses to show this one.

## Tests

Requires Node.js 22.19 or newer. No dependency installation is needed to run tests.

```sh
npm test
```
