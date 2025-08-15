'use client';

import React, { useState } from 'react';
import {
  HomeIcon,
  TrendingUpIcon,
  PieChartIcon,
  FileTextIcon,
  CalculatorIcon,
  ShieldCheckIcon,
  BellIcon,
  SettingsIcon,
  MenuIcon,
  XIcon,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon, current: true },
  { name: 'Portfolio', href: '/portfolio', icon: PieChartIcon, current: false },
  { name: 'Trades', href: '/trades', icon: TrendingUpIcon, current: false },
  { name: 'Tax Center', href: '/tax', icon: CalculatorIcon, current: false },
  { name: 'Compliance', href: '/compliance', icon: ShieldCheckIcon, current: false },
  { name: 'Documents', href: '/documents', icon: FileTextIcon, current: false },
  { name: 'Notifications', href: '/notifications', icon: BellIcon, current: false },
  { name: 'Settings', href: '/settings', icon: SettingsIcon, current: false },
];

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl">
          <SidebarContent onItemClick={() => setSidebarOpen(false)} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 pt-5 pb-4 overflow-y-auto">
          <SidebarContent />
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top navigation */}
        <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
            <button
              type="button"
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
            >
              <MenuIcon className="h-6 w-6" />
            </button>

            <div className="flex items-center space-x-4">
              <div className="flex-1 max-w-lg">
                <input
                  type="search"
                  placeholder="Search stocks, trades, documents..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center space-x-3">
                <BellIcon className="h-6 w-6 text-gray-400" />
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">BK</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Bhanu Karanwal</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};

const SidebarContent: React.FC<{ onItemClick?: () => void }> = ({ onItemClick }) => {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center px-6 mb-8">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">F</span>
          </div>
          <span className="ml-2 text-xl font-bold text-gray-900">FinVerse</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.name}
              href={item.href}
              onClick={onItemClick}
              className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                item.current
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className={`mr-3 h-5 w-5 ${
                item.current ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
              }`} />
              {item.name}
            </a>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          FinVerse v2.1.0
          <br />
          Last Updated: 2025-08-15 12:48:15 UTC
          <br />
          by bhanukaranwal
        </div>
      </div>
    </>
  );
};