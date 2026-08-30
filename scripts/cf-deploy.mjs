import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const workerPath = path.join(".cf-build", ".open-next", "worker.js");
const nestedHandler = "./server-functions/default/.cf-build/handler.mjs";
const defaultHandler = "./server-functions/default/handler.mjs";

const build = spawnSync("npx", ["opennextjs-cloudflare", "build"], {
  stdio: "inherit",
  shell: true,
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

let worker = fs.readFileSync(workerPath, "utf8");
if (
  worker.includes(defaultHandler) &&
  fs.existsSync(path.join(".cf-build", ".open-next", "server-functions", "default", ".cf-build", "handler.mjs"))
) {
  worker = worker.replaceAll(defaultHandler, nestedHandler);
  fs.writeFileSync(workerPath, worker);
}

const deploy = spawnSync("npx", ["wrangler", "deploy", "--keep-vars"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, OPEN_NEXT_DEPLOY: "true" },
});
process.exit(deploy.status ?? 1);
