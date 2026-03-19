import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react';
import { cx } from './utils';

const MIN_LOADING_MS = 420;
const LOADING_EXIT_MS = 180;
const ERROR_RESET_MS = 2600;

interface NewsletterSignupProps {
  endpoint: string;
  variant?: string;
}

type Phase = 'idle' | 'submitting' | 'result';
type Tone = 'neutral' | 'success' | 'error';
type FormSubmitEvent = Parameters<NonNullable<ComponentPropsWithoutRef<'form'>['onSubmit']>>[0];

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof payload.message === 'string' &&
    payload.message.trim() !== ''
  ) {
    return payload.message.trim();
  }

  return "sorry, that didn't work. please try again.";
}

export default function NewsletterSignup({ endpoint, variant = 'default' }: NewsletterSignupProps) {
  const emailId = `newsletter-email-${variant}`;
  const honeypotId = `newsletter-website-${variant}`;
  const emailRef = useRef<HTMLInputElement | null>(null);
  const errorResetTimer = useRef<number | null>(null);
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [tone, setTone] = useState<Tone>('neutral');
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoadingExit, setIsLoadingExit] = useState(false);

  useEffect(() => {
    return () => {
      if (errorResetTimer.current !== null) {
        window.clearTimeout(errorResetTimer.current);
      }
    };
  }, []);

  const resetToIdle = () => {
    setPhase('idle');
    setTone('neutral');
    setStatusMessage('');
    setIsLoadingExit(false);
    emailRef.current?.focus();
  };

  const clearErrorResetTimer = () => {
    if (errorResetTimer.current !== null) {
      window.clearTimeout(errorResetTimer.current);
      errorResetTimer.current = null;
    }
  };

  const scheduleErrorReset = () => {
    clearErrorResetTimer();
    errorResetTimer.current = window.setTimeout(() => {
      errorResetTimer.current = null;
      setTone((value) => {
        if (value === 'error') {
          resetToIdle();
        }
        return value;
      });
    }, ERROR_RESET_MS);
  };

  const showImmediateError = (message: string) => {
    setPhase('result');
    setTone('error');
    setStatusMessage(message);
    setIsLoadingExit(false);
    scheduleErrorReset();
  };

  const handleSubmit = async (event: FormSubmitEvent) => {
    event.preventDefault();
    if (phase === 'submitting') return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showImmediateError('enter your email first.');
      return;
    }

    if (!emailRef.current?.checkValidity()) {
      showImmediateError('please enter a valid email.');
      return;
    }

    clearErrorResetTimer();
    setPhase('submitting');
    setTone('neutral');
    setStatusMessage('');

    const startedAt = performance.now();
    let nextTone: Tone = 'success';
    let nextMessage = 'you are in. thank you.';
    let shouldReset = true;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          source: variant,
          page_url: window.location.href,
          website,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(readErrorMessage(payload));
      }

      if (
        payload &&
        typeof payload === 'object' &&
        'already_subscribed' in payload &&
        Boolean(payload.already_subscribed)
      ) {
        nextMessage = 'already subscribed. thank you :)';
      }
    } catch (error) {
      nextTone = 'error';
      nextMessage = error instanceof Error ? error.message : 'sorry, something went wrong. please try again.';
      shouldReset = false;
    }

    const elapsed = performance.now() - startedAt;
    if (elapsed < MIN_LOADING_MS) {
      await delay(MIN_LOADING_MS - elapsed);
    }

    setIsLoadingExit(true);
    await delay(LOADING_EXIT_MS);

    setIsLoadingExit(false);
    setPhase('result');
    setTone(nextTone);
    setStatusMessage(nextMessage);

    if (shouldReset) {
      setEmail('');
      setWebsite('');
      clearErrorResetTimer();
    } else {
      scheduleErrorReset();
    }
  };

  return (
    <section
      className={cx(
        'newsletter-signup',
        `newsletter-signup--${variant}`,
        phase === 'result' && tone === 'success' && 'is-success',
        phase === 'result' && tone === 'error' && 'is-error',
        isLoadingExit && 'is-loading-exit',
      )}
      data-phase={phase}
      onClick={() => {
        if (phase === 'result' && tone === 'error') {
          clearErrorResetTimer();
          resetToIdle();
        }
      }}
    >
      <div className="newsletter-pill">
        <form className="newsletter-form" noValidate onSubmit={handleSubmit}>
          <span className="newsletter-prompt" aria-hidden="true">
            want to subscribe?
          </span>
          <label className="sr-only" htmlFor={emailId}>
            Email address
          </label>
          <label className="sr-only" htmlFor={honeypotId}>
            Website
          </label>
          <input
            ref={emailRef}
            id={emailId}
            className="newsletter-email"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="enter your email"
            value={email}
            disabled={phase === 'submitting'}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            id={honeypotId}
            className="newsletter-honeypot"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
          <button className="newsletter-submit" type="submit" aria-label="Subscribe" aria-busy={phase === 'submitting'}>
            [yes]
          </button>
        </form>

        <p className="newsletter-loading" aria-hidden={phase === 'submitting' ? 'false' : 'true'}>
          just a sec...
        </p>
        <p className="newsletter-status" aria-live="polite" aria-atomic="true" aria-hidden={phase === 'result' ? 'false' : 'true'}>
          {statusMessage}
        </p>
      </div>
    </section>
  );
}
