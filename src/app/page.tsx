import { redirect } from "next/navigation";
import { getOptionalCreatorSessionPage } from "../application/creator-page-guards";

export default async function HomePage() {
  const principal = await getOptionalCreatorSessionPage();
  if (principal) redirect("/handoffs");
  redirect("/login");
}
