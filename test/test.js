/*
 * The main test method is to compile all the garmin samples before and after
 * prettying the source, and then verifying that the binaries are identical.
 *
 * It turns out that debug builds tend to differ anyway, so we have to do release
 * builds. Also, builds in different locations differ, so both builds have to
 * have the sources in the same place (ie you can't make two copies of the samples,
 * and compile them separately).
 *
 * I've created a project that I can add problem cases to - eg at one point
 * '1 << (x % 3)' incorrectly dropped the parentheses because the precedence
 * is different in monkeyc vs javascript. For those, it both compares the
 * binaries and runs the project in unit test mode. The latter /should/ be
 * redundant, but I had some issues at one point where my code was (apparently)
 * being optimized out entirely in release mode - so the binaries were identical
 * even though the source code had changed (beyond just formatting).
 */

import * as fs from "fs/promises";
import path from "path";
import { getSdkPath, spawnByLine, readByLine, appSupport } from "./util.js";
import { globby } from "globby";

let developer_key;

async function getSettings(path) {
  try {
    const settings = await fs.readFile(path);
    return JSON.parse(settings.toString());
  } catch (e) {
    return {};
  }
}

async function test() {
  const sdk = await getSdkPath();
  const projects = [];
  let build_all = false;
  process.argv.slice(2).forEach((arg) => {
    const match = /^--((?:\w|-)+)=(.*)$/.exec(arg);
    if (match) {
      switch (match[1]) {
        case "dev-key":
          developer_key = match[2];
          break;
        case "projects":
          projects.push(match[2]);
          break;
        case "build-all":
          // should we build each product for every supported device,
          // or just pick one device for each product.
          build_all = /^(true|1|yes)$/i.test(match[2]);
          break;
      }
    }
  });
  if (!projects.length) {
    projects.push(`${sdk}/samples/*`, "./test/test-cases");
  }
  const global_settings = await getSettings(
    `${appSupport}/Code/User/settings.json`
  );
  /*
  if (!developer_key) {
    developer_key =
      (await getDevKey(".vscode/settings.json")) ||
      ();
  }
  if (!developer_key) {
    throw "Failed to find developer key; please specify its location via --dev-key=<path>";
  }
  */

  const dest = "./build/test";

  async function build_one(manifest, bin, mode) {
    const project = manifest.replace(/^.*\/(.*)\/manifest.xml/, "$1");
    const root = manifest.replace(/\/manifest.xml$/, "");
    const settings = {
      ...global_settings,
      ...(await getSettings(`${root}/.vscode/settings.json`)),
    };
    if (!developer_key) {
      developer_key = settings["monkeyC.developerKeyPath"];
    }
    if (!developer_key) {
      console.log(
        `No developer key found for ${root}. Set it via "monkeyC.developerKeyPath" in VSCode User Settings, or via --dev-key=<path>`
      );
      return null;
    }
    const products = [];
    await readByLine(manifest, (line) => {
      const m = /^\s*<iq:product\s+id="(.*?)"\s*\/>/.exec(line);
      if (m) products.push(m[1]);
    });
    if (!build_all) {
      products.splice(1);
    }
    return Promise.all(
      products.map(async (product) => {
        const program = path.resolve(root, bin, `${project}-${product}.prg`);
        console.log(`Building ${root} into ${program}`);
        await spawnByLine(
          path.resolve(sdk, "bin", "monkeyc"),
          [
            ["-o", program],
            ["-f", settings["monkeyC.jungleFiles"] || "monkey.jungle"],
            ["-y", developer_key],
            // "-w",
            ["-l", "1"],
            ["-d", `${products[0]}_sim`],
            mode || [],
          ].flat(),
          (line) => console.log(line),
          { cwd: root }
        );
        return program;
      })
    );
  }

  const promises = [];
  const build_some = async (root, bin, mode, tests) => {
    (await globby(`${root}/${tests || "*"}/manifest.xml`)).forEach(
      (manifest, index) => {
        const MAX_CONCURRENT_COMPILES = 4;
        const doit = () =>
          build_one(manifest, bin, mode).then((result) =>
            results.push(...result)
          );
        if (promises.length < MAX_CONCURRENT_COMPILES) {
          promises.push(doit());
        } else {
          const i = index % MAX_CONCURRENT_COMPILES;
          promises[i] = promises[i].then(doit);
        }
      }
    );
  };

  const results = [];
  // change true to false below to re-run the checking portion
  // without having to rebuild everything.
  if (true /* eslint-disable-line */) {
    await fs.rm(dest, { recursive: true, force: true });
    console.log(`Copying projects: ${JSON.stringify(projects)}`);
    await fs.mkdir(dest, { recursive: true });
    await Promise.all(
      (
        await globby(projects, {
          expandDirectories: false,
          onlyDirectories: true,
        })
      ).map((project) => {
        return fs.cp(project, dest + project.replace(/^.*(\/.*)$/, "$1"), {
          recursive: true,
        });
      })
    );

    // first build everything from the original source
    console.log("\nBuilding original sources");
    await build_some(dest, "bin-original", "-r");
    await Promise.all(promises);

    // then prettify everything
    const args = [
      "prettier",
      "--write",
      ["--plugin", "build/prettier-plugin-monkeyc.cjs"],
      await globby(`${dest}/**/*.mc`),
    ].flat();
    console.log("\nPrettying files");
    await spawnByLine("npx", args, (line) =>
      console.log("prettify: " + line.toString())
    );

    // finally build again
    console.log("\nBuilding prettier sources");
    await build_some(dest, "bin-pretty", "-r");
    await Promise.all(promises);
  } else {
    (await globby([`${dest}/*/bin-*/*.prg`])).forEach((result) =>
      results.push(result)
    );
  }
  console.log("");
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
  promises.splice(0);
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

  console.log("\nBuilds were identical. Running any unit tests now...\n");
  await spawnByLine(path.resolve(sdk, "bin", "connectiq"), [], console.log);
  promises.splice(0);
  results.splice(0);
  await build_some(dest, "bin-pretty", "--unit-test", "test-cases");
  await Promise.all(promises);
  let promise = Promise.resolve(true);
  results.forEach((product) => {
    const device = product.replace(/^.*-(.*).prg/, "$1");
    promise = promise.then((status) => {
      let ok = null;
      return spawnByLine(
        path.resolve(sdk, "bin", "monkeydo"),
        [product, device, "-t"],
        (line) => {
          console.log(line);
          if (/^PASSED /.test(line)) {
            ok = true;
          } else if (/^FAILED /.test(line)) {
            ok = false;
          }
        }
      ).then(() => {
        if (ok == null) {
          return null;
        }
        return status && ok;
      });
    });
  });

  const result = await promise;

  if (result === null) {
    throw "At least one test failed to report success or failure. Maybe a problem with the simulator?";
  }

  if (result === false) {
    throw "A unit test failed!";
  }

  return;
}

test()
  .then(() => console.log("Success!"))
  .catch((e) => console.log("Failed:", e));
