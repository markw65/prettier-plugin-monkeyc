import * as child_process from "child_process";
import * as fs from "fs/promises";
import * as readline from "readline";

const isWin = process.platform == "win32";

export const connectiq = isWin
  ? `${process.env.APPDATA}/Garmin/ConnectIQ`.replace(/\\/g, "/")
  : `${process.env.HOME}/Library/Application Support/Garmin/ConnectIQ`;

export function getSdkPath() {
  return fs
    .readFile(connectiq + "/current-sdk.cfg")
    .then((contents) => contents.toString().replace(/^\s*(.*?)\s*$/s, "$1"));
}

async function modified_times(inputs, missing) {
  return Promise.all(
    inputs.map(async (path) => {
      try {
        const stat = await fs.stat(path);
        return stat.mtimeMs;
      } catch {
        return missing;
      }
    })
  );
}

export async function last_modified(inputs) {
  return Math.max(...(await modified_times(inputs, Infinity)));
}

export async function first_modified(inputs) {
  return Math.min(...(await modified_times(inputs, 0)));
}

// return a promise that will process the output of command
// line-by-line via lineHandler.
export function spawnByLine(command, args, lineHandler) {
  return new Promise((resolve, reject) => {
    const proc = child_process.spawn(command, args, { shell: false });
    const rl = readline.createInterface({
      input: proc.stdout,
    });
    proc.on("error", reject);
    proc.stderr.on("data", (data) => console.error(data.toString()));
    rl.on("line", lineHandler);
    proc.on("close", (code) => {
      if (code == 0) resolve();
      reject(code);
    });
  });
}

// return a promise that will process file
// line-by-line via lineHandler.
export function readByLine(file, lineHandler) {
  return fs.open(file).then(
    (fh) =>
      new Promise((resolve, _reject) => {
        const stream = fh.createReadStream();
        const rl = readline.createInterface({
          input: stream,
        });
        rl.on("line", lineHandler);
        stream.on("close", resolve);
      })
  );
}
