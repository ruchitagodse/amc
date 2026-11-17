import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
// Adapted from source auth-session/firebase-admin; no default source credentials.
export function adminApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (
    !projectId ||
    !process.env.AMS_FIREBASE_PROJECT_CONFIRM ||
    projectId !== process.env.AMS_FIREBASE_PROJECT_CONFIRM
  )
    throw new Error(
      "Configure and explicitly confirm a separate demo Firebase project",
    );
  if (process.env.FIRESTORE_EMULATOR_HOST && !projectId.startsWith("demo-"))
    throw new Error("Emulators require a demo- project id");
  return (
    getApps().find((a) => a.name === "ams-independent") ||
    initializeApp(
      {
        projectId,
        ...(process.env.FIRESTORE_EMULATOR_HOST
          ? {}
          : {
              credential: cert({
                projectId,
                clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
                  /\\n/g,
                  "\n",
                ),
              }),
            }),
      },
      "ams-independent",
    )
  );
}
export const adminAuth = () => getAuth(adminApp());
export const firestore = () => getFirestore(adminApp());
