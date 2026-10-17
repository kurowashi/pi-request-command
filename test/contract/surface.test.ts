/**
 * Contract: the model-facing surface is exactly one tool, and nothing else.
 *
 * The tool asks the user to act, so it is `model-only`: it is declared to the
 * model while active and never callable from a codemode script, which would
 * otherwise ask the user without the model deciding to.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadRequestCommandExtension } from "../helpers/extension.ts";

test("exactly one tool is registered, and it is model-only", async () => {
	const extension = await loadRequestCommandExtension();
	assert.deepEqual([...extension.tools.keys()], ["request_user_command"]);
	assert.equal(extension.tools.get("request_user_command")?.definition.exposure, "model-only");
});

test("no commands and no event handlers are registered", async () => {
	const extension = await loadRequestCommandExtension();
	assert.deepEqual([...extension.commands.keys()], []);
	assert.deepEqual([...extension.handlers.keys()], []);
});
