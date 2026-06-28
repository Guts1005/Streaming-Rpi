import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import React from 'react';

export default async function SurveyDashboard() {
  const cookieStore = cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    redirect('/login');
  }

  const user: any = verifyToken(token);

  // Allow access if they are from Aspire Survey (Company ID 7 or 7.0)
  // or if they are a surveyor by role/username
  const isSurveyor = 
    user?.company_id === '7' || 
    user?.company_id === '7.0' || 
    user?.username === 'surveyor';

  if (!isSurveyor) {
    redirect('/'); // Redirect unauthorized users to the main dashboard
  }

  return (
    <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>
      <h2>Welcome to the PAP Baseline Survey Dashboard</h2>
      <p>This is the secure survey area. Components will be migrated here one by one.</p>
    </div>
  );
}
