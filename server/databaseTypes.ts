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
  id: string;
  customer: string;
  surcharge: number;
  date: string;
  accomplished: boolean;
};

export type QuoteEquipment = {
  quoteId: string
  equipmentId: string
  quantity: number
  price: number
}

export type QuoteLabor = {
  quoteId: string
  laborId: string
  hours: number
  price: number
}

export type QuoteWithDetails = Omit<Quote, "customer"> & {
  customer: Customer
  equipments: QuoteEquipment[]
  labors: QuoteLabor[]
}
