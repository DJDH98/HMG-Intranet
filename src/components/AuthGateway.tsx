import React, { useState, FormEvent } from "react";
import { 
  Shield, 
  Lock, 
  Unlock,
  Key, 
  ArrowRight, 
  AlertCircle
} from "lucide-react";

interface AuthGatewayProps {
  onAuthSuccess: (user: { name: string; email: string; picture?: string }) => void;
  authError: string | null;
  setAuthError: (err: string | null) => void;
}

export default function AuthGateway({ onAuthSuccess, authError, setAuthError }: AuthGatewayProps) {
  const [passcodeInput, setPasscodeInput] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitPasscode = (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);

    // Simulate a tiny visual cyber-verification timeout feels premium
    setTimeout(() => {
      const code = passcodeInput.trim();

      if (code === "Whoknows5759") {
        onAuthSuccess({
          name: "Dalen Harris",
          email: "dalenharris1998@gmail.com"
        });
      } else {
        setAuthError("Unauthorized payload. Invalid portal password.");
      }
      setIsSubmitting(false);
    }, 450);
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
            Authorized admin gateway password requested.
          </p>
        </div>

        {/* Input Form Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <form onSubmit={handleSubmitPasscode} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="portal-password" className="block text-[10px] uppercase font-mono tracking-wider text-stone-400 font-bold">
                Admin Secure Password
              </label>
              <div className="relative">
                <input
                  id="portal-password"
                  type={showPass ? "text" : "password"}
                  required
                  autoFocus
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  placeholder="Enter portal password"
                  className="w-full text-xs font-mono bg-[#1e1f22] border border-[#1e1f22] focus:border-[#5865F2] rounded-xl px-3.5 py-2.5 text-white placeholder:text-stone-600 focus:outline-hidden transition-all"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-3 text-[10px] font-mono font-bold text-stone-550 hover:text-stone-300 select-none cursor-pointer"
                  disabled={isSubmitting}
                >
                  {showPass ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-[#4e5058] hover:bg-[#5865F2] disabled:bg-[#35373c] text-white font-bold text-xs font-mono rounded-xl transition-all cursor-pointer shadow-sm active:scale-[0.98] flex items-center justify-center gap-1.5 border border-transparent hover:border-[#5865F2]/20"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border border-stone-200 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Key...</span>
                </>
              ) : (
                <>
                  <span>Unlock Gateway</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Error notification */}
          {authError && (
            <div className="bg-red-950/20 border border-red-900/40 p-3.5 rounded-xl flex items-start gap-2.5 text-red-400 text-[11px] font-sans animate-[fadeIn_0.15s_ease-out]">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-300">Security Access Alert</p>
                <p className="mt-0.5 leading-normal text-stone-300">{authError}</p>
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
        Security System Control Host v1.3 &bull; Active Firewalls Armed
      </div>
    </div>
  );
}
