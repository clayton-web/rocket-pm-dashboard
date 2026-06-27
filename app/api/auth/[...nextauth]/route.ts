import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { withAuthRequestBasePath } from "@/lib/auth/auth-request-base-path";

export async function GET(req: NextRequest) {
  return handlers.GET(withAuthRequestBasePath(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(withAuthRequestBasePath(req));
}
