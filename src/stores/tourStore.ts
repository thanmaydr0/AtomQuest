import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TourState {
  isActive: boolean;
  currentStep: number;
  startTour: () => void;
  nextStep: () => void;
  exitTour: () => void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set) => ({
      isActive: false,
      currentStep: 0,
      startTour: () => set({ isActive: true, currentStep: 1 }),
      nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),
      exitTour: () => set({ isActive: false, currentStep: 0 }),
    }),
    {
      name: 'judge-tour-storage',
    }
  )
);
