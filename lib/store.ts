import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { emptyState, type State } from "./domain";
import { qrTokenHash } from "./qr-token";
import {
  publicAssetCard,
  QR_TOKEN_PATTERN,
  type PublicAsset,
} from "./public-asset";
import { ConflictError } from "@/shared/errors";
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
const stateRef = async (tenant: string) => {
  const { firestore } = await import("./firebase-admin");
  return firestore().doc(`amsTenants/${tenant}/state/current`);
};
export async function readState(tenant: string): Promise<State> {
  if (isFirebase())
    return (
      ((await (await stateRef(tenant)).get()).data() as State) || emptyState()
    );
  return serialized(readLocal);
}
export async function mutateState(
  tenant: string,
  fn: (state: State) => State,
): Promise<State> {
  if (isFirebase()) {
    const { firestore } = await import("./firebase-admin");
    const ref = await stateRef(tenant);
    return firestore().runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const previous = (snapshot.data() as State) || emptyState();
      const next = fn(previous);
      const changes = next.assets.filter(
        (a) =>
          a.qrToken !== previous.assets.find((old) => old.id === a.id)?.qrToken,
      );
      // Read all new lookup documents before any transaction writes.
      for (const asset of changes.filter((a) => !!a.qrToken)) {
        const index = firestore().doc(
          `amsQrLinks/${qrTokenHash(asset.qrToken!)}`,
        );
        const current = await tx.get(index);
        if (
          current.exists &&
          (current.get("tenantId") !== tenant ||
            current.get("assetId") !== asset.id)
        )
          throw new ConflictError("QR token collision");
      }
      if (Buffer.byteLength(JSON.stringify(next)) > 850_000)
        throw new Error(
          "Demo storage capacity reached; split collections before expanding this deployment",
        );
      for (const asset of changes) {
        const old = previous.assets.find((a) => a.id === asset.id)?.qrToken;
        if (old) tx.delete(firestore().doc(`amsQrLinks/${qrTokenHash(old)}`));
        if (asset.qrToken)
          tx.set(firestore().doc(`amsQrLinks/${qrTokenHash(asset.qrToken)}`), {
            tenantId: tenant,
            assetId: asset.id,
          });
      }
      tx.set(ref, next);
      return next;
    });
  }
  return serialized(async () => {
    const next = fn(await readLocal());
    await mkdir(path.dirname(localPath), { recursive: true });
    const tmp = `${localPath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(next, null, 2));
    await rename(tmp, localPath);
    return next;
  });
}

export async function readPublicAsset(
  token: string,
): Promise<PublicAsset | null> {
  if (!QR_TOKEN_PATTERN.test(token)) return null;
  if (isFirebase()) {
    const { firestore } = await import("./firebase-admin");
    const lookup = await firestore()
      .doc(`amsQrLinks/${qrTokenHash(token)}`)
      .get();
    if (!lookup.exists) return null;
    const { tenantId, assetId } = lookup.data()!;
    if (
      typeof tenantId !== "string" ||
      typeof assetId !== "string" ||
      !/^[\w-]{1,80}$/.test(tenantId)
    )
      return null;
    const state = await readState(tenantId);
    const asset = state.assets.find(
      (a) => a.id === assetId && a.qrToken === token && !a.qrRevokedAt,
    );
    return asset ? publicAssetCard(state, asset) : null;
  }
  return serialized(async () => {
    const state = await readLocal();
    const asset = state.assets.find(
      (a) => a.qrToken === token && !a.qrRevokedAt,
    );
    return asset ? publicAssetCard(state, asset) : null;
  });
}
