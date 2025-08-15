import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUpIcon, 
  TrendingDownIcon, 
  DollarSignIcon, 
  PieChartIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { formatCurrency, formatPercent } from '../lib/utils';
import { api } from '../lib/api';

interface DashboardData {
  portfolio: {
    totalValue: number;
    dayPnL: number;
    dayPnLPercent: number;
    totalPnL: number;
    totalPnLPercent: number;
  };
  recentTrades: Array<{
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    timestamp: string;
    pnl: number;
  }>;
  topHoldings: Array<{
    symbol: string;
    quantity: number;
    marketValue: number;
    pnl: number;
    pnlPercent: number;
  }>;
  alerts: Array<{
    id: string;
    type: 'INFO' | 'WARNING' | 'ERROR';
    message: string;
    timestamp: string;
  }>;
  compliance: {
    score: number;
    violations: number;
    lastUpdated: string;
  };
  taxSummary: {
    currentYearGains: number;
    currentYearLosses: number;
    estimatedTax: number;
    nextFilingDate: string;
  };
}

export const DashboardPage: React.FC = () => {
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/api/dashboard'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-8">
        Failed to load dashboard data. Please try again.
      </div>
    );
  }

  const { portfolio, recentTrades, topHoldings, alerts, compliance, taxSummary } = dashboardData!;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your trading overview.</p>
      </div>

      {/* Portfolio Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(portfolio.totalValue)}</div>
            <div className={`text-xs flex items-center ${portfolio.dayPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {portfolio.dayPnL >= 0 ? <TrendingUpIcon className="h-3 w-3 mr-1" /> : <TrendingDownIcon className="h-3 w-3 mr-1" />}
              {formatCurrency(portfolio.dayPnL)} ({formatPercent(portfolio.dayPnLPercent)}) today
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${portfolio.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(portfolio.totalPnL)}
            </div>
            <div className={`text-xs ${portfolio.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercent(portfolio.totalPnLPercent)} overall return
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${compliance.score >= 80 ? 'text-green-600' : compliance.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
              {compliance.score}%
            </div>
            <div className="text-xs text-muted-foreground">
              {compliance.violations} violations found
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Tax</CardTitle>
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(taxSummary.estimatedTax)}</div>
            <div className="text-xs text-muted-foreground">
              Filing due: {new Date(taxSummary.nextFilingDate).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Trades */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Trades</CardTitle>
            <CardDescription>Your latest trading activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTrades.slice(0, 5).map((trade) => (
                <div key={trade.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${trade.side === 'buy' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <div>
                      <p className="text-sm font-medium">{trade.symbol}</p>
                      <p className="text-xs text-gray-500">
                        {trade.side.toUpperCase()} {trade.quantity} @ {formatCurrency(trade.price)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(trade.pnl)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(trade.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Holdings */}
        <Card>
          <CardHeader>
            <CardTitle>Top Holdings</CardTitle>
            <CardDescription>Your largest portfolio positions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topHoldings.slice(0, 5).map((holding) => (
                <div key={holding.symbol} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{holding.symbol}</p>
                    <p className="text-xs text-gray-500">{holding.quantity} shares</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatCurrency(holding.marketValue)}</p>
                    <p className={`text-xs ${holding.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(holding.pnlPercent)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangleIcon className="h-5 w-5 mr-2 text-yellow-500" />
              Alerts & Notifications
            </CardTitle>
            <CardDescription>Important updates and notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className={`p-3 rounded-lg border-l-4 ${
                  alert.type === 'ERROR' ? 'border-red-500 bg-red-50' :
                  alert.type === 'WARNING' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                }`}>
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};