import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginPanel } from "@/components/auth/login-panel";

export default async function LoginPage() {
  const session = await auth();
  if (session) {
    redirect("/inbox");
  }

  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <LoginPanel googleEnabled={googleEnabled} />
    </div>
  );
}
