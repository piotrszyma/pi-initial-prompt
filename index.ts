import { stripVTControlCharacters } from "node:util";
import type { UserMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	let hasFirstPrompt = false;

	function showPrompt(message: UserMessage | undefined, ctx: ExtensionContext) {
		hasFirstPrompt = message !== undefined;
		const content = message?.content ?? "";
		const text = typeof content === "string"
			? content
			: content.filter((part) => part.type === "text").map((part) => part.text).join(" ");
		// Node's ANSI stripper leaves parts of some OSC (terminal command) sequences.
		const singleLine = stripVTControlCharacters(
			text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, ""),
		)
			.replace(/\s+/g, " ")
			.replace(/[\x00-\x1f\x7f-\x9f]/g, "")
			.trim();
		// Pi sorts statuses by key; this places the prompt after Ponytail.
		ctx.ui.setStatus(
			"ponytail.initial-prompt",
			message ? ctx.ui.theme.fg("dim", `○ Prompt: ${singleLine || "[no text]"}`) : undefined,
		);
	}

	function restorePrompt(_event: unknown, ctx: ExtensionContext) {
		if (ctx.mode !== "tui") return;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "message" && entry.message.role === "user") {
				showPrompt(entry.message, ctx);
				return;
			}
		}
		showPrompt(undefined, ctx);
	}

	pi.on("session_start", restorePrompt);
	pi.on("session_tree", restorePrompt);
	pi.on("message_start", (event, ctx) => {
		if (ctx.mode === "tui" && !hasFirstPrompt && event.message.role === "user") {
			showPrompt(event.message, ctx);
		}
	});
}
