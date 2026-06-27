export type BuildiumCredentials = {
  clientId: string;
  clientSecret: string;
};

export type BuildiumRentalProperty = {
  Id: number;
  Name?: string;
  StructureDescription?: string;
  NumberUnits?: number;
  IsActive?: boolean;
  Address?: {
    AddressLine1?: string;
    City?: string;
    State?: string;
    PostalCode?: string;
    Country?: string;
  };
};

export type BuildiumListRentalsResponse = BuildiumRentalProperty[];

export type BuildiumFetchResult<T> = {
  data: T;
  totalCount: number | null;
};
