import React from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import { DashboardLayout } from '../components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { 
  TrendingUpIcon, 
  CalculatorIcon, 
  FileTextIcon, 
  ShieldCheckIcon,
  BarChart3Icon,
  BellIcon
} from 'lucide-react';

const HomePage: NextPage = () => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <DashboardLayout>
      <Head>
        <title>Dashboard - FinVerse Compliance Cloud</title>
        <meta name="description" content="Your comprehensive trading compliance dashboard" />
      </Head>

      <div className="p-6 space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-blue-100">
            Stay compliant with your trading activities and tax obligations
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Portfolio Value"
            value="₹12,45,678"
            change="+5.67%"
            trend="up"
            icon={<TrendingUpIcon className="h-6 w-6" />}
          />
          <StatCard
            title="Tax Liability"
            value="₹23,456"
            change="-2.3%"
            trend="down"
            icon={<CalculatorIcon className="h-6 w-6" />}
          />
          <StatCard
            title="Compliance Score"
            value="96%"
            change="+1.2%"
            trend="up"
            icon={<ShieldCheckIcon className="h-6 w-6" />}
          />
          <StatCard
            title="Pending Actions"
            value="3"
            change="0"
            trend="neutral"
            icon={<BellIcon className="h-6 w-6" />}
          />
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/tax/calculate">
                <Button variant="outline" className="h-24 flex flex-col items-center justify-center space-y-2 w-full">
                  <CalculatorIcon className="h-8 w-8" />
                  <span>Calculate Tax</span>
                </Button>
              </Link>
              <Link href="/portfolio">
                <Button variant="outline" className="h-24 flex flex-col items-center justify-center space-y-2 w-full">
                  <BarChart3Icon className="h-8 w-8" />
                  <span>View Portfolio</span>
                </Button>
              </Link>
              <Link href="/reports">
                <Button variant="outline" className="h-24 flex flex-col items-center justify-center space-y-2 w-full">
                  <FileTextIcon className="h-8 w-8" />
                  <span>Generate Reports</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity & Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentActivity />
          <ComplianceAlerts />
        </div>
      </div>
    </DashboardLayout>
  );
};

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Head>
        <title>FinVerse Compliance Cloud - Ultimate Trading Compliance Platform</title>
        <meta name="description" content="Automate tax filing, compliance, audit, and portfolio analytics for Indian retail traders" />
      </Head>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-gray-900">FinVerse</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/auth/login">
                <Button variant="ghost">Login</Button>
              </Link>
              <Link href="/auth/register">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Ultimate Trading
            <span className="text-blue-600"> Compliance</span>
            <br />Platform for India
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Automate tax filing, compliance monitoring, audit processes, and portfolio analytics. 
            Integrate with all major Indian brokers and stay compliant effortlessly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register">
              <Button size="lg" className="px-8 py-3">
                Start Free Trial
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="px-8 py-3">
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Everything you need for trading compliance
          </h2>
          <p className="text-lg text-gray-600">
            Comprehensive platform covering all aspects of Indian trading regulations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard
            icon={<CalculatorIcon className="h-12 w-12 text-blue-600" />}
            title="Automated Tax Calculations"
            description="Calculate GST, TDS, STT, and capital gains automatically with Indian tax regulations"
          />
          <FeatureCard
            icon={<TrendingUpIcon className="h-12 w-12 text-green-600" />}
            title="Broker Integrations"
            description="Connect with Zerodha, Upstox, Angel Broking, and all major Indian brokers"
          />
          <FeatureCard
            icon={<FileTextIcon className="h-12 w-12 text-purple-600" />}
            title="ITR Filing"
            description="Generate and file ITR-2, ITR-3, ITR-4 forms automatically with validation"
          />
          <FeatureCard
            icon={<ShieldCheckIcon className="h-12 w-12 text-red-600" />}
            title="Compliance Monitoring"
            description="Stay updated with SEBI, RBI, and CBDT regulatory changes automatically"
          />
          <FeatureCard
            icon={<BarChart3Icon className="h-12 w-12 text-indigo-600" />}
            title="Portfolio Analytics"
            description="Advanced analytics with risk assessment and performance tracking"
          />
          <FeatureCard
            icon={<BellIcon className="h-12 w-12 text-yellow-600" />}
            title="Smart Alerts"
            description="Proactive notifications for deadlines, compliance issues, and opportunities"
          />
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
}> = ({ title, value, change, trend, icon }) => {
  const trendColor = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600',
  }[trend];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className={`text-sm ${trendColor}`}>{change}</p>
          </div>
          <div className="text-gray-400">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const FeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => {
  return (
    <Card className="text-center p-6">
      <CardContent>
        <div className="mb-4 flex justify-center">
          {icon}
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </CardContent>
    </Card>
  );
};

const RecentActivity: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-sm font-medium">Trade executed: RELIANCE</p>
              <p className="text-xs text-gray-500">2 hours ago</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-sm font-medium">Tax calculation updated</p>
              <p className="text-xs text-gray-500">1 day ago</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-sm font-medium">ITR filing reminder</p>
              <p className="text-xs text-gray-500">2 days ago</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ComplianceAlerts: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400">
            <p className="text-sm font-medium text-yellow-800">
              ITR filing deadline approaching
            </p>
            <p className="text-xs text-yellow-600">Due in 15 days</p>
          </div>
          <div className="p-3 bg-blue-50 border-l-4 border-blue-400">
            <p className="text-sm font-medium text-blue-800">
              New SEBI regulation update
            </p>
            <p className="text-xs text-blue-600">Review required</p>
          </div>
          <div className="p-3 bg-green-50 border-l-4 border-green-400">
            <p className="text-sm font-medium text-green-800">
              All compliance checks passed
            </p>
            <p className="text-xs text-green-600">Portfolio is compliant</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HomePage;