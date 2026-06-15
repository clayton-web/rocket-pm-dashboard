export type PortfolioImportManifestEntity = {
  id: string;
  importCreated: boolean;
  propertyId?: string;
};

export type PortfolioImportManifest = {
  importedAt: string;
  organizationId: string;
  organizationSlug: string;
  csvPath: string;
  dryRun: boolean;
  properties: PortfolioImportManifestEntity[];
  units: PortfolioImportManifestEntity[];
  applications: PortfolioImportManifestEntity[];
  tenancies: PortfolioImportManifestEntity[];
  tenancyContacts: PortfolioImportManifestEntity[];
  skipped: { row: number; reason: string }[];
  errors: { row: number; error: string }[];
  summary: {
    createdProperties: number;
    updatedProperties: number;
    createdUnits: number;
    createdApplications: number;
    createdTenancies: number;
    createdTenancyContacts: number;
    skippedRows: number;
    errorRows: number;
  };
};

export function createEmptyManifest(args: {
  organizationId: string;
  organizationSlug: string;
  csvPath: string;
  dryRun: boolean;
}): PortfolioImportManifest {
  return {
    importedAt: new Date().toISOString(),
    organizationId: args.organizationId,
    organizationSlug: args.organizationSlug,
    csvPath: args.csvPath,
    dryRun: args.dryRun,
    properties: [],
    units: [],
    applications: [],
    tenancies: [],
    tenancyContacts: [],
    skipped: [],
    errors: [],
    summary: {
      createdProperties: 0,
      updatedProperties: 0,
      createdUnits: 0,
      createdApplications: 0,
      createdTenancies: 0,
      createdTenancyContacts: 0,
      skippedRows: 0,
      errorRows: 0,
    },
  };
}

export function finalizeManifestSummary(manifest: PortfolioImportManifest): void {
  manifest.summary = {
    createdProperties: manifest.properties.filter((p) => p.importCreated).length,
    updatedProperties: manifest.properties.filter((p) => !p.importCreated).length,
    createdUnits: manifest.units.filter((u) => u.importCreated).length,
    createdApplications: manifest.applications.length,
    createdTenancies: manifest.tenancies.length,
    createdTenancyContacts: manifest.tenancyContacts.length,
    skippedRows: manifest.skipped.length,
    errorRows: manifest.errors.length,
  };
}
