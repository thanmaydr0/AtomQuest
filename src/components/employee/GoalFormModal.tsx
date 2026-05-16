import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Loader2, TrendingUp, TrendingDown, Clock, Ban, Lock } from 'lucide-react';
import type { Goal, UoMType } from '@/types';

const THRUST_AREAS = [
  'Revenue Growth', 'Cost Optimisation', 'Customer Experience',
  'People & Culture', 'Operational Excellence', 'Innovation',
] as const;

const goalSchemaBase = z.object({
  thrust_area: z.string().min(1, 'Thrust area is required'),
  title: z.string().min(1, 'Title is required').max(100, 'Title must be under 100 characters'),
  description: z.string().max(500, 'Description must be under 500 characters').default(''),
  uom_type: z.enum(['min', 'max', 'timeline', 'zero']),
  target_value: z.coerce.number().nullable().default(null),
  deadline_date: z.string().nullable().default(null),
  weightage: z.coerce.number().min(10, 'Minimum weightage is 10%').max(100, 'Maximum weightage is 100%'),
});

const goalSchema = goalSchemaBase.superRefine((data, ctx) => {
  if ((data.uom_type === 'min' || data.uom_type === 'max') && (data.target_value === null || data.target_value === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Target value is required for Min/Max UoM', path: ['target_value'] });
  }
  if (data.uom_type === 'timeline' && !data.deadline_date) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Deadline date is required for Timeline UoM', path: ['deadline_date'] });
  }
});

type GoalFormData = z.infer<typeof goalSchemaBase>;

interface GoalFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: GoalFormData) => Promise<void>;
  editingGoal?: Goal | null;
  currentWeightage: number;
  readOnly?: boolean;
  readOnlyFields?: string[]; // field names to lock (for shared goals)
}

const uomOptions: { value: UoMType; label: string; icon: React.ReactNode; hint: string }[] = [
  { value: 'min', label: 'Min', icon: <TrendingDown className="h-4 w-4" />, hint: 'Lower is better' },
  { value: 'max', label: 'Max', icon: <TrendingUp className="h-4 w-4" />, hint: 'Higher is better' },
  { value: 'timeline', label: 'Timeline', icon: <Clock className="h-4 w-4" />, hint: 'Complete by date' },
  { value: 'zero', label: 'Zero', icon: <Ban className="h-4 w-4" />, hint: 'Zero incidents' },
];

