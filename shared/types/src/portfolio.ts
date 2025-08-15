export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  description?: string;
  totalValue: number;
  totalInvested: number;
  totalPnl: number;
  totalPnlPercentage: number;
  holdings: Holding[];
  positions: Position[];
  riskScore: number;
  diversificationScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Holding {
  symbol: string;
  exchange: string;
  isin: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  investedValue: number;
  pnl: number;
  pnlPercentage: number;
  collateralQuantity: number;
  collateralType: string;
  metadata?: Record<string, any>;
}

export interface Position {
  symbol: string;
  exchange: string;
  segment: string;
  netQuantity: number;
  buyQuantity: number;
  sellQuantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  productType: string;
  metadata?: Record<string, any>;
}