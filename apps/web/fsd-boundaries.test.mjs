import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(projectRoot, "src", "fsd");
const layerRank = { entities: 0, features: 1, widgets: 2 };

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.[cm]?[jt]sx?$/.test(entry.name)
        ? [path]
        : [];
  });
}

test("FSD slices use public APIs and only depend downward", () => {
  const violations = [];

  for (const file of [resolve(projectRoot, "app"), sourceRoot].flatMap(sourceFiles)) {
    const sourceLayer = relative(sourceRoot, file).split(/[\\/]/)[0];
    const imports = readFileSync(file, "utf8").matchAll(/(?:from\s+|import\s*\()["'](@\/(entities|features|widgets)\/[^"']+)["']/g);

    for (const [, path, targetLayer] of imports) {
      const segments = path.split("/");
      const isPublicEntry = segments.length === 3 || (segments.length === 4 && segments[3] === "server");
      if (!isPublicEntry) violations.push(`${relative(sourceRoot, file)} imports private path ${path}`);
      if (layerRank[targetLayer] > layerRank[sourceLayer]) violations.push(`${sourceLayer} imports upward from ${targetLayer}: ${path}`);
    }
  }

  assert.deepEqual(violations, []);
});
