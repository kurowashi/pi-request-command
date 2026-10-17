/**
 * pi-request-command: ask the user to run a command in their own terminal.
 *
 * The agent holds no privileges. It registers one model-only tool, and every
 * command runs in the user's shell, so sudo and passwords never reach Pi.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createRequestCommandTool } from "./tool.ts";

export default function requestCommandExtension(pi: ExtensionAPI): void {
	pi.registerTool(createRequestCommandTool());
}
