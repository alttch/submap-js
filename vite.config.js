import * as path from "path";
import { defineConfig } from "vite";

const lib_name = "submap";

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, "src/lib.ts"),
      name: lib_name,
      fileName: (format) =>
        format === "umd" ? `${lib_name}.cjs` : `${lib_name}.${format}.js`
    }
  }
});
