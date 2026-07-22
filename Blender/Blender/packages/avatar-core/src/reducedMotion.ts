export type MatchMediaEnvironment = {
  matchMedia?: (query: string) => { matches: boolean };
};

export function shouldReduceMotion(
  preference: "system" | "always" | "never",
  environment: MatchMediaEnvironment | undefined = globalThis as MatchMediaEnvironment
): boolean {
  if (preference === "always") {
    return true;
  }

  if (preference === "never") {
    return false;
  }

  return Boolean(
    typeof environment.matchMedia === "function" && environment.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
