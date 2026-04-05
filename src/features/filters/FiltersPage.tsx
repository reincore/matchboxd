import { useMemo, useState } from 'react';
import { useSession } from '../../app/SessionContext';
import { Footer } from '../../components/Footer';
import { Header } from '../../components/Header';
import { StepShell } from '../../components/StepShell';
import { Button } from '../../components/Button';
import { CONSTRAINTS, MOODS } from '../../data/moods';
import type { Constraint, Mood } from '../../types';
import { cn } from '../../utils/cn';
import { generateCandidates } from '../../services/recommendationEngine';
import { emptyProfile } from '../../services/tasteProfile';

export function FiltersPage() {
  const {
    userA,
    userB,
    analysis,
    filters,
    setFilters,
    setCandidates,
    setStep,
  } = useSession();

  const [mood, setMood] = useState<Mood | null>(filters.mood);
  const [constraints, setConstraints] = useState<Constraint[]>(filters.constraints);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleConstraint = (c: Constraint) => {
    setConstraints((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c],
    );
  };

  const disabledPairs = useMemo(
    () => new Map<Constraint, Constraint>([
      ['short-runtime', 'long-runtime'],
      ['long-runtime', 'short-runtime'],
      ['classic', 'modern'],
      ['modern', 'classic'],
    ]),
    [],
  );

  const isDisabled = (c: Constraint): boolean => {
    const pair = disabledPairs.get(c);
    return !!pair && constraints.includes(pair);
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    const newFilters = { mood, constraints };
    setFilters(newFilters);
    try {
      const profileA = analysis?.profileA ?? emptyProfile(userA);
      const profileB = analysis?.profileB ?? emptyProfile(userB);
      const candidates = await generateCandidates(profileA, profileB, newFilters);
      if (candidates.length === 0) {
        setError(
          "We couldn't find candidates that fit those constraints. Try loosening them.",
        );
        setLoading(false);
        return;
      }
      setCandidates(candidates);
      setStep('swipe');
    } catch {
      setError('Something went wrong while finding candidates. Try again.');
      setLoading(false);
    }
  };

  return (
    <StepShell>
      <Header onRestart={() => setStep('landing')} step="filters" />
      <main className="flex-1 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto w-full py-6">
          <section className="mb-8">
            <div className="text-xs uppercase tracking-wider text-ink-400 mb-2">
              Tonight's vibe
            </div>
            <h2 className="font-display text-2xl sm:text-3xl mb-4">
              What kind of night is this?
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {MOODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMood(mood === m.id ? null : m.id)}
                  aria-pressed={mood === m.id}
                  className={cn(
                    'group relative flex flex-col items-start p-3 rounded-2xl border text-left transition-all focus-ring',
                    mood === m.id
                      ? 'border-accent bg-accent/10 shadow-accent-glow'
                      : 'border-ink-700 bg-ink-900/60 hover:border-ink-500',
                  )}
                >
                  <span className="text-2xl mb-1.5">{m.emoji}</span>
                  <span className="font-semibold text-sm">{m.label}</span>
                  <span className="text-[11px] text-ink-400 leading-tight mt-0.5">
                    {m.description}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <div className="text-xs uppercase tracking-wider text-ink-400 mb-2">
              Hard constraints (optional)
            </div>
            <h2 className="font-display text-2xl mb-4">Anything off the table?</h2>
            <div className="flex flex-wrap gap-2">
              {CONSTRAINTS.map((c) => {
                const active = constraints.includes(c.id);
                const disabled = isDisabled(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => !disabled && toggleConstraint(c.id)}
                    aria-pressed={active}
                    disabled={disabled}
                    className={cn(
                      'chip transition-colors focus-ring',
                      active
                        ? 'border-accent bg-accent/15 text-accent-soft'
                        : 'chip-muted hover:border-ink-500',
                      disabled && 'opacity-30 cursor-not-allowed',
                    )}
                    title={c.hint}
                  >
                    {c.label}
                    {c.hint && (
                      <span className="text-ink-500 font-normal">· {c.hint}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {analysis?.notes && analysis.notes.length > 0 && (
            <div className="surface-card p-3.5 mb-6">
              {analysis.notes.map((n, i) => (
                <div key={i} className="text-xs text-ink-400 leading-relaxed">
                  · {n}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <Button variant="ghost" onClick={() => setStep('landing')}>
              Back
            </Button>
            <Button size="lg" onClick={submit} disabled={loading}>
              {loading ? 'Finding candidates…' : 'Find tonight\u2019s candidates'}
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </StepShell>
  );
}
