// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { SessionProvider, useSession } from './app/SessionContext';
import { LandingPage } from './features/onboarding/LandingPage';
import { PairLoadingPage } from './features/pair/PairLoadingPage';
import { PairResultsPage } from './features/pair/PairResultsPage';
import { PairWatchlistError } from './services/pairWatchlists';

const pairWatchlistsMock = vi.hoisted(() => vi.fn());

vi.mock('framer-motion', async () => {
  const React = await import('react');

  function createMotionElement(tag: string) {
    return function MotionElement({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      layout: _layout,
      ...props
    }: Record<string, unknown> & { children?: React.ReactNode }) {
      return React.createElement(tag, props, children);
    };
  }

  const motion = new Proxy(
    {},
    {
      get: (_target, key) => createMotionElement(typeof key === 'string' ? key : 'div'),
    },
  );

  return {
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    LayoutGroup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    motion,
  };
});

vi.mock('./services/pairWatchlists', async () => {
  const actual = await vi.importActual<typeof import('./services/pairWatchlists')>(
    './services/pairWatchlists',
  );
  return {
    ...actual,
    pairWatchlists: pairWatchlistsMock,
  };
});

interface RenderedTree {
  container: HTMLDivElement;
  cleanup: () => void;
}

function makeItem(slug: string, title: string) {
  return {
    slug,
    title,
    year: 2023,
    posterUrl: `https://images.test/${slug}.jpg`,
    synopsis: `${title} synopsis`,
    runtime: 101,
    genres: ['Drama'],
    directors: ['Director'],
    lbRating: 4.3,
    lbRatingCount: 2400,
    letterboxdUrl: `https://letterboxd.com/film/${slug}/`,
    source: 'both' as const,
    enriched: true,
  };
}

function makeStub(item: ReturnType<typeof makeItem>) {
  return {
    ...item,
    genres: [],
    directors: [],
    synopsis: undefined,
    runtime: undefined,
    lbRating: undefined,
    lbRatingCount: undefined,
    enriched: false,
  };
}

function makeResult(userA: string, userB: string, items: ReturnType<typeof makeItem>[]) {
  return {
    items,
    counts: {
      watchlistA: 12,
      watchlistB: 14,
      overlap: items.length,
      filtered: items.length,
      enriched: items.length,
    },
    userA,
    userB,
  };
}

async function renderElement(element: ReactNode): Promise<RenderedTree> {
  const container = document.createElement('div');
  document.body.innerHTML = '';
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(element);
  });

  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function renderApp(): Promise<RenderedTree> {
  return renderElement(<App />);
}

async function waitFor(assertion: () => void, timeoutMs = 2000): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }

  throw lastError;
}

async function click(element: Element): Promise<void> {
  await act(async () => {
    Simulate.click(element);
  });
}

function seedSession(userA: string, userB: string) {
  localStorage.setItem(
    'matchboxd:session:v2',
    JSON.stringify({ userA, userB, step: 'landing' }),
  );
}

async function submitPrefilledLanding(container: HTMLElement): Promise<void> {
  const submitButton = container.querySelector<HTMLButtonElement>('button[type="submit"]');
  const form = container.querySelector('form');
  if (!submitButton) {
    throw new Error('Expected landing submit button to exist');
  }
  if (!form) {
    throw new Error('Expected landing form to exist');
  }

  await waitFor(() => {
    expect(submitButton.disabled).toBe(false);
  });

  await act(async () => {
    Simulate.submit(form);
  });
}

function SessionHarness() {
  const { step, setStep, setUsernames } = useSession();

  return (
    <>
      <button
        type="button"
        id="run-alice"
        onClick={() => {
          setUsernames('alice', 'bob');
          setStep('pair-loading');
        }}
      >
        Run Alice
      </button>
      <button
        type="button"
        id="run-charlie"
        onClick={() => {
          setUsernames('charlie', 'dana');
          setStep('pair-loading');
        }}
      >
        Run Charlie
      </button>

      {step === 'landing' && <LandingPage />}
      {step === 'pair-loading' && <PairLoadingPage />}
      {step === 'pair-results' && <PairResultsPage />}
    </>
  );
}