export function GoalFormModal({
  open, onClose, onSave, editingGoal, currentWeightage,
  readOnly = false, readOnlyFields = [],
}: GoalFormModalProps) {
  const isFieldLocked = (name: string) => readOnlyFields.includes(name);
  const isSharedEdit = readOnlyFields.length > 0;

  const {
    register, handleSubmit, control, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<GoalFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(goalSchema) as any,
    defaultValues: {
      thrust_area: '', title: '', description: '', uom_type: 'max',
      target_value: null, deadline_date: null, weightage: 10,
    },
  });

  const watchedUom = watch('uom_type');
  const watchedWeightage = watch('weightage') || 0;
  const remainingWeightage = 100 - currentWeightage;

  useEffect(() => {
    if (editingGoal) {
      reset({
        thrust_area: editingGoal.thrust_area, title: editingGoal.title,
        description: editingGoal.description || '', uom_type: editingGoal.uom_type,
        target_value: editingGoal.target_value, deadline_date: editingGoal.deadline_date,
        weightage: editingGoal.weightage,
      });
    } else {
      reset({
        thrust_area: '', title: '', description: '', uom_type: 'max',
        target_value: null, deadline_date: null,
        weightage: Math.min(remainingWeightage, 10) > 0 ? Math.min(remainingWeightage, 10) : 10,
      });
    }
  }, [editingGoal, open, reset, remainingWeightage]);

  if (!open) return null;

  const onSubmit = async (data: GoalFormData) => { await onSave(data); onClose(); };

  const inputClasses = (hasError: boolean) =>
    `w-full rounded-lg border bg-neutral-800/60 px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none transition-colors focus:border-[#fdb913] focus:ring-1 focus:ring-[#fdb913]/50 disabled:opacity-50 ${hasError ? 'border-red-500' : 'border-neutral-700'}`;

  const modalTitle = readOnly ? 'View Goal' : isSharedEdit ? 'Adjust Shared Goal' : editingGoal ? 'Edit Goal' : 'Add New Goal';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4">
      <div className="relative max-h-screen sm:max-h-[90vh] w-full sm:max-w-lg overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-800 bg-neutral-900/95 px-6 py-4 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-white">{modalTitle}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">
          {/* Shared goal banner */}
          {isSharedEdit && (
            <div className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-2.5 text-xs text-cyan-400">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              Shared goal — only weightage can be adjusted. Other fields are locked.
            </div>
          )}

          {/* Thrust Area */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-300">Thrust Area <span className="text-red-400">*</span></label>
            <select className={inputClasses(!!errors.thrust_area)} disabled={readOnly || isFieldLocked('thrust_area')} {...register('thrust_area')}>
              <option value="">Select a thrust area</option>
              {THRUST_AREAS.map((area) => (<option key={area} value={area}>{area}</option>))}
            </select>
            {errors.thrust_area && <p className="mt-1 text-xs text-red-400">{errors.thrust_area.message}</p>}
          </div>

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-300">Goal Title <span className="text-red-400">*</span></label>
            <input type="text" placeholder="e.g. Increase monthly revenue by 20%" className={inputClasses(!!errors.title)} disabled={readOnly || isFieldLocked('title')} maxLength={100} {...register('title')} />
            {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-300">Description</label>
            <textarea rows={3} placeholder="Describe the goal…" className={inputClasses(!!errors.description) + ' resize-none'} disabled={readOnly || isFieldLocked('description')} maxLength={500} {...register('description')} />
            {errors.description && <p className="mt-1 text-xs text-red-400">{errors.description.message}</p>}
          </div>

          {/* UoM */}
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-300">Unit of Measurement <span className="text-red-400">*</span></label>
            <Controller name="uom_type" control={control} render={({ field }) => (
              <div className="grid grid-cols-2 gap-2">
                {uomOptions.map((opt) => (
                  <button key={opt.value} type="button" disabled={readOnly || isFieldLocked('uom_type')}
                    onClick={() => field.onChange(opt.value)}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-all disabled:opacity-50 ${
                      field.value === opt.value ? 'border-[#fdb913]/50 bg-[#fdb913]/10 text-[#fdb913]' : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                    }`}>
                    {opt.icon}
                    <div><div className="font-medium">{opt.label}</div><div className="text-[10px] opacity-70">{opt.hint}</div></div>
                  </button>
                ))}
              </div>
            )} />
          </div>

          {/* Conditional: Target Value */}
          {(watchedUom === 'min' || watchedUom === 'max') && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-300">Target Value <span className="text-red-400">*</span></label>
              <input type="number" step="any" placeholder="e.g. 500" className={inputClasses(!!errors.target_value)} disabled={readOnly || isFieldLocked('target_value')} {...register('target_value')} />
              {errors.target_value && <p className="mt-1 text-xs text-red-400">{errors.target_value.message}</p>}
            </div>
          )}

          {/* Conditional: Deadline */}
          {watchedUom === 'timeline' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-300">Deadline Date <span className="text-red-400">*</span></label>
              <input type="date" className={inputClasses(!!errors.deadline_date)} disabled={readOnly || isFieldLocked('deadline_date')} {...register('deadline_date')} />
              {errors.deadline_date && <p className="mt-1 text-xs text-red-400">{errors.deadline_date.message}</p>}
            </div>
          )}

          {/* Zero helper */}
          {watchedUom === 'zero' && (
            <div className="rounded-lg border border-neutral-700 bg-neutral-800/40 px-4 py-3 text-sm text-neutral-400">
              ✅ <strong className="text-neutral-300">Success = zero incidents.</strong> No target value needed.
            </div>
          )}

          {/* Weightage — always editable unless fully readOnly */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-300">Weightage (%) <span className="text-red-400">*</span></label>
            <input type="number" min={10} max={100} step={10} className={inputClasses(!!errors.weightage)} disabled={readOnly} {...register('weightage')} />
            {!readOnly && (
              <p className="mt-1.5 text-xs text-neutral-500">
                {remainingWeightage - watchedWeightage + (editingGoal?.weightage || 0)}% remaining across all goals
              </p>
            )}
            {errors.weightage && <p className="mt-1 text-xs text-red-400">{errors.weightage.message}</p>}
          </div>

          {/* Actions */}
          {!readOnly && (
            <div className="flex items-center gap-3 border-t border-neutral-800 pt-5">
              <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#fdb913] px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-[#fdb913]/90 disabled:opacity-50">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSharedEdit ? 'Save Weightage' : editingGoal ? 'Update Goal' : 'Create Goal'}
              </button>
            </div>
          )}

          {readOnly && (
            <div className="border-t border-neutral-800 pt-5">
              <button type="button" onClick={onClose} className="w-full rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800">Close</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
