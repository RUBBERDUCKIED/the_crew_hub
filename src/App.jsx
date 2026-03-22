import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useAppStore from './state/useAppStore.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import AlphaBanner from './components/AlphaBanner.jsx';
import TodayTab from './pages/TodayTab.jsx';
import TeamTab from './pages/TeamTab.jsx';
import TimesheetsTab from './pages/TimesheetsTab.jsx';
import CrmTab from './pages/CrmTab.jsx';
import PipelineTab from './pages/PipelineTab.jsx';
import ReportsTab from './pages/ReportsTab.jsx';
import LeadsTab from './pages/LeadsTab.jsx';
import OnboardingOrchestrator from './components/OnboardingOrchestrator.jsx';
import ChatBubble from './components/ChatBubble.jsx';

// ─────────────────────────────────────────────────────────────
// App Shell — React root component.
// Renders React tab components via portals into legacy DOM containers.
// Legacy switchTab() show/hide still controls which tab is visible.
// Each portal is wrapped in an ErrorBoundary so one broken tab
// can't take down the entire app.
// ─────────────────────────────────────────────────────────────

export default function App() {
  const isSignedIn = useAppStore(state => state.isSignedIn);
  const [roots, setRoots] = useState({});

  useEffect(() => {
    setRoots({
      today:      document.getElementById('today-react-root'),
      team:       document.getElementById('team-react-root'),
      timesheets: document.getElementById('timesheets-react-root'),
      crm:        document.getElementById('crm-react-root'),
      pipeline:   document.getElementById('pipeline-react-root'),
      reports:    document.getElementById('reports-react-root'),
      leads:      document.getElementById('leads-react-root'),
    });
  }, []);

  return (
    <>
      <AlphaBanner />
      {isSignedIn && <OnboardingOrchestrator />}
      {isSignedIn && roots.today      && createPortal(<ErrorBoundary name="Today">      <TodayTab />      </ErrorBoundary>, roots.today)}
      {isSignedIn && roots.team       && createPortal(<ErrorBoundary name="Team">       <TeamTab />       </ErrorBoundary>, roots.team)}
      {isSignedIn && roots.timesheets && createPortal(<ErrorBoundary name="Timesheets"> <TimesheetsTab /> </ErrorBoundary>, roots.timesheets)}
      {isSignedIn && roots.crm        && createPortal(<ErrorBoundary name="CRM">        <CrmTab />        </ErrorBoundary>, roots.crm)}
      {isSignedIn && roots.pipeline   && createPortal(<ErrorBoundary name="Pipeline">   <PipelineTab />   </ErrorBoundary>, roots.pipeline)}
      {isSignedIn && roots.reports    && createPortal(<ErrorBoundary name="Reports">    <ReportsTab />    </ErrorBoundary>, roots.reports)}
      {isSignedIn && roots.leads      && createPortal(<ErrorBoundary name="Leads">      <LeadsTab />      </ErrorBoundary>, roots.leads)}
      {isSignedIn && <ChatBubble />}
    </>
  );
}
