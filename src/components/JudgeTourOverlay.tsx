import { useState } from 'react';
import { useTourStore } from '../stores/tourStore';
import { useAuthStore } from '../stores/authStore';
import { ChevronRight, X, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TOUR_STEPS = [
  {
    step: 1,
    title: "Step 1: Employee View",
    text: "Welcome! Employees use this dashboard to track their active goals, submit check-ins, and view feedback from their manager. Notice the clear visibility into their progress.",
    nextActionText: "Switch to Manager View",
    nextEmail: "demo-manager@atomquest.com",
    nextPass: "judge2026",
    nextRoute: "/manager"
  },
  {
    step: 2,
    title: "Step 2: Manager View",
    text: "You are now a Manager. From here, you can oversee your team's goals, approve pending check-ins, and identify team members who might need an escalation or help.",
    nextActionText: "Switch to Admin View",
    nextEmail: "demo-admin@atomquest.com",
    nextPass: "judge2026",
    nextRoute: "/admin"
  },
  {
    step: 3,
    title: "Step 3: Admin & Analytics",
    text: "Finally, the Admin view. Admins have global visibility. Here they can see AI-powered risk scoring, what-if simulations, and sync the entire organization's data to Google Sheets in one click.",
    nextActionText: "End Tour",
    nextEmail: null,
    nextPass: null,
    nextRoute: null
  }
];

export function JudgeTourOverlay() {
  const { isActive, currentStep, nextStep, exitTour } = useTourStore();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (!isActive || currentStep === 0) return null;

  const currentStepData = TOUR_STEPS.find(s => s.step === currentStep);
  if (!currentStepData) {
    exitTour();
    return null;
  }

  const handleNext = async () => {
    if (!currentStepData.nextEmail) {
      exitTour();
      await useAuthStore.getState().signOut();
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      await useAuthStore.getState().signOut();
      // Small delay to let signOut propagate
      await new Promise((r) => setTimeout(r, 200));
      await useAuthStore.getState().signIn(
        currentStepData.nextEmail,
        currentStepData.nextPass!
      );
      
      nextStep();
      navigate(currentStepData.nextRoute as string);
    } catch (err: any) {
      alert(`Demo transition failed: ${err.message}. Please ensure the demo accounts are created.`);
      exitTour();
    } finally {
      setLoading(false);
    }
  };

  const handleExit = async () => {
    exitTour();
    await useAuthStore.getState().signOut();
    navigate('/login');
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-3xl bg-neutral-900/95 backdrop-blur-xl border border-[#fdb913]/30 rounded-2xl shadow-2xl p-5 z-[9999] flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-bottom-10 fade-in duration-500">
      
      {/* Decorative pulse */}
      <div className="hidden md:flex h-12 w-12 rounded-full bg-[#fdb913]/10 items-center justify-center flex-shrink-0 relative">
        <div className="absolute inset-0 rounded-full bg-[#fdb913]/20 animate-ping opacity-75"></div>
        <Sparkles className="h-6 w-6 text-[#fdb913]" />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-[#fdb913] text-black text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
            Hackathon Judge Mode
          </span>
          <h3 className="text-white font-bold text-lg">{currentStepData.title}</h3>
        </div>
        <p className="text-neutral-300 text-sm leading-relaxed">
          {currentStepData.text}
        </p>
      </div>

      <div className="flex items-center gap-3 w-full md:w-auto">
        <button 
          onClick={handleExit}
          className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors flex-1 md:flex-none text-center"
          disabled={loading}
        >
          Exit Demo
        </button>
        <button
          onClick={handleNext}
          disabled={loading}
          className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#fdb913] hover:bg-[#e5a611] text-black px-6 py-2.5 rounded-xl font-bold shadow-[0_0_20px_rgba(253,185,19,0.3)] transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              {currentStepData.nextActionText}
              {currentStepData.nextEmail && <ChevronRight className="h-4 w-4" />}
            </>
          )}
        </button>
      </div>
      
      {/* Close cross in top right */}
      <button onClick={handleExit} className="absolute -top-3 -right-3 h-8 w-8 bg-neutral-800 border border-neutral-700 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700 shadow-lg">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
