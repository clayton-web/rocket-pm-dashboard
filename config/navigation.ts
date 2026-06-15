/**
 * Central navigation registry. Add modules here without restructuring the shell.
 * `enabled: false` keeps future routes visible in code but hidden from the UI.
 */
export type NavModuleId =
  | "inbox"
  | "email"
  | "aiResponder"
  | "inspections"
  | "maintenance"
  | "properties"
  | "leasing"
  | "tenantApps"
  | "documents"
  | "crm"
  | "notifications"
  | "finance"
  | "settings";

export type NavItem = {
  id: string;
  /** Stable id for permissions, analytics, and integration boundaries */
  moduleId: NavModuleId;
  label: string;
  href: string;
  /** When false, item is omitted from the sidebar (stub for upcoming work). */
  enabled: boolean;
  section: "command" | "operations" | "growth" | "system";
  minimumRole?: "MEMBER" | "ADMIN";
  /** Reserved for Rocket Logic tooling routes */
  platformOnly?: boolean;
};

export const navigationItems: NavItem[] = [
  {
    id: "nav-inbox",
    moduleId: "inbox",
    label: "Inbox",
    href: "/inbox",
    enabled: true,
    section: "command",
    minimumRole: "MEMBER",
  },
  {
    id: "nav-email",
    moduleId: "email",
    label: "Gmail",
    href: "/email",
    enabled: true,
    section: "command",
    minimumRole: "MEMBER",
  },
  {
    id: "nav-ai-responder",
    moduleId: "aiResponder",
    label: "AI responder",
    href: "/responder",
    enabled: false,
    section: "command",
    minimumRole: "MEMBER",
  },
  {
    id: "nav-inspections",
    moduleId: "inspections",
    label: "Inspections",
    href: "/modules/inspections",
    enabled: false,
    section: "operations",
    minimumRole: "MEMBER",
  },
  {
    id: "nav-maintenance",
    moduleId: "maintenance",
    label: "Maintenance",
    href: "/maintenance",
    enabled: true,
    section: "operations",
    minimumRole: "MEMBER",
  },
  {
    id: "nav-properties",
    moduleId: "properties",
    label: "Properties",
    href: "/properties",
    enabled: true,
    section: "operations",
    minimumRole: "ADMIN",
  },
  {
    id: "nav-properties-health",
    moduleId: "properties",
    label: "Property health",
    href: "/properties/health",
    enabled: true,
    section: "operations",
    minimumRole: "ADMIN",
  },
  {
    id: "nav-leasing-dashboard",
    moduleId: "leasing",
    label: "Leasing",
    href: "/leasing",
    enabled: true,
    section: "operations",
    minimumRole: "MEMBER",
  },
  {
    id: "nav-leasing-prospects",
    moduleId: "leasing",
    label: "Viewing requests",
    href: "/leasing/prospects",
    enabled: true,
    section: "operations",
    minimumRole: "MEMBER",
  },
  {
    id: "nav-tenant-apps",
    moduleId: "tenantApps",
    label: "Applications",
    href: "/leasing/applications",
    enabled: true,
    section: "operations",
    minimumRole: "MEMBER",
  },
  {
    id: "nav-leasing-tenancies",
    moduleId: "leasing",
    label: "Tenancies",
    href: "/leasing/tenancies",
    enabled: true,
    section: "operations",
    minimumRole: "MEMBER",
  },
  {
    id: "nav-leasing-onboarding",
    moduleId: "leasing",
    label: "Onboarding",
    href: "/leasing/onboarding",
    enabled: true,
    section: "operations",
    minimumRole: "MEMBER",
  },
  {
    id: "nav-leasing-offboarding",
    moduleId: "leasing",
    label: "Offboarding",
    href: "/leasing/offboarding",
    enabled: true,
    section: "operations",
    minimumRole: "MEMBER",
  },
  {
    id: "nav-documents",
    moduleId: "documents",
    label: "Documents",
    href: "/modules/documents",
    enabled: false,
    section: "operations",
    minimumRole: "MEMBER",
  },
  {
    id: "nav-crm",
    moduleId: "crm",
    label: "CRM",
    href: "/modules/crm",
    enabled: false,
    section: "growth",
    minimumRole: "MEMBER",
  },
  {
    id: "nav-notifications",
    moduleId: "notifications",
    label: "Notifications",
    href: "/modules/notifications",
    enabled: false,
    section: "growth",
    minimumRole: "ADMIN",
  },
  {
    id: "nav-finance",
    moduleId: "finance",
    label: "Finance / Buildium",
    href: "/modules/finance",
    enabled: false,
    section: "growth",
    minimumRole: "ADMIN",
  },
  {
    id: "nav-settings",
    moduleId: "settings",
    label: "Organization",
    href: "/organization",
    enabled: true,
    section: "system",
    minimumRole: "ADMIN",
  },
];
