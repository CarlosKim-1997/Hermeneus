import type { CreatorPrincipal } from "./types.js";

export interface CreatorSessionProvider {
  getCurrentPrincipal(): Promise<CreatorPrincipal | undefined>;
}
