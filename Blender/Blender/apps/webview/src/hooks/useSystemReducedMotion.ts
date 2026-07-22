import { useEffect, useState } from "react";

export function useSystemReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() => getReducedMotionPreference());

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setReducedMotion(query.matches);

    handleChange();
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return reducedMotion;
}

function getReducedMotionPreference(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
