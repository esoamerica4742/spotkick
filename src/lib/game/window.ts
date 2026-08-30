import { CHOICE_WINDOW_MS, KEEPER_REACT_MS } from "@/lib/constants";

export function choiceWindowMs(role: "shooter" | "keeper"): number {
  return role === "keeper" ? KEEPER_REACT_MS : CHOICE_WINDOW_MS;
}

export function isReactWindow(windowMs: number): boolean {
  return windowMs <= KEEPER_REACT_MS + 50;
}
