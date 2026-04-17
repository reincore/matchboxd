import { useState } from 'react';
import { useSession } from '../../app/SessionContext';
import { Button } from '../../components/Button';
import { Footer } from '../../components/Footer';
import { Header } from '../../components/Header';
import { StepShell } from '../../components/StepShell';
import { FormField } from '../../components/ui/FormField';
import { validateLetterboxdUsername } from '../../utils/slug';

export function LandingPage() {
  const { userA: savedA, userB: savedB, setUsernames, setStep } = useSession();
  const [userA, setUserA] = useState(savedA);
  const [userB, setUserB] = useState(savedB);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = userA.trim().length > 0 && userB.trim().length > 0;

  const submit = () => {
    const a = userA.trim().replace(/^@/, '');
    const b = userB.trim().replace(/^@/, '');
    const errA = validateLetterboxdUsername(a);
    if (errA) {
      setError(errA);
      return;
    }
    const errB = validateLetterboxdUsername(b);
    if (errB) {
      setError(errB);
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
      <main id="main" className="flex flex-1 items-center px-4 sm:px-6">
        <div className="max-w-xl xl:max-w-2xl mx-auto w-full py-8">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-ink-700 bg-ink-900/60 text-[11px] xl:text-[12px] text-ink-300 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              Stop scrolling. Start watching.
            </div>
            <h1 className="font-display text-4xl sm:text-5xl xl:text-6xl leading-[1.05] tracking-tight mb-4">
              Find tonight's movie without the{' '}
              <span className="text-accent">45-minute debate</span>.
            </h1>
            <p className="text-ink-300 text-base sm:text-lg xl:text-xl leading-relaxed">
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
              id="user-a"
              label="Your Letterboxd username"
              value={userA}
              onChange={setUserA}
              placeholder="e.g. DenizSaglam"
              autoFocus
            />
            <UsernameField
              id="user-b"
              label="Their Letterboxd username"
              value={userB}
              onChange={setUserB}
              placeholder="e.g. Perzona"
            />

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
              >
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
  id: string;
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

function UsernameField({ id, label, value, onChange, placeholder, autoFocus }: UsernameFieldProps) {
  return (
    <FormField label={label} htmlFor={id}>
      <div className="surface-field flex items-center rounded-2xl pl-3 transition-colors focus-within:border-accent/70">
        <span className="text-ink-500 text-sm xl:text-base mr-1">@</span>
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 bg-transparent py-3.5 xl:py-4 pr-3 text-base xl:text-lg placeholder:text-ink-500 focus:outline-none"
        />
      </div>
    </FormField>
  );
}
