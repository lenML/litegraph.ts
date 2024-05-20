import { defineConfig } from "vite";
import checker from "vite-plugin-checker";

export default defineConfig({
    base: "./",
    plugins: [
        // checker({
        //     typescript: true
        // })
    ],
});
