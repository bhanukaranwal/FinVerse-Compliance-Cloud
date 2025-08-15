export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  uptime: number;
  timestamp: Date;
  details?: any;
}

export interface ServiceEvent {
  id: string;
  type: string;
  source: string;
  data: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}