/**
 * Maps Rocket PM logical field keys to RTB-1 (2023/06) AcroForm field names.
 * PDF field names must match the official template exactly.
 */
export type Rtb1LogicalFieldKey =
  | "landlord.lastNameOrBusiness"
  | "landlord.firstMiddle"
  | "landlord.serviceUnitSite"
  | "landlord.serviceStreet"
  | "landlord.serviceCity"
  | "landlord.serviceProvince"
  | "landlord.servicePostalCode"
  | "landlord.servicePhone"
  | "landlord.serviceOtherPhone"
  | "landlord.serviceEmail"
  | "landlord.serviceOtherEmail"
  | "landlord.isLandlordCheckbox"
  | "landlord.isAgentServiceCheckbox"
  | "rentalUnit.unitNumber"
  | "rentalUnit.street"
  | "rentalUnit.city"
  | "rentalUnit.province"
  | "rentalUnit.postalCode"
  | "tenant1.lastName"
  | "tenant1.firstMiddle"
  | "tenant1.email"
  | "tenant1.phone"
  | "tenant2.lastName"
  | "tenant2.firstMiddle"
  | "tenant2.email"
  | "tenant2.phone"
  | "tenancy.startDay"
  | "tenancy.startMonth"
  | "tenancy.startYear"
  | "tenancy.typeMonthToMonth"
  | "tenancy.typeFixedTerm"
  | "tenancy.fixedTermEndDay"
  | "tenancy.fixedTermEndMonth"
  | "tenancy.fixedTermEndYear"
  | "tenancy.continueMonthToMonthAfterFixed"
  | "tenancy.vacateAtEnd"
  | "tenancy.vacateReason"
  | "tenancy.vacateRtrSection"
  | "rent.amount"
  | "rent.periodMonth"
  | "rent.periodMonthRta"
  | "rent.periodWeek"
  | "rent.periodDay"
  | "rent.dueDayOfPeriod"
  | "deposits.summary"
  | "deposits.securityDueDate"
  | "deposits.petDueDate"
  | "deposits.petNotApplicable"
  | "services.water"
  | "services.heat"
  | "services.electricity"
  | "services.naturalGas"
  | "services.garbageCollection"
  | "services.internet"
  | "services.cable"
  | "services.parking"
  | "services.parkingDescription"
  | "services.storage"
  | "services.storageDescription"
  | "services.laundry"
  | "services.snowRemoval"
  | "addendum.attached"
  | "addendum.pageCount"
  | "addendum.termCount"
  | "parties.rtb26Attached";

export type Rtb1PdfFieldKind = "text" | "checkbox";

export type Rtb1FieldMapEntry = {
  pdfFieldName: string;
  kind: Rtb1PdfFieldKind;
};

