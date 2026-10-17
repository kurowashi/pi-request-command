/**
 * Integration: the tool as Pi calls it, through the loaded extension.
 *
 * A scripted UI answers the dialogs in order. The tests check what the model
 * receives and which dialogs were shown, so the wording and the status values
 * are part of the contract.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { AgentToolResult } from "@earendil-works/pi-coding-agent";
import { createRequestCommandTool } from "../../src/tool.ts";

type RequestCommandTool = ReturnType<typeof createRequestCommandTool>;
type ToolContext = Parameters<RequestCommandTool["execute"]>[4];

interface ScriptedUi {
	selects: Array<{ title: string; options: string[]; signal: AbortSignal | undefined }>;
	editors: Array<{ title: string; prefill: string | undefined }>;
}

interface Scripted {
	hasUI?: boolean;
	selectAnswers?: Array<string | undefined>;
	editorAnswers?: Array<string | undefined>;
}

const COMMAND = "sudo systemctl restart nginx";
const REASON = "nginx の設定を反映するため";
const OPTION_EXECUTED = "実行した";
const OPTION_REJECTED = "拒否";
const OPTION_PASTE = "出力を貼って完了";

/** Imported from src so the coverage run measures the code the dialogs exercise. The loader is checked in the contract tests. */
async function loadTool(): Promise<RequestCommandTool> {
	return createRequestCommandTool();
}

function run(tool: RequestCommandTool, scripted: Scripted, signal?: AbortSignal) {
	const ui: ScriptedUi = { selects: [], editors: [] };
	const selectAnswers = [...(scripted.selectAnswers ?? [])];
	const editorAnswers = [...(scripted.editorAnswers ?? [])];
	const ctx = {
		hasUI: scripted.hasUI ?? true,
		ui: {
			select: async (title: string, options: string[], opts?: { signal?: AbortSignal }) => {
				ui.selects.push({ title, options, signal: opts?.signal });
				return selectAnswers.shift();
			},
			editor: async (title: string, prefill?: string) => {
				ui.editors.push({ title, prefill });
				return editorAnswers.shift();
			},
		},
	} as unknown as ToolContext;
	const promise = tool.execute("call-1", { command: COMMAND, reason: REASON }, signal, undefined, ctx);
	return { promise, ui };
}

function textOf(result: AgentToolResult<unknown>): string {
	return result.content.map((part) => (part.type === "text" ? part.text : "")).join("");
}

test("the dialog shows the command and the reason with the three choices", async () => {
	const tool = await loadTool();
	const { promise, ui } = run(tool, { selectAnswers: [OPTION_EXECUTED] });
	await promise;
	assert.equal(ui.selects.length, 1);
	assert.deepEqual(ui.selects[0]?.options, [OPTION_EXECUTED, OPTION_REJECTED, OPTION_PASTE]);
	assert.match(ui.selects[0]?.title ?? "", new RegExp(COMMAND));
	assert.match(ui.selects[0]?.title ?? "", new RegExp(REASON));
});

test("実行した returns executed_reported and says pi did not run the command", async () => {
	const tool = await loadTool();
	const result = await run(tool, { selectAnswers: [OPTION_EXECUTED] }).promise;
	assert.deepEqual(result.details, { status: "executed_reported", truncated: false });
	assert.match(textOf(result), /did not run it/);
	assert.match(textOf(result), /cannot verify/);
});

test("拒否 returns rejected and tells the model not to assume the effect happened", async () => {
	const tool = await loadTool();
	const result = await run(tool, { selectAnswers: [OPTION_REJECTED] }).promise;
	assert.deepEqual(result.details, { status: "rejected", truncated: false });
	assert.match(textOf(result), /Do not assume its effect happened/);
});

test("出力を貼って完了 returns the pasted output to the model", async () => {
	const tool = await loadTool();
	const { promise, ui } = run(tool, {
		selectAnswers: [OPTION_PASTE],
		editorAnswers: ["active (running)"],
	});
	const result = await promise;
	assert.equal(ui.editors.length, 1);
	assert.deepEqual(result.details, { status: "output_provided", truncated: false });
	assert.match(textOf(result), /active \(running\)/);
});

test("an empty paste is a valid output, for a command that printed nothing", async () => {
	const tool = await loadTool();
	const result = await run(tool, { selectAnswers: [OPTION_PASTE], editorAnswers: [""] }).promise;
	assert.deepEqual(result.details, { status: "output_provided", truncated: false });
});

test("a pasted output over the cap is truncated and marked", async () => {
	const tool = await loadTool();
	const big = "x".repeat(50 * 1024 + 10);
	const result = await run(tool, { selectAnswers: [OPTION_PASTE], editorAnswers: [big] }).promise;
	assert.deepEqual(result.details, { status: "output_provided", truncated: true });
	assert.match(textOf(result), /truncated/);
});

test("cancelling the choice fails the tool instead of reporting a rejection", async () => {
	const tool = await loadTool();
	await assert.rejects(run(tool, { selectAnswers: [undefined] }).promise, /cancelled/);
});

test("cancelling the paste editor fails the tool instead of reporting empty output", async () => {
	const tool = await loadTool();
	await assert.rejects(run(tool, { selectAnswers: [OPTION_PASTE], editorAnswers: [undefined] }).promise, /cancelled/);
});

test("the abort signal reaches the choice dialog so a finished turn can dismiss it", async () => {
	const tool = await loadTool();
	const controller = new AbortController();
	const { promise, ui } = run(tool, { selectAnswers: [OPTION_REJECTED] }, controller.signal);
	await promise;
	assert.equal(ui.selects[0]?.signal, controller.signal);
});

test("without a dialog-capable UI the tool fails and shows nothing", async () => {
	const tool = await loadTool();
	const { promise, ui } = run(tool, { hasUI: false });
	await assert.rejects(promise, /no dialog-capable UI/);
	assert.equal(ui.selects.length, 0);
});
