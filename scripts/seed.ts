import { seedDemo } from "../lib/demo";
import { mutateState, isFirebase } from "../lib/store";
if (isFirebase() && !process.env.AMS_SEED_TENANT)
  throw new Error("Set AMS_SEED_TENANT to the isolated demo tenant");
mutateState(process.env.AMS_SEED_TENANT || "fictional-demo", seedDemo)
  .then((s) =>
    console.log(
      `Demo ready: ${s.assets.length} assets, ${s.employees.length} employees, ${s.vendors.length} vendors. Existing records preserved.`,
    ),
  )
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