export const RTB1_FIELD_MAP: Record<Rtb1LogicalFieldKey, Rtb1FieldMapEntry> = {
  "landlord.lastNameOrBusiness": { pdfFieldName: "last name", kind: "text" },
  "landlord.firstMiddle": { pdfFieldName: "landlords first and middle name", kind: "text" },
  "landlord.serviceUnitSite": { pdfFieldName: "unitsite", kind: "text" },
  "landlord.serviceStreet": { pdfFieldName: "street number and street name", kind: "text" },
  "landlord.serviceCity": { pdfFieldName: "city", kind: "text" },
  "landlord.serviceProvince": { pdfFieldName: "Province1", kind: "text" },
  "landlord.servicePostalCode": { pdfFieldName: "postal code", kind: "text" },
  "landlord.servicePhone": { pdfFieldName: "daytime phone number", kind: "text" },
  "landlord.serviceOtherPhone": { pdfFieldName: "other phone number", kind: "text" },
  "landlord.serviceEmail": { pdfFieldName: "LL email 1", kind: "text" },
  "landlord.serviceOtherEmail": { pdfFieldName: "LL email 2", kind: "text" },
  "landlord.isLandlordCheckbox": { pdfFieldName: "landlord", kind: "checkbox" },
  "landlord.isAgentServiceCheckbox": {
    pdfFieldName: "ADDRESS FOR SERVICE of the",
    kind: "checkbox",
  },
  "rentalUnit.unitNumber": { pdfFieldName: "unit number", kind: "text" },
  "rentalUnit.street": { pdfFieldName: "street number and street name_2", kind: "text" },
  "rentalUnit.city": { pdfFieldName: "city_2", kind: "text" },
  "rentalUnit.province": { pdfFieldName: "province_2", kind: "text" },
  "rentalUnit.postalCode": { pdfFieldName: "postal code_2", kind: "text" },
  "tenant1.lastName": { pdfFieldName: "last name_2", kind: "text" },
  "tenant1.firstMiddle": { pdfFieldName: "first and middle names_2", kind: "text" },
  "tenant1.email": { pdfFieldName: "TT email 1", kind: "text" },
  "tenant1.phone": { pdfFieldName: "optional phone number", kind: "text" },
  "tenant2.lastName": { pdfFieldName: "last name_3", kind: "text" },
  "tenant2.firstMiddle": { pdfFieldName: "first and middle names_3", kind: "text" },
  "tenant2.email": { pdfFieldName: "TT email 2", kind: "text" },
  "tenant2.phone": { pdfFieldName: "other phone number", kind: "text" },
  "tenancy.startDay": { pdfFieldName: "Day", kind: "text" },
  "tenancy.startMonth": { pdfFieldName: "month_af_date", kind: "text" },
  "tenancy.startYear": { pdfFieldName: "year_af_date", kind: "text" },
  "tenancy.typeMonthToMonth": {
    pdfFieldName: "A and continues on a monthtomonth basis until ended in accordance with the Act",
    kind: "checkbox",
  },
  "tenancy.typeFixedTerm": {
    pdfFieldName: "C and is for a fixed term ending on",
    kind: "checkbox",
  },
  "tenancy.fixedTermEndDay": { pdfFieldName: "day_af_date", kind: "text" },
  "tenancy.fixedTermEndMonth": { pdfFieldName: "Month2_af_date", kind: "text" },
  "tenancy.fixedTermEndYear": { pdfFieldName: "year2_af_date", kind: "text" },
  "tenancy.continueMonthToMonthAfterFixed": {
    pdfFieldName:
      "D At the end of this time the tenancy will continue on a monthtomonth basis or another fixed lengthof",
    kind: "checkbox",
  },
  "tenancy.vacateAtEnd": {
    pdfFieldName: "E At the end of this time the tenancy is ended and the tenant must vacate the rental unit",
    kind: "checkbox",
  },
  "tenancy.vacateReason": { pdfFieldName: "Reason tenant must vacate required", kind: "text" },
  "tenancy.vacateRtrSection": {
    pdfFieldName: "Residential Tenancy Regulation section number if applicable",
    kind: "text",
  },
  "rent.amount": { pdfFieldName: "The tenant will pay the rent of", kind: "text" },
  "rent.periodMonth": { pdfFieldName: "month to the landlord on", kind: "checkbox" },
  "rent.periodMonthRta": {
    pdfFieldName: "month subject to rent increases given in accordance with the RTA",
    kind: "checkbox",
  },
  "rent.periodWeek": { pdfFieldName: "week", kind: "checkbox" },
  "rent.periodDay": { pdfFieldName: "day", kind: "checkbox" },
  "rent.dueDayOfPeriod": {
    pdfFieldName: "the first day of the rental period which falls on the due date eg 1st 2nd 3rd  31st",
    kind: "text",
  },
  "deposits.summary": { pdfFieldName: "4 SECURITY DEPOSIT AND PET DAMAGE DEPOSIT", kind: "text" },
  "deposits.securityDueDate": { pdfFieldName: "Date", kind: "text" },
  "deposits.petDueDate": { pdfFieldName: "Date_2", kind: "text" },
  "deposits.petNotApplicable": { pdfFieldName: "not applicable", kind: "checkbox" },
  "services.water": { pdfFieldName: "Water", kind: "checkbox" },
  "services.heat": { pdfFieldName: "Heat", kind: "checkbox" },
  "services.electricity": { pdfFieldName: "Electricity", kind: "checkbox" },
  "services.naturalGas": { pdfFieldName: "Natural gas", kind: "checkbox" },
  "services.garbageCollection": { pdfFieldName: "Garbage collection", kind: "checkbox" },
  "services.internet": { pdfFieldName: "Internet", kind: "checkbox" },
  "services.cable": { pdfFieldName: "Cablevision", kind: "checkbox" },
  "services.parking": { pdfFieldName: "Parking", kind: "checkbox" },
  "services.parkingDescription": { pdfFieldName: "Parking for", kind: "text" },
  "services.storage": { pdfFieldName: "Storage", kind: "checkbox" },
  "services.storageDescription": { pdfFieldName: "Additional information", kind: "text" },
  "services.laundry": { pdfFieldName: "Free laundry", kind: "checkbox" },
  "services.snowRemoval": { pdfFieldName: "Snow removal", kind: "checkbox" },
  "addendum.attached": {
    pdfFieldName:
      "If there is an Addendum attached  provide the following information on the Addendum that forms part of this",
    kind: "checkbox",
  },
  "addendum.pageCount": { pdfFieldName: "undefined", kind: "text" },
  "addendum.termCount": { pdfFieldName: "Number of additional terms in the Addendum", kind: "text" },
  "parties.rtb26Attached": { pdfFieldName: "RTB26 used  attached", kind: "checkbox" },
};

export function logicalFieldKeys(): Rtb1LogicalFieldKey[] {
  return Object.keys(RTB1_FIELD_MAP) as Rtb1LogicalFieldKey[];
}
