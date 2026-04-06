import { useState } from 'react';
import { useSession } from '../../app/SessionContext';
import { Button } from '../../components/Button';
import { Footer } from '../../components/Footer';
import { Header } from '../../components/Header';
import { StepShell } from '../../components/StepShell';

export function LandingPage() {
  const { userA: savedA, userB: savedB, setUsernames, setStep } = useSession();
  const [userA, setUserA] = useState(savedA);
  const [userB, setUserB] = useState(savedB);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = userA.trim().length > 0 && userB.trim().length > 0;

  const submit = () => {
    const a = userA.trim().replace(/^@/, '');
    const b = userB.trim().replace(/^@/, '');
    if (!a || !b) {
      setError('Both usernames are required.');
      return;
    }
    if (a.toLowerCase() === b.toLowerCase()) {
      setError('Use two different Letterboxd usernames.');
      return;
    }
    setError(null);
    setUsernames(a, b);
    setStep('pair-loading');
  };

  return (
    <StepShell>
      <Header />
      <main className="flex-1 flex items-center px-4 sm:px-6">
        <div className="max-w-xl mx-auto w-full py-8">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-ink-700 bg-ink-900/60 text-[11px] text-ink-300 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              tonight's movie, settled
            </div>
            <h1 className="font-display text-4xl sm:text-5xl leading-[1.05] tracking-tight mb-4">
              Find tonight's movie without the{' '}
              <span className="text-accent">45-minute debate</span>.
            </h1>
            <p className="text-ink-300 text-base sm:text-lg leading-relaxed">
              Movies you both want to watch, with ratings and where to stream.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-4"
          >
            <UsernameField
              label="Your Letterboxd username"
              value={userA}
              onChange={setUserA}
              placeholder="e.g. deniz"
              autoFocus
            />
            <UsernameField
              label="Their Letterboxd username"
              value={userB}
              onChange={setUserB}
              placeholder="e.g. ada"
            />

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" fullWidth disabled={!canSubmit}>
              Start matching
            </Button>
          </form>
        </div>
      </main>
      <Footer />
    </StepShell>
  );
}

interface UsernameFieldProps {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

function UsernameField({ label, value, onChange, placeholder, autoFocus }: UsernameFieldProps) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">
        {label}
      </span>
      <div className="flex items-center surface-card focus-within:border-accent/70 transition-colors pl-3">
        <span className="text-ink-500 text-sm mr-1">@</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 bg-transparent py-3.5 pr-3 text-base placeholder:text-ink-500 focus:outline-none"
        />
      </div>
    </label>
  );
}
