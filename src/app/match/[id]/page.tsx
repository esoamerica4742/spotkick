import { MatchRoom } from "@/components/match/MatchRoom";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Match",
};

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchRoom matchId={id} />;
}