describe('Matchboxd app flow', () => {
  let currentRender: RenderedTree | null = null;

  beforeEach(() => {
    pairWatchlistsMock.mockReset();
    localStorage.clear();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    currentRender?.cleanup();
    currentRender = null;
  });

  it('renders a single main landmark and a working skip link on landing', async () => {
    currentRender = await renderApp();

    expect(document.querySelectorAll('main')).toHaveLength(1);
    const skipLink = currentRender.container.querySelector('a[href="#main"]');
    expect(skipLink).not.toBeNull();
    expect(currentRender.container.querySelector('main#main')).not.toBeNull();
  });

  it('flows from landing to results after a valid submit', async () => {
    const result = makeResult('alice', 'bob', [makeItem('shared-film', 'Shared Film')]);

    pairWatchlistsMock.mockImplementation(async (_userA, _userB, options) => {
      options?.onStubs?.(result.items.map(makeStub), result.counts);
      result.items.forEach((item) => options?.onItem?.(item));
      return result;
    });

    seedSession('alice', 'bob');
    currentRender = await renderApp();
    await submitPrefilledLanding(currentRender.container);

    await waitFor(() => {
      expect(currentRender?.container.textContent).toContain('@alice');
      expect(currentRender?.container.textContent).toContain('Shared Film');
      expect(document.querySelectorAll('main')).toHaveLength(1);
    });
  });

  it('retries after a pairing failure and recovers', async () => {
    const result = makeResult('alice', 'bob', [makeItem('retry-film', 'Retry Film')]);

    pairWatchlistsMock
      .mockRejectedValueOnce(new PairWatchlistError('First run failed'))
      .mockImplementationOnce(async (_userA, _userB, options) => {
        options?.onStubs?.(result.items.map(makeStub), result.counts);
        return result;
      });

    seedSession('alice', 'bob');
    currentRender = await renderApp();
    await submitPrefilledLanding(currentRender.container);

    await waitFor(() => {
      expect(currentRender?.container.textContent).toContain("We couldn't finish matching.");
    });

    const retryButton = Array.from(currentRender.container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Try again'));
    expect(retryButton).not.toBeUndefined();

    await click(retryButton!);

    await waitFor(() => {
      expect(currentRender?.container.textContent).toContain('Retry Film');
    });
  });

  it('ignores stale run updates after a second pairing starts', async () => {
    const pendingRuns = new Map<string, () => void>();

    pairWatchlistsMock.mockImplementation((userA: string, userB: string, options) => {
      return new Promise((resolve) => {
        pendingRuns.set(`${userA}-${userB}`, () => {
          const result = makeResult(userA, userB, [
            makeItem(`${userA}-${userB}-film`, `${userA} ${userB} Film`),
          ]);
          options?.onStubs?.(result.items.map(makeStub), result.counts);
          resolve(result);
        });
      });
    });

    currentRender = await renderElement(
      <SessionProvider>
        <SessionHarness />
      </SessionProvider>,
    );

    await click(currentRender.container.querySelector('#run-alice')!);
    await click(currentRender.container.querySelector('#run-charlie')!);

    await act(async () => {
      pendingRuns.get('charlie-dana')?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(currentRender?.container.textContent).toContain('charlie dana Film');
    });

    await act(async () => {
      pendingRuns.get('alice-bob')?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(currentRender?.container.textContent).toContain('charlie dana Film');
      expect(currentRender?.container.textContent).not.toContain('alice bob Film');
    });
  });

  it('updates all JustWatch links from the global country selector', async () => {
    const result = makeResult('alice', 'bob', [
      makeItem('first-film', 'First Film'),
      makeItem('second-film', 'Second Film'),
    ]);

    pairWatchlistsMock.mockImplementation(async (_userA, _userB, options) => {
      options?.onStubs?.(result.items.map(makeStub), result.counts);
      return result;
    });

    seedSession('alice', 'bob');
    currentRender = await renderApp();
    await submitPrefilledLanding(currentRender.container);

    await waitFor(() => {
      expect(currentRender?.container.textContent).toContain('First Film');
    });

    const countrySelect = currentRender.container.querySelector<HTMLSelectElement>(
      'select[aria-label="JustWatch country"]',
    );
    expect(countrySelect).not.toBeNull();

    await act(async () => {
      countrySelect!.value = 'tr';
      Simulate.change(countrySelect!);
    });

    const justWatchLinks = Array.from(
      currentRender.container.querySelectorAll<HTMLAnchorElement>('a'),
    ).filter((anchor) => anchor.textContent?.includes('Search JustWatch'));

    expect(justWatchLinks).toHaveLength(2);
    justWatchLinks.forEach((anchor) => {
      expect(anchor.href).toContain('https://www.justwatch.com/tr/arama?q=');
    });
  });
});
