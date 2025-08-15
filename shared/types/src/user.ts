export enum UserRole {
  ADMIN = 'ADMIN',
  TRADER = 'TRADER',
  ACCOUNTANT = 'ACCOUNTANT',
  AUDITOR = 'AUDITOR',
  VIEWER = 'VIEWER',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  panNumber: string;
  aadhaarNumber?: string;
  role: UserRole;
  isEmailVerified: boolean;
  isActive: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string;
  permissions: string[];
  preferences: UserPreferences;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
  dashboard: DashboardPreferences;
  trading: TradingPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  whatsapp: boolean;
  priceAlerts: boolean;
  newsAlerts: boolean;
  complianceAlerts: boolean;
}

export interface DashboardPreferences {
  defaultView: 'portfolio' | 'trades' | 'analytics';
  widgets: string[];
  refreshInterval: number;
}

export interface TradingPreferences {
  defaultExchange: string;
  defaultOrderType: 'market' | 'limit';
  confirmations: boolean;
  autoLogout: number; // minutes
}

export interface UserRegistration {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  panNumber: string;
  aadhaarNumber?: string;
  agreeToTerms: boolean;
}

export interface UserLogin {
  email: string;
  password: string;
  mfaCode?: string;
  rememberMe?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  panNumber: string;
  role: UserRole;
  isEmailVerified: boolean;
  avatar?: string;
  bio?: string;
  location?: string;
  joinedAt: Date;
}