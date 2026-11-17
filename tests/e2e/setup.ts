import { mkdir, writeFile } from "node:fs/promises";
import { seedDemo } from "../../lib/demo";
export default async function setup() {
  await mkdir(".demo-data", { recursive: true });
  await writeFile(
    ".demo-data/state-e2e.json",
    JSON.stringify(seedDemo(), null, 2),
  );
}
