import { resolve } from "path";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import dts from "vite-plugin-dts";

export default defineConfig({
    build: {
        outDir: "dist",
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            name: "lg_core",
            formats: ["es", "umd"],
            fileName: (format) => `litegraph-ts.${format}.js`,
        },
    },
    plugins: [
        // checker({
        //     typescript: true
        // })
        // dts({
        //     entryRoot: "src",
        //     outputDir: "dist",
        //     insertTypesEntry: true,
        // }),
    ],
});
