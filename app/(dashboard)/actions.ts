"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { setActiveOrganizationId } from "@/lib/org/active-organization";

export async function switchOrganizationAction(formData: FormData) {
  const organizationId = formData.get("organizationId");
  if (typeof organizationId !== "string" || organizationId.length === 0) {
    throw new Error("organizationId required");
  }
  await setActiveOrganizationId(organizationId);
  revalidatePath("/", "layout");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
