import { APP_NAME } from "@/lib/constants";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const type = {
    sm: "text-[1.18rem] tracking-[0.06em]",
    md: "text-[1.65rem] tracking-[0.08em]",
    lg: "text-5xl tracking-[0.08em]",
  };

  return (
    <p className={`${type[size]} font-display uppercase leading-none text-white`}>
      SPOT
      <span className="text-[#e8c547]">KICKA</span>
      <span className="sr-only">{APP_NAME}</span>
    </p>
  );
}
