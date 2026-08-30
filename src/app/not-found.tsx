import { ScreenState } from "@/components/brand/ScreenState";

export default function NotFound() {
  return (
    <ScreenState
      title="404"
      body="That page is not on this pitch."
      actionHref="/"
      actionLabel="Back to the spot"
    />
  );
}
