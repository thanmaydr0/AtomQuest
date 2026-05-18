import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Goal, GoalCycle } from '@/types';
import toast from 'react-hot-toast';

type GoalEvent = 'goal_saved' | 'goal_submitted';

async function notifyGoalEvent(event: GoalEvent, payload: Record<string, unknown>) {
  try {
    await supabase.functions.invoke('notify-goal-event', {
      body: { event, ...payload },
    });
  } catch (error) {
    console.warn(`[goalStore] notify-goal-event failed for ${event}:`, error);
  }
}

interface GoalStore {
  goals: Goal[];
  activeCycle: GoalCycle | null;
  loading: boolean;
  submitting: boolean;

  fetchActiveCycle: () => Promise<GoalCycle | null>;
  fetchGoals: (userId: string, cycleId: string) => Promise<void>;
  createGoal: (goal: Omit<Goal, 'goal_id' | 'created_at' | 'updated_at'>) => Promise<Goal | null>;
  updateGoal: (goalId: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (goalId: string) => Promise<void>;
  submitGoalSheet: (userId: string, cycleId: string) => Promise<void>;
}

export const useGoalStore = create<GoalStore>((set, get) => ({
  goals: [],
  activeCycle: null,
  loading: false,
  submitting: false,

  fetchActiveCycle: async () => {
    const { data, error } = await supabase
      .from('goal_cycles')
      .select('*')
      .eq('status', 'active')
      .limit(1)
      .single();

    if (error) {
      console.error('Failed to fetch active cycle:', error.message);
      return null;
    }

    const cycle = data as GoalCycle;
    set({ activeCycle: cycle });
    return cycle;
  },

  fetchGoals: async (userId: string, cycleId: string) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('owner_id', userId)
      .eq('cycle_id', cycleId)
      .order('created_at', { ascending: true });

    if (error) {
      toast.error('Failed to load goals');
      set({ loading: false });
      return;
    }

    set({ goals: (data ?? []) as Goal[], loading: false });
  },

  createGoal: async (goal) => {
    const { data, error } = await supabase
      .from('goals')
      .insert(goal)
      .select()
      .single();

    if (error) {
      toast.error(`Failed to create goal: ${error.message}`);
      return null;
    }

    const newGoal = data as Goal;
    set({ goals: [...get().goals, newGoal] });
    toast.success('Goal created');
    return newGoal;
  },

  updateGoal: async (goalId, updates) => {
    const { error } = await supabase
      .from('goals')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('goal_id', goalId);

    if (error) {
      toast.error(`Failed to update goal: ${error.message}`);
      return;
    }

    set({
      goals: get().goals.map((g) =>
        g.goal_id === goalId ? { ...g, ...updates } : g
      ),
    });

    const updatedGoal = get().goals.find((g) => g.goal_id === goalId);
    if (updatedGoal) {
      await notifyGoalEvent('goal_saved', {
        goalId,
        ownerId: updatedGoal.owner_id,
        cycleId: updatedGoal.cycle_id,
        linkPath: '/manager/approvals',
      });
    }

    toast.success('Goal updated');
  },

  deleteGoal: async (goalId) => {
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('goal_id', goalId);

    if (error) {
      toast.error(`Failed to delete goal: ${error.message}`);
      return;
    }

    set({ goals: get().goals.filter((g) => g.goal_id !== goalId) });
    toast.success('Goal deleted');
  },

  submitGoalSheet: async (userId, cycleId) => {
    set({ submitting: true });

    const { error } = await supabase
      .from('goals')
      .update({ status: 'submitted', updated_at: new Date().toISOString() })
      .eq('owner_id', userId)
      .eq('cycle_id', cycleId)
      .in('status', ['draft', 'returned']);

    if (error) {
      toast.error(`Failed to submit goal sheet: ${error.message}`);
      set({ submitting: false });
      return;
    }

    const affectedGoals = get().goals.filter((g) => g.status === 'draft' || g.status === 'returned');

    // Refresh goals to reflect new status
    set({
      submitting: false,
      goals: get().goals.map((g) =>
        g.status === 'draft' || g.status === 'returned'
          ? { ...g, status: 'submitted' as const }
          : g
      ),
    });

    await notifyGoalEvent('goal_submitted', {
      ownerId: userId,
      cycleId,
      goalId: affectedGoals[0]?.goal_id,
      linkPath: '/manager/approvals',
    });

    toast.success('Goal sheet submitted for approval!');
  },
}));
