import { PracticeMatch } from "@/components/match/PracticeMatch";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Practice",
};

export default function PracticePage() {
  return <PracticeMatch />;
}
