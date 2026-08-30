import { EntryRedirect } from "@/components/auth/EntryRedirect";
import { LandingPage } from "@/components/landing/LandingPage";

export default function HomePage() {
  return (
    <>
      <EntryRedirect />
      <LandingPage />
    </>
  );
}
