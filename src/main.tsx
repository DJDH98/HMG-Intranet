import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthenticateWithRedirectCallback, ClerkProvider } from '@clerk/clerk-react';
import { Analytics } from '@vercel/analytics/react';
import App from './App.tsx';
import './index.css';

const PUBLISHABLE_KEY = (import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY || "pk_test_c3VwZXJiLW11dHQtNDkuY2xlcmsuYWNjb3VudHMuZGV2JA";

const getBasePath = () => "/";

const getCallbackPath = () => `${getBasePath()}sso-callback`;

const isCallbackPath = () => window.location.pathname.replace(/\/$/, "") === getCallbackPath();

document.documentElement.dataset.uiTheme = "nebula";

function OAuthCallbackPage() {
  useEffect(() => {
    const fallback = window.setTimeout(() => {
      window.location.replace(getBasePath());
    }, 8000);

    return () => window.clearTimeout(fallback);
  }, []);

  return (
    <div className="min-h-screen bg-[#1e1f22] text-[#dbdee1] flex flex-col items-center justify-center p-6 text-center select-none font-sans">
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl={getBasePath()}
        signUpForceRedirectUrl={getBasePath()}
        signInFallbackRedirectUrl={getBasePath()}
        signUpFallbackRedirectUrl={getBasePath()}
      />
      <div className="w-full max-w-sm bg-[#2b2d31] border border-[#3f4147]/40 p-8 rounded-3xl shadow-xl space-y-4">
        <div className="w-10 h-10 border-2 border-[#5865F2] border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="space-y-1">
          <h1 className="text-sm font-bold text-white tracking-tight">Completing GitHub sign-in</h1>
          <p className="text-xs text-stone-400">
            Returning to the HMG Intranet security gate...
          </p>
        </div>
      </div>
    </div>
  );
}

function Root() {
  if (!PUBLISHABLE_KEY) {
    return (
      <div className="min-h-screen bg-[#1e1f22] text-[#dbdee1] flex flex-col items-center justify-center p-6 text-center select-none font-sans">
        <div className="max-w-md w-full bg-[#2b2d31] border border-red-900/40 p-8 rounded-3xl shadow-xl space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">Configuration Required</h2>
            <p className="text-xs text-stone-400">
              The <code className="bg-[#1e1f22] px-1.5 py-0.5 rounded text-rose-400 font-mono">VITE_CLERK_PUBLISHABLE_KEY</code> environment variable is missing or empty.
            </p>
          </div>
          <div className="bg-[#1e1f22] p-4 rounded-xl text-left border border-[#3f4147]/40 space-y-2 text-xs">
            <p className="font-semibold text-white">How to fix this:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-stone-400 font-sans">
              <li>Retrieve your Publishable Key from the Clerk Dashboard.</li>
              <li>Open your deployment environment settings.</li>
              <li>Add a secret with the key <code className="bg-[#2b2d31] px-1 py-0.5 rounded text-white font-mono">VITE_CLERK_PUBLISHABLE_KEY</code> and save.</li>
            </ol>
          </div>
          <p className="text-[10px] font-mono text-stone-550">
            🔒 HMG Intranet Secure Shell
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider 
      publishableKey={PUBLISHABLE_KEY} 
      afterSignOutUrl={getBasePath()}
      signInForceRedirectUrl={getBasePath()}
      signUpForceRedirectUrl={getBasePath()}
      syncSessionWithOrigin
    >
      {isCallbackPath() ? <OAuthCallbackPage /> : <App />}
      <Analytics />
    </ClerkProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
