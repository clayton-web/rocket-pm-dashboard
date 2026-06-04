import { auth } from "@/auth";
import { OnboardingCommandCenter } from "@/components/leasing/onboarding-command-center";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import {
  getOnboardingCommandCenterForStaff,
  isOnboardingQueueParam,
} from "@/lib/leasing/onboarding-command-center.service";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ queue?: string }>;
};

export default async function LeasingOnboardingPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;
  const queue = isOnboardingQueueParam(params.queue) ? params.queue : null;

  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <OnboardingCommandCenter
        data={null}
        queue={queue}
        loadError="Select an active organization to view onboarding."
      />
    );
  }

  try {
    const data = await getOnboardingCommandCenterForStaff(ctx, queue);
    return <OnboardingCommandCenter data={data} queue={queue} loadError={null} />;
  } catch {
    return (
      <OnboardingCommandCenter
        data={null}
        queue={queue}
        loadError="Could not load onboarding command center."
      />
    );
  }
}
