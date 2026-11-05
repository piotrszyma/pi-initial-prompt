import assert from "node:assert/strict";
import { test } from "node:test";
import { stripVTControlCharacters } from "node:util";
import initialPrompt from "../index.ts";

const user = (content) => ({ role: "user", content, timestamp: 0 });
const entry = (message) => ({ type: "message", message });

function setup(branch = [], mode = "tui") {
	const handlers = new Map();
	const statuses = new Map();
	const ctx = {
		mode,
		sessionManager: { getBranch: () => branch },
		ui: {
			setStatus: (key, value) => statuses.set(key, value),
			theme: {
				fg: (color, text) => {
					assert.equal(color, "dim");
					return `\x1b[90m${text}\x1b[39m`;
				},
			},
		},
	};
	initialPrompt({ on: (event, handler) => handlers.set(event, handler) });
	return {
		statuses,
		emit: (type, event = {}) => handlers.get(type)({ type, ...event }, ctx),
		setBranch: (entries) => { branch = entries; },
		status: () => {
			const text = statuses.get("ponytail.initial-prompt");
			return text === undefined ? undefined : stripVTControlCharacters(text);
		},
	};
}

test("shows the first submitted prompt, not later user or assistant messages", () => {
	const app = setup();
	app.emit("session_start");
	assert.equal(app.status(), undefined);
	app.emit("message_start", { message: { role: "assistant", content: [] } });
	assert.equal(app.status(), undefined);
	app.emit("message_start", { message: user("  Build\n\ta plugin  ") });
	assert.equal(app.status(), "○ Prompt: Build a plugin");
	app.emit("message_start", { message: user("Second prompt") });
	assert.equal(app.status(), "○ Prompt: Build a plugin");
});

test("sorts after Ponytail on the shared status line and uses the dim theme color", () => {
	const app = setup([entry(user("Build a plugin"))]);
	app.statuses.set("ponytail", "🐴 ponytail: full");
	app.emit("session_start");
	const keys = [...app.statuses.keys()].sort((a, b) => a.localeCompare(b));
	assert.deepEqual(keys, ["ponytail", "ponytail.initial-prompt"]);
	assert.equal(app.statuses.get(keys[1]), "\x1b[90m○ Prompt: Build a plugin\x1b[39m");
});

test("restores the earliest user message from the active branch, including compacted history", () => {
	const app = setup([
		{ type: "model_change" },
		entry({ role: "system", content: "Not a user prompt" }),
		entry(user("Original task")),
		{ type: "compaction", summary: "Old messages summarized" },
		entry(user("Follow-up task")),
	]);
	app.emit("session_start", { reason: "resume" });
	assert.equal(app.status(), "○ Prompt: Original task");
	app.emit("message_start", { message: user("Another follow-up") });
	assert.equal(app.status(), "○ Prompt: Original task");
});

test("updates on tree navigation and clears when starting an empty session", () => {
	const app = setup([entry(user("Old branch"))]);
	app.emit("session_start");
	app.setBranch([entry(user("New branch"))]);
	app.emit("session_tree");
	assert.equal(app.status(), "○ Prompt: New branch");
	app.setBranch([]);
	app.emit("session_start", { reason: "new" });
	assert.equal(app.status(), undefined);
	app.emit("message_start", { message: user("New session prompt") });
	assert.equal(app.status(), "○ Prompt: New session prompt");
});

test("tree navigation before the first user message allows a new initial prompt", () => {
	const app = setup([entry(user("Abandoned task"))]);
	app.emit("session_start");
	app.setBranch([]);
	app.emit("session_tree");
	assert.equal(app.status(), undefined);
	app.emit("message_start", { message: user("Replacement task") });
	assert.equal(app.status(), "○ Prompt: Replacement task");
});

test("joins text blocks and ignores image data", () => {
	const app = setup([entry(user([
		{ type: "text", text: "  Explain\n" },
		{ type: "image", data: "not-for-display", mimeType: "image/png" },
		{ type: "text", text: " this picture " },
	]))]);
	app.emit("session_start");
	assert.equal(app.status(), "○ Prompt: Explain this picture");
});

test("an image-only first prompt is not replaced by a later text prompt", () => {
	const app = setup();
	app.emit("message_start", {
		message: user([{ type: "image", data: "image", mimeType: "image/png" }]),
	});
	assert.equal(app.status(), "○ Prompt: [no text]");
	app.emit("message_start", { message: user("Follow-up text") });
	assert.equal(app.status(), "○ Prompt: [no text]");
});

test("strips terminal escape sequences and control characters without damaging Unicode", () => {
	const app = setup([entry(user(" \x1b[31mFix\x1b[0m\t日本語 😀\r\n\x1b]0;bad title\x07 now\x00\x08\x7f\x85 "))]);
	app.emit("session_start");
	assert.equal(app.status(), "○ Prompt: Fix 日本語 😀 now");
});

test("leaves width-dependent truncation to Pi rather than cutting by string length", () => {
	const prompt = "日本語 😀 ".repeat(100);
	const app = setup([entry(user(prompt))]);
	app.emit("session_start");
	assert.equal(app.status(), `○ Prompt: ${prompt.trim()}`);
});

test("does not access the terminal UI or session history in non-terminal modes", () => {
	for (const mode of ["print", "json", "rpc"]) {
		initialPrompt({
			on: (type, handler) => handler({ type, message: user("Task") }, { mode }),
		});
	}
});
