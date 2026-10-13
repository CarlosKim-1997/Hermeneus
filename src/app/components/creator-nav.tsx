import { CreatorNavLinks } from "./creator-nav-links";
import { getOptionalCreatorSessionPage } from "../../application/creator-page-guards.js";

export async function CreatorNav() {
  const principal = await getOptionalCreatorSessionPage();
  if (!principal) return null;

  return <CreatorNavLinks activeCreator={principal.lifecycleStatus === "active"} />;
}
