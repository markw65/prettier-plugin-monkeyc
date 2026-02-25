import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as child_process from "node:child_process";
import * as util from "node:util";

const exec = util.promisify(child_process.exec);

const expectationsDir = "./test/expectations";
const pluginPath = "./build/prettier-plugin-monkeyc.cjs";

async function test() {
  // Find all .mc files
  const files = await fs.readdir(expectationsDir);
  const fileSet = new Set(files);
  const mcFiles = files.filter(
    (f) => f.endsWith(".mc") && !f.endsWith(".expect.mc")
  );

  return Promise.all(
    mcFiles.map((file) => {
      const name = file.replace(/\.mc$/, "");
      const expectName = `${name}.expect.mc`;
      if (!fileSet.has(expectName)) {
        console.log(`⚠️  Missing expected file for ${name}`);
        return;
      }
      const inputPath = path.resolve(expectationsDir, file);
      const expectedPath = path.resolve(expectationsDir, expectName);

      return Promise.all([
        exec(`npx prettier --plugin ${pluginPath} ${inputPath}`, {
          encoding: "utf-8",
        }),
        fs.readFile(expectedPath, "utf-8"),
      ])
        .then(([{ stdout }, expected]) => {
          if (stdout === expected) {
            console.log(`✅ ${name}`);
            return true;
          } else {
            console.log(`❌ ${name}`);
            console.log("Expected:\n", expected);
            console.log("Got:\n", stdout);
            return false;
          }
        })
        .catch((e) => {
          console.error(`❌ ${name}: ${e.message}`);
          return false;
        });
    })
  ).then((results) => {
    const passing = results.reduce((t, c) => t + (c ? 1 : 0), 0);
    const failing = results.length - passing;
    console.log(
      failing
        ? `${failing} failed tests out of ${results.length}`
        : `All ${results.length} tests passed`
    );
  });
}

test().then(() => console.log("Done"));
