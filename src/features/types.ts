import type { Aether } from "../lib/useAether";
export interface FeatureProps {
  a: Aether;
  run: (work: () => Promise<unknown>, success?: string) => void;
  navigate?: (page: string) => void;
}
