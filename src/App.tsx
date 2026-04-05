import { AnimatePresence } from 'framer-motion';
import { SessionProvider, useSession } from './app/SessionContext';
import { LandingPage } from './features/onboarding/LandingPage';
import { PairLoadingPage } from './features/pair/PairLoadingPage';
import { PairResultsPage } from './features/pair/PairResultsPage';

function Router() {
  const { step } = useSession();

  // The simplified flow only uses three steps. Any legacy value
  // (analysis/filters/swipe/results) is treated as "landing" so users
  // recovering stale localStorage don't get stuck.
  const safeStep =
    step === 'pair-loading' || step === 'pair-results' ? step : 'landing';

  return (
    <AnimatePresence mode="wait">
      {safeStep === 'landing' && <LandingPage key="landing" />}
      {safeStep === 'pair-loading' && <PairLoadingPage key="pair-loading" />}
      {safeStep === 'pair-results' && <PairResultsPage key="pair-results" />}
    </AnimatePresence>
  );
}

export function App() {
  return (
    <SessionProvider>
      <div className="min-h-screen flex flex-col">
        <Router />
      </div>
    </SessionProvider>
  );
}
