'use client';

import React from 'react';
import { DashboardLayout } from '../components/layouts/DashboardLayout';
import { DashboardPage } from '../components/pages/DashboardPage';

export default function Home() {
  return (
    <DashboardLayout>
      <DashboardPage />
    </DashboardLayout>
  );
}