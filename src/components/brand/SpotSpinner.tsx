export function SpotSpinner({
  size = "md",
  className = "",
}: {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const dim = size === "xs" ? 14 : size === "sm" ? 16 : size === "lg" ? 32 : 20;
  const weight = size === "lg" ? 1.7 : 1.55;
  const pin = size === "lg" ? 2.35 : 2.05;

  return (
    <span
      className={`sk-spin ${className}`}
      style={{ width: dim, height: dim }}
      role="status"
      aria-label="Loading"
    >
      <svg viewBox="0 0 32 32" width={dim} height={dim} aria-hidden>
        <circle
          cx="16"
          cy="16"
          r="11"
          fill="none"
          stroke="currentColor"
          strokeWidth={weight}
          opacity="0.16"
        />
        <circle
          className="sk-spin-arc"
          cx="16"
          cy="16"
          r="11"
          fill="none"
          stroke="currentColor"
          strokeWidth={weight}
          strokeLinecap="round"
          strokeDasharray="16.5 52"
        />
        <circle cx="16" cy="16" r={pin} fill="currentColor" />
      </svg>
    </span>
  );
}
