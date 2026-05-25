import { useState, useEffect } from "react";
import { useSignIn } from "@clerk/clerk-react";
import { Shield, Github, AlertCircle, ExternalLink } from "lucide-react";

export default function GitHubLoginGateway() {
  const { signIn, isLoaded } = useSignIn();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    // Check if we are running inside an iframe (sandboxed development environment)
    try {
      setIsEmbedded(window.self !== window.top);
    } catch {
      setIsEmbedded(true);
    }
  }, []);

  const handleGitHubLogin = async () => {
    if (!isLoaded) return;
    setIsLoggingIn(true);
    setErrorMsg(null);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_github",
        redirectUrl: window.location.origin,
        redirectUrlComplete: window.location.origin,
      });
    } catch (err: any) {
      console.error("Error during GitHub login:", err);
      setErrorMsg(err?.message || "Authentication initiation failed. Please try again.");
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1e1f22] text-[#dbdee1] flex flex-col items-center justify-center p-4 relative font-sans antialiased overflow-hidden select-none">
      {/* Background cyber grid highlights */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#313338_1px,transparent_1px),linear-gradient(to_bottom,#313338_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#5865F2]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container Card */}
      <div className="w-full max-w-md bg-[#2b2d31] border border-[#3f4147]/40 rounded-3xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.5)] relative z-10 animate-[fadeIn_0.3s_ease-out]">
        
        {/* Top Header Panel */}
        <div className="bg-[#1e1f22]/70 p-6 text-center border-b border-[#1e1f22] relative">
          <div className="w-12 h-12 rounded-2xl bg-[#5865F2]/10 border border-[#5865F2]/25 text-[#5865F2] flex items-center justify-center mx-auto mb-3.5 shadow-inner">
            <Shield className="w-6 h-6 animate-pulse" />
          </div>
          <span className="text-[10px] font-mono tracking-widest text-[#5865F2] uppercase font-bold flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-[pulse_1.5s_infinite]" />
            HMG Secure Gateway
          </span>
          <p className="text-xs text-stone-400 font-sans mt-0.5 max-w-xs mx-auto">
            Authorized admin gateway authentication requested.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {isEmbedded ? (
            <div className="space-y-5">
              <div className="bg-[#5865F2]/10 border border-[#5865F2]/25 p-4 rounded-2xl text-center space-y-2">
                <p className="text-xs font-semibold text-white">Iframe Sandbox Restriction</p>
                <p className="text-[11px] text-stone-400 leading-normal">
                  Browser security rules block GitHub OAuth redirects inside sandboxed web previews. 
                  Launch the dashboard in a new browser tab to sign in securely.
                </p>
              </div>

              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-xs font-mono rounded-xl transition-all cursor-pointer shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Gateway in New Tab</span>
              </a>

              <div className="text-center">
                <button
                  onClick={handleGitHubLogin}
                  disabled={isLoggingIn || !isLoaded}
                  className="text-[10px] text-stone-500 hover:text-stone-300 font-mono transition-colors cursor-pointer underline"
                >
                  Or try direct inline redirect anyway
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={handleGitHubLogin}
                disabled={isLoggingIn || !isLoaded}
                className="w-full py-3 bg-[#24292e] hover:bg-[#1f2327] disabled:bg-[#1b1f23] text-white font-bold text-xs font-mono rounded-xl transition-all cursor-pointer shadow-sm active:scale-[0.98] flex items-center justify-center gap-2.5 border border-stone-800"
              >
                {isLoggingIn ? (
                  <>
                    <div className="w-3.5 h-3.5 border border-stone-200 border-t-transparent rounded-full animate-spin" />
                    <span>Connecting to GitHub...</span>
                  </>
                ) : (
                  <>
                    <Github className="w-4 h-4 text-white" />
                    <span>Sign in with GitHub</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error notification */}
          {errorMsg && (
            <div className="bg-red-950/20 border border-red-900/40 p-3.5 rounded-xl flex items-start gap-2.5 text-red-400 text-[11px] font-sans animate-[fadeIn_0.15s_ease-out]">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-300">Authentication Alert</p>
                <p className="mt-0.5 leading-normal text-stone-300">{errorMsg}</p>
              </div>
            </div>
          )}
        </div>

        {/* Security Footer Notice */}
        <div className="bg-[#1e1f22]/40 px-6 py-4 border-t border-[#1e1f22] text-center text-[9px] font-mono text-stone-550 leading-relaxed">
          🔒 Encrypted TLS Connection &bull; Homelab Gateway Shell
        </div>

      </div>

      <div className="text-center mt-6 text-[#4e5058] text-[9px] font-mono uppercase tracking-widest leading-loose">
        Security System Control Host v1.4 &bull; Active Firewalls Armed
      </div>
    </div>
  );
}
