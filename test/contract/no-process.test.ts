/**
 * Contract: the extension never starts a process.
 *
 * The user runs every command in their own terminal. If the extension spawned
 * a process, the agent would hold the privileges the design exists to avoid,
 * so the source must not reach any process-spawning module.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT } from "../helpers/root.ts";

const PROCESS_MODULES = ["child_process", "node:child_process", "node:process", "process"];

test("no source file imports a process-spawning module", () => {
	const offenders: string[] = [];
	for (const name of readdirSync(join(PACKAGE_ROOT, "src"))) {
		const source = readFileSync(join(PACKAGE_ROOT, "src", name), "utf8");
		for (const module of PROCESS_MODULES) {
			if (source.includes(`"${module}"`)) offenders.push(`${name}: ${module}`);
		}
	}
	assert.deepEqual(offenders, [], "the extension must not start processes");
});
