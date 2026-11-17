import { adminAuth } from "../lib/firebase-admin";
async function main() {
  if (process.env.AMS_STORE !== "firestore")
    throw new Error(
      "Administrator provisioning requires explicit Firestore mode",
    );
  const email = process.env.AMS_ADMIN_EMAIL;
  const tenantId = process.env.AMS_SEED_TENANT;
  if (!email || !tenantId || !/^[\w-]{1,80}$/.test(tenantId))
    throw new Error("Set AMS_ADMIN_EMAIL and a valid AMS_SEED_TENANT");
  const auth = adminAuth();
  const user = await auth.getUserByEmail(email);
  if (user.disabled) throw new Error("Cannot provision a disabled user");
  if (user.customClaims?.tenantId && user.customClaims.tenantId !== tenantId)
    throw new Error("User already belongs to a different tenant");
  await auth.setCustomUserClaims(user.uid, {
    ...user.customClaims,
    role: "tenant_admin",
    tenantId,
  });
  console.log(
    "Administrator provisioned in the explicitly confirmed demo project. Sign in again to refresh claims.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
