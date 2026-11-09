import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      const serverOnlyStub = path.join(projectRoot, "node_modules", "next", "dist", "compiled", "server-only", "empty.js");
      return { url: pathToFileURL(serverOnlyStub).href, shortCircuit: true };
    }

    if (specifier === "next/headers") {
      const target = path.join(projectRoot, "node_modules", "next", "headers.js");
      return { url: pathToFileURL(target).href, shortCircuit: true };
    }

    if (specifier === "next/server") {
      const target = path.join(projectRoot, "node_modules", "next", "server.js");
      return { url: pathToFileURL(target).href, shortCircuit: true };
    }

    if (specifier.startsWith("@/")) {
      const base = path.join(projectRoot, "src", specifier.slice(2));
      const resolved = path.extname(base) ? base : `${base}.ts`;
      if (existsSync(resolved)) return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }

    if (specifier.startsWith(".") && context.parentURL) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const base = path.resolve(parentDir, specifier);
      if (!path.extname(base)) {
        if (existsSync(`${base}.ts`)) return { url: pathToFileURL(`${base}.ts`).href, shortCircuit: true };
        if (existsSync(`${base}.tsx`)) return { url: pathToFileURL(`${base}.tsx`).href, shortCircuit: true };
        if (existsSync(`${base}.js`)) return { url: pathToFileURL(`${base}.js`).href, shortCircuit: true };
        if (existsSync(`${base}.mjs`)) return { url: pathToFileURL(`${base}.mjs`).href, shortCircuit: true };
      }
    }

    return nextResolve(specifier, context);
  },
});
