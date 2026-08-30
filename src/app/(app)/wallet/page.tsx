import { WalletClient } from "@/components/wallet/WalletClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage() {
  return <WalletClient />;
}
