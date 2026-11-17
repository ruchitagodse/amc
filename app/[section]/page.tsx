import { notFound } from "next/navigation";
import { Workspace, type View } from "@/components/workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (
    ![
      "inventory",
      "categories",
      "vendors",
      "allocations",
      "history",
      "repairs",
    ].includes(section)
  )
    notFound();
  return <Workspace view={section as View} />;
}
