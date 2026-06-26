import { clearSession } from "@/server/auth/session";
import { relativeRedirect } from "@/server/http/redirect";

export async function POST() {
  await clearSession();
  return relativeRedirect("/login");
}
