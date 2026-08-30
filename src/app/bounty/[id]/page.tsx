import { BountyClient } from "@/components/bounty/BountyClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flash Bounty",
};

export default async function BountyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BountyClient bountyId={id} />;
}
