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
import { default as MonkeyC } from "../build/prettier-plugin-monkeyc.cjs";

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
  let validate_locations = false;
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
        case "validate-locations":
          validate_locations = /^(true|1|yes)$/i.test(match[2]);
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

  if (validate_locations) {
    await validate(projects);
    return;
  }

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
    let promise = Promise.resolve();
    const programs = [];
    products.forEach((product) => {
      const program = path.resolve(root, bin, `${project}-${product}.prg`);
      console.log(`Building ${root} into ${program}`);
      promise = promise.then(() => {
        programs.push(program);
        return spawnByLine(
          path.resolve(sdk, "bin", "monkeyc"),
          [
            ["-o", program],
            ["-f", settings["monkeyC.jungleFiles"] || "monkey.jungle"],
            ["-y", developer_key],
            // "-w",
            //["-l", "1"],
            ["-d", `${product}_sim`],
            mode || [],
          ].flat(),
          (line) => console.log(line),
          { cwd: root }
        );
      });
    });
    await promise;
    return programs;
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

function error(node, message, path) {
  throw new Error(
    `Node ${node.type} ${message} at ${path
      .map(
        (n) =>
          `\n - ${n.type}: ${n.loc.source}:${n.loc.start.line},${n.loc.start.column}`
      )
      .join("")}`
  );
}

function checkNode(node, path) {
  if (!node.loc) {
    error(node, "has no location", path);
  }
  if (!node.loc.source) {
    error(node, "has no source", path);
  }
  if (!node.loc.start || !node.loc.end) {
    error(node, "is missing loc.start or loc.end", path);
  }
  if (
    node.start !== node.loc.start.offset ||
    node.end !== node.loc.end.offset
  ) {
    error(node, "offsets disagree", path);
  }
}

function validateHelper(node, path) {
  const kids = [];
  for (const [key, value] of Object.entries(node)) {
    if (!value || key === "comments") continue;
    if (Array.isArray(value)) {
      kids.push(...value.filter((kid) => typeof kid == "object" && kid.type));
    } else if (typeof value == "object" && value.type) {
      kids.push(value);
    }
  }
  if (!kids.length) return 1;
  kids.sort((a, b) => (a.start || 0) - (b.start || 0));
  path.push(node);
  kids.reduce((prev, cur) => {
    checkNode(cur, path);
    if (!prev) return cur;
    if (prev.end > cur.start) {
      error(prev, `overlaps with ${cur.type}. end-offset > start`, path);
    }
    if (
      prev.loc.end.line > cur.loc.start.line ||
      (prev.loc.end.line === cur.loc.start.line &&
        prev.loc.end.column > cur.loc.start.column)
    ) {
      error(prev, `overlaps with ${cur.type}. end-line/char > start`, path);
    }
  }, null);
  path.pop();
  if (kids[0].start < node.start || kids[kids.length - 1].end > node.end) {
    error(node, `does not contain its children (offset based)`, path);
  }
  if (
    kids[0].loc.start.line < node.loc.start.line ||
    (kids[0].loc.start.line === node.loc.start.line &&
      kids[0].loc.start.column < node.loc.start.column) ||
    kids[kids.length - 1].loc.end.line > node.loc.end.line ||
    (kids[kids.length - 1].loc.end.line === node.loc.end.line &&
      kids[kids.length - 1].loc.end.column > node.loc.end.column)
  ) {
    error(node, `does not contain its children (line/char based)`, path);
  }
  path.push(node);
  const numNodesProcessed = kids.reduce(
    (num, kid) => num + validateHelper(kid, path),
    1
  );
  path.pop(node);
  return numNodesProcessed;
}

function validate(projects) {
  return globby(projects, {
    expandDirectories: false,
    onlyDirectories: true,
  })
    .then((projects) =>
      Promise.all(
        projects.map((project) => globby(path.resolve(project, "**/*.mc")))
      )
    )
    .then((files) =>
      Promise.all(
        files.flat().map((file) =>
          fs.readFile(file).then((data) => {
            const ast = MonkeyC.parsers.monkeyc.parse(data.toString(), null, {
              filepath: file,
            });
            const numNodes = validateHelper(ast, []);
            console.log(`Validated ${numNodes} locations for ${file}.`);
          })
        )
      )
    );
}

test()
  .then(() => console.log("Success!"))
  .catch((e) => console.log("Failed:", e));
