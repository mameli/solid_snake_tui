import { readdir, writeFile } from "node:fs/promises";
import solidPlugin from "@opentui/solid/bun-plugin";

await Bun.$`rm -rf dist`;

const result = await Bun.build({
  entrypoints: ["./src/index.tsx"],
  outdir: "./dist",
  target: "bun",
  plugins: [solidPlugin],
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }

  process.exit(1);
}

const distFiles = await readdir("./dist");
const strippedWasm = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

await Promise.all(
  distFiles.map(async (fileName) => {
    if (fileName.startsWith("tree-sitter-") && fileName.endsWith(".wasm")) {
      await writeFile(`./dist/${fileName}`, strippedWasm);
      return;
    }

    if (
      (fileName.startsWith("highlights-") || fileName.startsWith("injections-")) &&
      fileName.endsWith(".scm")
    ) {
      await writeFile(`./dist/${fileName}`, "");
    }
  }),
);
