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
  minimumRole?: "PROPERTY_MANAGER" | "ORG_ADMIN";
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
    minimumRole: "PROPERTY_MANAGER",
  },
  {
    id: "nav-email",
    moduleId: "email",
    label: "Gmail",
    href: "/email",
    enabled: true,
    section: "command",
    minimumRole: "PROPERTY_MANAGER",
  },
  {
    id: "nav-ai-responder",
    moduleId: "aiResponder",
    label: "AI responder",
    href: "/responder",
    enabled: true,
    section: "command",
    minimumRole: "PROPERTY_MANAGER",
  },
  {
    id: "nav-inspections",
    moduleId: "inspections",
    label: "Inspections",
    href: "/modules/inspections",
    enabled: false,
    section: "operations",
    minimumRole: "PROPERTY_MANAGER",
  },
  {
    id: "nav-maintenance",
    moduleId: "maintenance",
    label: "Maintenance",
    href: "/modules/maintenance",
    enabled: false,
    section: "operations",
    minimumRole: "PROPERTY_MANAGER",
  },
  {
    id: "nav-tenant-apps",
    moduleId: "tenantApps",
    label: "Applications",
    href: "/modules/applications",
    enabled: false,
    section: "operations",
    minimumRole: "PROPERTY_MANAGER",
  },
  {
    id: "nav-documents",
    moduleId: "documents",
    label: "Documents",
    href: "/modules/documents",
    enabled: false,
    section: "operations",
    minimumRole: "PROPERTY_MANAGER",
  },
  {
    id: "nav-crm",
    moduleId: "crm",
    label: "CRM",
    href: "/modules/crm",
    enabled: false,
    section: "growth",
    minimumRole: "PROPERTY_MANAGER",
  },
  {
    id: "nav-notifications",
    moduleId: "notifications",
    label: "Notifications",
    href: "/modules/notifications",
    enabled: false,
    section: "growth",
    minimumRole: "ORG_ADMIN",
  },
  {
    id: "nav-finance",
    moduleId: "finance",
    label: "Finance / Buildium",
    href: "/modules/finance",
    enabled: false,
    section: "growth",
    minimumRole: "ORG_ADMIN",
  },
  {
    id: "nav-settings",
    moduleId: "settings",
    label: "Organization",
    href: "/organization",
    enabled: true,
    section: "system",
    minimumRole: "ORG_ADMIN",
  },
];
