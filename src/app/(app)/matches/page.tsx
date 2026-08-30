import { MatchesClient } from "@/components/market/MatchesClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Matches" };

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string | string[] }>;
}) {
  const params = await searchParams;
  const create = params.create;
  const openCreate = Array.isArray(create) ? create[0] === "1" : create === "1";
  return <MatchesClient openCreate={openCreate} />;
}
