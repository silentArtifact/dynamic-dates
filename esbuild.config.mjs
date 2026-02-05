import esbuild from "esbuild";

esbuild.build({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: ["obsidian"],
	outfile: "main.js",
	format: "cjs",
	target: "es2022",
	sourcemap: false,
	logLevel: "info",
}).catch(() => process.exit(1));
