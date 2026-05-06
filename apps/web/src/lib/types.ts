/**
 * Shared frontend types for ServiceSync dashboard pages.
 * These are UI-level interfaces used for local component state.
 * Database-level types come from tRPC router outputs.
 */

export interface Client {
  id: string;
  name: string;
  phone: string;
  address: string;
  lat?: number;
  lng?: number;
  brand: string;
  notes: string;
}

export interface Job {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  address: string;
  lat?: number;
  lng?: number;
  date: Date;
  time: string;
  service: string;
  status: "upcoming" | "completed" | "cancelled";
  amount: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  date: string;
  status: "paid" | "pending" | "void" | "draft";
}

export interface Request {
  id: string;
  clientName: string;
  phone: string;
  address: string;
  lat?: number;
  lng?: number;
  service: string;
  date: Date;
  time: string;
  amount: number;
  brand: string;
  notes?: string;
}

export interface UserProfile {
  name: string;
  homeAddress: string;
  homeLat: number;
  homeLng: number;
}
