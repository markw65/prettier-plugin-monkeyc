import * as fs from "fs/promises";
import path from "path";
import { getSdkPath, spawnByLine, readByLine } from "./util.js";
import { globby } from "globby";

let developer_key;
if (process.argv.length >= 3) {
  developer_key = process.argv[2];
}
async function test() {
  const sdk = await getSdkPath();
  const samples = path.resolve(sdk, "samples");
  const dest = "./generated/test";

  async function build_one(manifest, bin) {
    console.log(`Building ${manifest} into ${bin}`);

    const project = manifest.replace(/^.*\/(.*)\/manifest.xml/, "$1");
    const root = manifest.replace(/\/manifest.xml$/, "");
    const products = [];
    await readByLine(manifest, (line) => {
      const m = /^\s*<iq:product\s+id="(.*?)"\s*\/>/.exec(line);
      if (m) products.push(m[1]);
    });
    const program = path.resolve(root, bin, `${project}.prg`);
    await spawnByLine(
      path.resolve(sdk, "bin", "monkeyc"),
      [
        ["-o", program],
        ["-f", path.resolve(root, "monkey.jungle")],
        ["-y", developer_key],
        // "-w",
        ["-l", "1"],
        ["-d", `${products[0]}_sim`],
        "-r",
      ].flat(),
      (line) => console.log(line)
    );
    return program;
  }

  const results = [];
  if (true) {
    await fs.rm(dest, { recursive: true, force: true });
    await fs.cp(samples, dest, { recursive: true });

    let promises = [];
    const build_some = async (root, bin) => {
      (await globby(`${root}/*/manifest.xml`)).forEach((manifest, index) => {
        const MAX_CONCURRENT_COMPILES = 4;
        const doit = () =>
          build_one(manifest, bin).then((result) => results.push(result));
        if (promises.length < MAX_CONCURRENT_COMPILES) {
          promises.push(doit());
        } else {
          const i = index % MAX_CONCURRENT_COMPILES;
          promises[i] = promises[i].then(doit);
        }
      });
    };

    // first build everything from the original source
    await build_some(dest, "bin-original");
    await Promise.all(promises);

    // then prettify everything
    const args = [
      "prettier",
      "--write",
      ["--plugin", "build/prettier-plugin-monkeyc.cjs"],
      await globby(`${dest}/**/*.mc`),
    ].flat();
    console.log("Prettying files");
    await spawnByLine("npx", args, (line) => console.log(line.toString()));

    // finally build again
    await build_some(dest, "bin-pretty");
    await Promise.all(promises);
  } else {
    (await globby([`${dest}/*/bin-*/*.prg`])).forEach((result) =>
      results.push(result)
    );
  }
  const groups = results
    .sort((a, b) => {
      const aa = a.replace(/^.*\//, "");
      const bb = b.replace(/^.*\//, "");
      return aa < bb ? -1 : aa > bb ? 1 : 0;
    })
    .reduce(
      (state, item) => {
        state[1].push(item);
        if (state[1].length == 2) {
          state[0].push(state[1]);
          state[1] = [];
        }
        return state;
      },
      [[], []]
    )[0];
  let allPass = true;
  const promises = [];
  groups.forEach((pair) => {
    const [a, b] = pair.sort();
    promises.push(
      Promise.all([fs.readFile(a), fs.readFile(b)]).then(([adata, bdata]) => {
        const pass = Buffer.compare(adata, bdata) === 0;
        if (!pass) allPass = false;
        console.log(
          `Comparing '${a}' with '${b}': ${pass ? "...Match" : "...FAILED"}`
        );
      })
    );
  });

  await Promise.all(promises);

  if (!allPass) {
    throw "Tests Failed: Some binaries were not the same!";
  }

  return;
}

test()
  .then(() => console.log("Success!"))
  .catch((e) => console.log("Failed:", e));
