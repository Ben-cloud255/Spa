export type Role = 'admin' | 'receptionist' | 'provider';

export interface Branch {
  id: number;
  name: string;
  location: string | null;
  created_at?: string;
  is_active?: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  branch_id: number | null;
  branch_name: string | null;
  is_active: boolean;
  is_busy?: boolean;
  avatar_url: string | null;
  created_at?: string;
}

export interface ServiceCategory {
  id: number;
  name: string;
  is_active: boolean;
}

export interface Service {
  id: number;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  category_id: number | null;
  category_name: string | null;
  branch_id: number | null;
  branch_name: string | null;
  is_active: boolean;
}

export interface BookingSummary {
  id: number;
  customerName: string;
  customerPhone: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'on_hold' | 'awaiting_payment';
  pendingStartedAt: string | null;
  pendingNotified?: boolean;
  noShowReportedAt?: string | null;
  activeStartedAt: string | null;
  expectedEndAt: string | null;
  extendedMinutes: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  amountDue: number;
  amountPaid: number;
  provider: { id: number; name: string } | null;
  service: { id: number; name: string; durationMinutes: number };
  pendingAddon: { name: string; minutes: number; price: number } | null;
}

export interface Room {
  id: number;
  name: string;
  status: 'inactive' | 'pending' | 'active';
  imageUrl: string | null;
  isArchived: boolean;
  branch: { id: number; name: string } | null;
  provider: { id: number; name: string } | null;
  currentBooking: BookingSummary | null;
}

export interface Booking {
  id: number;
  customer_name: string;
  customer_phone: string;
  service_id: number;
  service_name: string;
  duration_minutes: number;
  room_id: number;
  room_name: string;
  provider_id: number;
  provider_name: string;
  receptionist_id: number;
  receptionist_name: string;
  branch_id: number | null;
  branch_name: string | null;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'on_hold' | 'awaiting_payment';
  amount_due: number;
  amount_paid: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  pending_started_at: string | null;
  active_started_at: string | null;
  expected_end_at: string | null;
  ended_at: string | null;
  extended_minutes: number;
  pending_addon_minutes?: number | null;
  pending_addon_price?: number | null;
  created_at: string;
}

export interface Notification {
  id: number;
  type: string;
  message: string;
  booking_id: number | null;
  room_id: number | null;
  branch_id: number | null;
  target_role: Role | null;
  is_read: boolean;
  created_at: string;
}

export interface Appointment {
  id: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  branch_id: number;
  branch_name: string;
  service_id: number;
  service_name: string;
  duration_minutes: number;
  price: number;
  preferred_date: string;
  preferred_time: string | null;
  notes: string | null;
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled';
  converted_booking_id: number | null;
  created_at: string;
}

export interface ReportTotals {
  bookingsCount: number;
  completedCount: number;
  cancelledCount: number;
  activeOrPendingCount: number;
  revenueCollected: number;
  revenueExpected: number;
  revenueOutstanding: number;
}

export interface ReportBranchRow {
  branchId: number | null;
  branchName: string;
  bookingsCount: number;
  revenueExpected: number;
  revenueCollected: number;
}

export interface ReportServiceRow {
  serviceId: number;
  serviceName: string;
  bookingsCount: number;
  revenueExpected: number;
}

export interface ReportProviderRow {
  providerId: number;
  providerName: string;
  bookingsCount: number;
  sessionsCompleted: number;
}

export interface ReportDayRow {
  date: string;
  revenueCollected: number;
}

export interface ReportDetailRow {
  id: number;
  customer_name: string;
  customer_phone: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'on_hold';
  amount_due: number;
  amount_paid: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  extended_minutes: number;
  created_at: string;
  branch_name: string | null;
  service_name: string;
  room_name: string;
  provider_name: string;
  receptionist_name: string;
  extra_services: string;
}

export interface ReportSummary {
  range: { from: string; to: string };
  totals: ReportTotals;
  byBranch: ReportBranchRow[];
  byService: ReportServiceRow[];
  byProvider: ReportProviderRow[];
  byDay: ReportDayRow[];
}

export interface ExecutiveReport {
  range: { from: string; to: string };
  scope: { branchId: number | null; providerId: number | null; serviceId: number | null };
  totals: {
    bookingsCount: number;
    completedCount: number;
    cancelledCount: number;
    activeOrPendingCount: number;
    noShowCount: number;
    cancellationRate: number;
    noShowRate: number;
    revenueCollected: number;
    revenueExpected: number;
    revenueOutstanding: number;
  };
  byBranch: {
    branchId: number | null;
    branchName: string;
    bookingsCount: number;
    cancelledCount: number;
    completedCount: number;
    revenueExpected: number;
    revenueCollected: number;
    cancellationRate: number;
  }[];
  byService: {
    serviceId: number;
    serviceName: string;
    bookingsCount: number;
    revenueExpected: number;
    revenueCollected: number;
  }[];
  byProvider: {
    providerId: number;
    providerName: string;
    bookingsCount: number;
    sessionsCompleted: number;
    revenueCollected: number;
  }[];
  peakHour: string | null;
  quietHour: string | null;
}
