import * as esbuild from "esbuild";
import * as child_process from "node:child_process";
import * as fs from "node:fs/promises";
import peggy from "peggy";
import * as readline from "node:readline";
import * as path from "node:path";
import peggyOptimizer from "@markw65/peggy-optimizer";

const cjsDir = "build";
const releaseBuild = process.argv.includes("--release");
const sourcemap = !releaseBuild;

let buildActive = 0;
function activate() {
  if (!buildActive++) {
    console.log(`${new Date().toLocaleString()} - Build active`);
  }
}

function deactivate() {
  setTimeout(() => {
    if (!--buildActive) {
      console.log(`${new Date().toLocaleString()} - Build inactive`);
    }
  }, 500);
}

function report(diagnostics, kind) {
  diagnostics.forEach((diagnostic) => diagnostic.location.column++);

  esbuild
    .formatMessages(diagnostics, {
      kind,
      color: true,
      terminalWidth: 100,
    })
    .then((messages) => messages.forEach((error) => console.log(error)));
}

const startEndPlugin = {
  name: "startEnd",
  setup(build) {
    build.onStart(() => {
      activate();
      console.log(`${new Date().toLocaleString()} - ESBuild start`);
    });
    build.onEnd((result) => {
      report(result.errors, "error");
      report(result.warnings, "warning");
      false &&
        Object.entries(result.metafile.outputs).forEach(
          ([key, value]) =>
            key.endsWith(".js") &&
            console.log(`${key}: ${value.bytes >>> 10}kb`)
        ) &&
        console.log("");

      Object.entries(result.metafile?.outputs ?? {}).forEach(
        ([key, value]) =>
          key.endsWith(".cjs") &&
          value.bytes > 10000 &&
          console.log(`${key}: ${value.bytes >>> 10}kb`)
      );
      console.log("");

      console.log(`${new Date().toLocaleString()} - ESBuild end`);
      deactivate();
    });
  },
};

const peggyPlugin = {
  name: "peggy",
  setup(build) {
    build.onLoad({ filter: /\.peggy$/ }, async (args) => {
      // Load the file from the file system
      const source = await fs.readFile(args.path, "utf8");
      const convertMessage = ({ message, location: loc }) => {
        let location;
        if (loc) {
          const lineText = source.split(/\r\n|\r|\n/g)[loc.start.line - 1];
          const lineEnd =
            loc.start.line === loc.end.line ? loc.end.column : lineText.length;
          location = {
            file: args.path,
            line: loc.start.line,
            column: loc.start.column,
            length: lineEnd - loc.start.column,
            lineText,
          };
        }
        return { text: message, location };
      };

      try {
        const mapDir = path.resolve(build.initialOptions.outdir, "..");
        const options = /** @type {const} */ {
          cache: false,
          format: "es",
          grammarSource: args.path,
          allowedStartRules: ["Start", "SingleExpression", "PersonalityStart"],
          plugins: [peggyOptimizer],
        };
        if (build.initialOptions.sourcemap) {
          const sourceAndMap = peggy
            .generate(source, {
              ...options,
              output: "source-and-map",
            })
            .toStringWithSourceMap({});
          let contents = sourceAndMap.code;
          const sourceMap = sourceAndMap.map.toJSON();
          sourceMap.sources = sourceMap.sources.map((src) => {
            return src === null ? null : path.relative(mapDir, src);
          });
          const map = `data:text/plain;base64,${Buffer.from(
            JSON.stringify(sourceMap)
          ).toString("base64")}`;
          contents += `\n//# sourceMappingURL=${map}`;
          return { contents, loader: "js" };
        } else {
          return {
            contents: peggy.generate(source, {
              ...options,
              output: "source",
            }),
          };
        }
      } catch (e) {
        return { errors: [convertMessage(e)] };
      }
    });
  },
};

const cjsConfig = {
  entryPoints: ["src/prettier-plugin-monkeyc.ts"],
  bundle: true,
  platform: "node",
  outdir: `${cjsDir}`,
  outExtension: { ".js": ".cjs" },
  target: "node16.4",
  external: ["prettier"],
  format: "cjs",
  plugins: [peggyPlugin, startEndPlugin],
  sourcemap,
  sourcesContent: false,
  metafile: true,
  minify: releaseBuild,
  logLevel: "silent",
};

function spawnByLine(command, args, lineHandler, options) {
  return new Promise((resolve, reject) => {
    const proc = child_process.spawn(command, args, {
      ...(options || {}),
      shell: false,
    });
    const rl = readline.createInterface({
      input: proc.stdout,
    });
    const rle = readline.createInterface({
      input: proc.stderr,
    });
    proc.on("error", reject);
    proc.stderr.on("data", (data) => console.error(data.toString()));
    rl.on("line", lineHandler);
    rle.on("line", lineHandler);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      reject(code);
    });
  });
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const tscCommand = ["tsc", "--emitDeclarationOnly", "--outDir", "build/src"];
const logger = (line) => {
  // tsc in watch mode does ESC-c to clear the screen
  // eslint-disable-next-line no-control-regex
  line = line.replace(/[\x1b]c/g, "");
  if (
    /Starting compilation in watch mode|File change detected\. Starting incremental compilation/.test(
      line
    )
  ) {
    activate();
  }
  console.log(line);
  if (/Found \d+ errors?\. Watching for file changes/.test(line)) {
    deactivate();
  }
};
if (process.argv.includes("--watch")) {
  const ctx = await esbuild.context(cjsConfig);
  await Promise.all([
    ctx.watch(),
    spawnByLine(npx, tscCommand.concat("--watch"), logger),
  ]);
} else {
  await Promise.all([
    esbuild.build(cjsConfig),
    spawnByLine(npx, tscCommand, logger).then(() => {
      console.log(`${new Date().toLocaleString()} - tsc end`);
    }),
  ]);
}
