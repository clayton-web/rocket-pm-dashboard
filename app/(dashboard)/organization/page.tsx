import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { getOrganizationLandlordProfileForStaff } from "@/lib/org/organization-landlord-profile";
import { hasOrgWidePropertyRights } from "@/lib/services/property-access";
import { OrganizationLandlordProfileForm } from "@/components/leasing/organization-landlord-profile-form";
import { InlineNotice } from "@/components/portal/ui";

export default async function OrganizationPage() {
  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <div className="mx-auto max-w-3xl">
        <InlineNotice>Sign in and select an organization to manage settings.</InlineNotice>
      </div>
    );
  }

  const profile = await getOrganizationLandlordProfileForStaff(ctx);
  const canEdit = hasOrgWidePropertyRights(ctx);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Organization</h1>
        <p className="mt-1 text-sm text-neutral-600">{profile.organizationName}</p>
      </div>
      <OrganizationLandlordProfileForm initialProfile={profile} canEdit={canEdit} />
    </div>
  );
}
