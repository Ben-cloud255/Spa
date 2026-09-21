export interface AnalyticsMetric { revenue: number; bookings: number; completed: number; cancelled: number; averageValue: number; outstanding: number }
export interface AnalyticsRank { id: number | null; name: string; bookings: number; completed: number; revenue: number }
export interface SpaAnalytics {
  range: {from: string; to: string; previousFrom: string; previousTo: string};
  current: AnalyticsMetric; previous: AnalyticsMetric;
  days: {date: string; revenue: number; bookings: number}[];
  hours: {hour: number; bookings: number}[];
  statuses: {status: string; count: number}[];
  branches: AnalyticsRank[]; services: AnalyticsRank[]; providers: AnalyticsRank[];
  inventory: {value: number; lowStock: {id: number; item: string; branch: string; quantity: number; minimum: number}[]};
  updatedAt: string;
}
