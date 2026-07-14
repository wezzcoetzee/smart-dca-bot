export type Period = "1m" | "1y" | "all";

export interface ChartDataPoint {
  date: string;
  programaticValue: number;
  fixedValue: number;
  btcPrice: number;
  programaticBtcAccumulated: number;
  fixedBtcAccumulated: number;
  programaticSpent: number;
  fixedSpent: number;
}

export interface TransactionRow {
  id: string;
  date: string;
  amount: number;
  price: number;
  reason: string;
}

export interface DashboardSummary {
  currentPrice: number;
  totalProgramaticValue: number;
  totalFixedValue: number;
  programaticBtcAmount: number;
  fixedBtcAmount: number;
  percentageDifference: number;
}

export interface DashboardResponse {
  chartData: ChartDataPoint[];
  transactions: TransactionRow[];
  summary: DashboardSummary;
}
