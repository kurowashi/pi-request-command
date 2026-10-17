/**
 * Unit: the pure parts of the tool. The dialog flow is covered by the integration test.
 *
 * The output cap is a provisional value set to Pi's own tool output limit (50 KiB).
 * It is a warning line, not a measured optimum: re-derive it from real pastes
 * (see DESIGN.md) before changing it.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { buildDialogTitle, MAX_OUTPUT_BYTES, truncateOutput } from "../../src/tool.ts";

test("the output cap is 50 KiB", () => {
	assert.equal(MAX_OUTPUT_BYTES, 50 * 1024);
});

test("output within the cap is returned unchanged", () => {
	assert.deepEqual(truncateOutput("hello\n", 16), { text: "hello\n", truncated: false });
});

test("output over the cap keeps the first bytes and reports truncation", () => {
	const result = truncateOutput("abcdefghij", 4);
	assert.deepEqual(result, { text: "abcd", truncated: true });
});

test("truncation never splits a multi-byte character into a broken sequence beyond one replacement", () => {
	// "あ" is 3 bytes in UTF-8. A cap of 4 cuts the second character in the middle.
	const result = truncateOutput("ああ", 4);
	assert.equal(result.truncated, true);
	assert.equal(result.text, "あ\uFFFD");
});

test("the dialog shows the exact command and the reason", () => {
	const title = buildDialogTitle("sudo systemctl restart nginx", "nginx の設定を反映するため");
	assert.match(title, /sudo systemctl restart nginx/);
	assert.match(title, /nginx の設定を反映するため/);
});
