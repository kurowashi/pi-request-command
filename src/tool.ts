/**
 * The model-facing tool. It never runs a command: it shows the command to the
 * user, who runs it in their own terminal, and returns what the user reports.
 */

import type { AgentToolResult, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const REQUEST_COMMAND_TOOL = "request_user_command";

const OPTION_EXECUTED = "実行した";
const OPTION_REJECTED = "拒否";
const OPTION_PASTE = "出力を貼って完了";

/** Pi's own tool output limit. Provisional: re-derive from real pastes before changing it. */
export const MAX_OUTPUT_BYTES = 50 * 1024;

const STATUS_EXECUTED_REPORTED = "executed_reported";
const STATUS_REJECTED = "rejected";
const STATUS_OUTPUT_PROVIDED = "output_provided";

type RequestCommandStatus = typeof STATUS_EXECUTED_REPORTED | typeof STATUS_REJECTED | typeof STATUS_OUTPUT_PROVIDED;

export interface RequestCommandDetails {
	status: RequestCommandStatus;
	truncated: boolean;
}

const NO_UI_REASON =
	"no dialog-capable UI is available in this mode (print or JSON), so the command cannot be shown to the user";
const CANCELLED_REASON = "the user cancelled the request, so no result was given";
const PASTE_TITLE =
	"Paste the command output. Check it for secrets before sending: it is added to the model's context.";

const parameters = Type.Object({
	command: Type.String({
		minLength: 1,
		description: "The complete shell command for the user to run, copy-pasteable as is.",
	}),
	reason: Type.String({ minLength: 1, description: "Why the command is needed, shown to the user." }),
});

const EXECUTED_TEXT =
	"The user reports having run the command in their own terminal. pi did not run it and cannot verify the result. Ask for the output or check the effect with a read-only command if it matters.";
const REJECTED_TEXT =
	"The user rejected running the command. Do not assume its effect happened. Choose another approach or ask the user how to proceed.";

const DESCRIPTION = `Ask the user to run a shell command in their own terminal, because you cannot run it yourself (for example, it needs sudo or credentials you do not have).

The user sees the exact command and your reason, then chooses one of:
- executed: the user ran it and reports so. Pi did not run it and cannot verify the result.
- rejected: the user will not run it.
- output: the user ran it and pastes the output.

Give a complete command that can be copied as is, and a short reason. Do not assume the command ran unless the user reports it.`;

/** Shown in the choice dialog: the exact command and the reason, nothing that the user could misread. */
export function buildDialogTitle(command: string, reason: string): string {
	return `Run this command in your own terminal, then choose a result.\n\n$ ${command}\n\nReason: ${reason}`;
}

/**
 * Keeps the first `maxBytes` bytes of `text`. A multi-byte character cut at the
 * boundary becomes one replacement character.
 */
export function truncateOutput(text: string, maxBytes = MAX_OUTPUT_BYTES): { text: string; truncated: boolean } {
	const bytes = new TextEncoder().encode(text);
	if (bytes.length <= maxBytes) return { text, truncated: false };
	return { text: new TextDecoder().decode(bytes.subarray(0, maxBytes)), truncated: true };
}

function result(status: RequestCommandStatus, text: string, truncated = false): AgentToolResult<RequestCommandDetails> {
	return { content: [{ type: "text", text }], details: { status, truncated } };
}

type ToolContext = Parameters<ToolDefinition<typeof parameters, RequestCommandDetails>["execute"]>[4];

async function askForOutput(ctx: ToolContext): Promise<AgentToolResult<RequestCommandDetails>> {
	const pasted = await ctx.ui.editor(PASTE_TITLE, "");
	if (pasted === undefined) throw new Error(CANCELLED_REASON);
	const output = truncateOutput(pasted);
	const note = output.truncated ? `\n\n[output truncated: only the first ${MAX_OUTPUT_BYTES} bytes were kept]` : "";
	return result(
		STATUS_OUTPUT_PROVIDED,
		`The user ran the command and pasted its output. pi did not run it.\n\nOutput:\n\n${output.text}${note}`,
		output.truncated,
	);
}

export function createRequestCommandTool(): ToolDefinition<typeof parameters, RequestCommandDetails> {
	return {
		name: REQUEST_COMMAND_TOOL,
		label: "Request user command",
		description: DESCRIPTION,
		parameters,
		exposure: "model-only",
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			if (!ctx.hasUI) throw new Error(NO_UI_REASON);

			const options = [OPTION_EXECUTED, OPTION_REJECTED, OPTION_PASTE];
			const choice = await ctx.ui.select(
				buildDialogTitle(params.command, params.reason),
				options,
				signal ? { signal } : undefined,
			);
			if (choice === undefined) throw new Error(CANCELLED_REASON);
			if (choice === OPTION_EXECUTED) return result(STATUS_EXECUTED_REPORTED, EXECUTED_TEXT);
			if (choice === OPTION_REJECTED) return result(STATUS_REJECTED, REJECTED_TEXT);
			return askForOutput(ctx);
		},
	};
}
