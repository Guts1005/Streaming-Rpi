'use client';
import React, { useState, useEffect } from 'react';
import { 
  Activity, LayoutDashboard, ClipboardList, Users as UsersIcon, 
  Video, FileText, Languages, BrainCircuit, BarChart3, 
  TrendingUp, ChevronDown, Bell, Settings, Headphones, Check, User 
} from 'lucide-react';
import './survey.css';

export default function SurveyLayout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState('Loading...');
  const [companyName, setCompanyName] = useState('Loading...');
  const [progressPct] = useState(45);
  const [storagePct] = useState(25);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(d => {
        if (d.user) {
          setUserName(d.user.username);
          setCompanyName(d.user.company_name);
        }
      });
  }, []);

  const navItems = [
    { label: 'Live Survey', icon: Activity, active: true },
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Surveys', icon: ClipboardList },
    { label: 'Respondents', icon: UsersIcon },
    { label: 'Recordings', icon: Video },
    { label: 'Transcriptions', icon: FileText },
    { label: 'Translations', icon: Languages },
    { label: 'AI Extraction', icon: BrainCircuit },
    { label: 'Reports', icon: BarChart3 },
    { label: 'Impact Analysis', icon: TrendingUp },
  ];

  return (
    <div className="survey-app-container">
      {/* SIDEBAR */}
      <aside className="survey-sidebar">
        <div className="survey-logo-header">
          <div className="survey-logo-icon">
            <UsersIcon size={24} color="#2563eb" />
          </div>
          <div className="survey-logo-text">
            <h1>PAP Survey System</h1>
            <p>Baseline Survey & SIA</p>
          </div>
        </div>

        <nav className="survey-nav">
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button key={idx} className={`survey-nav-item ${item.active ? 'active' : ''}`}>
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="survey-sidebar-bottom">
          <div className="survey-card">
            <h3>Survey Progress</h3>
            <div className="progress-info">
              <span className="progress-text">45%</span>
              <div>
                <p>Today's Progress</p>
                <strong>45 / 100 Surveys</strong>
              </div>
            </div>
            <div className="progress-bar-bg"><div className="progress-bar-fill" style={{width: `${progressPct}%`}}></div></div>
          </div>
          
          <div className="survey-officer-card">
            <div className="officer-info">
              <div className="officer-avatar">
                <User size={16} />
                <span className="online-dot"></span>
              </div>
              <div>
                <strong>{userName}</strong>
                <p>Field Survey Officer</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="survey-main">
        <header className="survey-header">
          <div className="header-titles">
            <h1>PAP Baseline Survey - Primary Data Collection</h1>
            <p>Identify Project Affected Persons & capture baseline information before land acquisition</p>
          </div>
          <div className="header-actions">
            <div className="header-dropdowns">
              <div className="dropdown">
                <span>Project</span>
                <button>Line 3 Metro <ChevronDown size={14}/></button>
              </div>
              <div className="dropdown">
                <span>Survey Officer</span>
                <button>{userName} <ChevronDown size={14}/></button>
              </div>
            </div>
            <div className="divider"></div>
            <div className="header-icons">
              <button><Headphones size={20}/></button>
              <button style={{position: 'relative'}}>
                <Bell size={20}/>
                <span className="badge">3</span>
              </button>
              <button><Settings size={20}/></button>
            </div>
            <div className="divider"></div>
            <div className="header-profile">
              <div className="profile-icon"><User size={16}/></div>
              <span>{companyName}</span>
              <ChevronDown size={14}/>
            </div>
          </div>
        </header>

        <div className="survey-content">
          {children}
        </div>
      </main>
    </div>
  );
}
