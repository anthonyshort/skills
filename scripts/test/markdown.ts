/**
 * Load the same Markdown prompt text that esbuild embeds in the workflow.
 */
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".md")) {
      return {
        format: "module",
        source: `export default ${JSON.stringify(readFileSync(new URL(url), "utf8"))};`,
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});
