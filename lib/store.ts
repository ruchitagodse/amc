import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { firestore } from "./firebase-admin";
import { emptyState, type State } from "./domain";
export const isFirebase = () => process.env.AMS_STORE === "firestore";
const namespace = process.env.AMS_DEMO_NAMESPACE || "";
if (namespace && !/^[a-z0-9-]{1,30}$/.test(namespace))
  throw new Error("Invalid demo namespace");
const localPath = path.join(
  process.cwd(),
  ".demo-data",
  namespace ? `state-${namespace}.json` : "state.json",
);
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}
async function readLocal(): Promise<State> {
  try {
    return JSON.parse(await readFile(localPath, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
    throw e;
  }
}
const stateRef = (tenant: string) =>
  firestore().doc(`amsTenants/${tenant}/state/current`);
export async function readState(tenant: string): Promise<State> {
  if (isFirebase())
    return ((await stateRef(tenant).get()).data() as State) || emptyState();
  return serialized(readLocal);
}
export async function mutateState(
  tenant: string,
  fn: (state: State) => State,
): Promise<State> {
  if (isFirebase())
    return firestore().runTransaction(async (tx) => {
      const ref = stateRef(tenant);
      const snapshot = await tx.get(ref);
      const next = fn((snapshot.data() as State) || emptyState());
      if (Buffer.byteLength(JSON.stringify(next)) > 850_000)
        throw new Error(
          "Demo storage capacity reached; split collections before expanding this deployment",
        );
      tx.set(ref, next);
      return next;
    });
  return serialized(async () => {
    const next = fn(await readLocal());
    await mkdir(path.dirname(localPath), { recursive: true });
    const tmp = `${localPath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(next, null, 2));
    await rename(tmp, localPath);
    return next;
  });
}
