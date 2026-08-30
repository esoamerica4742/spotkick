import { formatNaira } from "./format";
import { teamConfig, type TeamId } from "./teams";

export type FlashBounty = {
  id: string;
  creator_id: string;
  creator_name: string;
  stake_amount: number;
  team_id: TeamId;
  match_id: string;
  status: "open" | "claimed" | "cancelled";
  share_url: string;
  created_at: string;
  claimed_at: string | null;
  claimed_by: string | null;
};

export function flashBountyClipboard(input: {
  stake: number;
  teamId: TeamId;
  url: string;
}): string {
  const kit = teamConfig(input.teamId).name;
  return [
    "SPOTKICKA FLASH BOUNTY",
    "",
    `I locked ${formatNaira(input.stake)} as ${kit}.`,
    "Human 1v1. No bots. Winner takes 90%.",
    "",
    "Tap in if you can stop this from the spot:",
    input.url,
  ].join("\n");
}

export function bountyUrl(origin: string, id: string): string {
  return `${origin.replace(/\/$/, "")}/bounty/${id}`;
}
