export type QuoteLineType = "equipment" | "labor" | "other";

export type Customer = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  propertyType: string | null;
  squareFootage: number | null;
  systemType: string | null;
  systemAge: number | null;
  lastServiceDate: string | null;
};

export type Equipment = {
  id: string;
  name: string;
  category: string;
  brand: string;
  modelNumber: string;
  baseCost: number;
};

export type LaborRate = {
  jobId: string;
  name: string;
  hourlyRate: number;
  estimatedHoursMin: number;
  estimatedHoursMax: number;
};

export type Quote = {
  id: number;
  customer: string;
  surcharge: number;
  date: string;
};

export type QuoteLine = {
  quoteId: number;
  type: QuoteLineType;
  ordering: number;
  price: number;
  equipmentId: string | null;
  laborId: string | null;
  hours: number | null;
  name: string | null;
};
