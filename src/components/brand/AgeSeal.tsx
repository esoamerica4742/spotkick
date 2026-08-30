export function AgeSeal() {
  return (
    <div
      aria-label="18 plus. Adults only."
      className="relative isolate shrink-0"
    >
      <div className="rounded-full bg-[linear-gradient(180deg,#f7e7b4_0%,#d4b15c_38%,#8a691e_72%,#f0d78a_100%)] p-[1px] shadow-[0_0_18px_rgba(232,197,71,0.28),0_8px_18px_rgba(0,0,0,0.35)]">
        <div className="flex h-8 items-center gap-1.5 rounded-full bg-[linear-gradient(180deg,rgba(18,16,10,0.92),rgba(6,6,6,0.88))] px-2.5 backdrop-blur-xl">
          <span className="size-[5px] rounded-full bg-[radial-gradient(circle_at_30%_30%,#fff6d2,#e8c547_55%,#8a691e)] shadow-[0_0_8px_rgba(232,197,71,0.8)]" />
          <span className="font-display text-[13px] leading-none tracking-[0.04em] text-[#e8c547]">
            18+
          </span>
          <span className="h-3 w-px bg-gradient-to-b from-transparent via-[#e8c547]/55 to-transparent" />
          <span className="text-[10px] font-semibold leading-none tracking-[0.12em] text-[#f0d78a] uppercase">
            Adults
          </span>
        </div>
      </div>
    </div>
  );
}
