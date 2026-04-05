import { AnimatePresence } from 'framer-motion';
import { SessionProvider, useSession } from './app/SessionContext';
import { LandingPage } from './features/onboarding/LandingPage';
import { AnalysisPage } from './features/analysis/AnalysisPage';
import { FiltersPage } from './features/filters/FiltersPage';
import { SwipePage } from './features/swipe/SwipePage';
import { ResultsPage } from './features/results/ResultsPage';

function Router() {
  const { step } = useSession();
  return (
    <AnimatePresence mode="wait">
      {step === 'landing' && <LandingPage key="landing" />}
      {step === 'analysis' && <AnalysisPage key="analysis" />}
      {step === 'filters' && <FiltersPage key="filters" />}
      {step === 'swipe' && <SwipePage key="swipe" />}
      {step === 'results' && <ResultsPage key="results" />}
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
