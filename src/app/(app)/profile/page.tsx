import { ProfileClient } from "@/components/profile/ProfileClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default function ProfilePage() {
  return <ProfileClient />;
}
