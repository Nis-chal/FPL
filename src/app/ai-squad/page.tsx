import { redirect } from "next/navigation";

/** Legacy alias → /ai */
export default function AiSquadRedirectPage() {
  redirect("/ai");
}
