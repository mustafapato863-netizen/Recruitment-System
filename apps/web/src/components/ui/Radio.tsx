import { cn } from '@/lib/utils';


export interface RadioOption {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export function RadioGroup({
  name,
  options,
  value,
  onChange,
  className,
  orientation = 'vertical',
}: RadioGroupProps) {
  return (
    <div
      role="radiogroup"
      className={cn(
        'gap-3',
        orientation === 'horizontal' ? 'flex flex-wrap items-center' : 'flex flex-col',
        className
      )}
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const id = `${name}-${opt.value}`;

        return (
          <label
            key={opt.value}
            htmlFor={id}
            className={cn(
              'flex items-start gap-2.5 cursor-pointer select-none text-sm',
              opt.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <input
              type="radio"
              id={id}
              name={name}
              value={opt.value}
              checked={isSelected}
              disabled={opt.disabled}
              onChange={() => onChange?.(opt.value)}
              className="mt-0.5 h-4 w-4 text-[var(--primary)] border-rf-border focus:ring-2 focus:ring-[var(--primary)]"
            />
            <div className="flex flex-col">
              <span className="font-medium text-rf-ink">{opt.label}</span>
              {opt.description && <span className="text-xs text-rf-ink-muted">{opt.description}</span>}
            </div>
          </label>
        );
      })}
    </div>
  );
}
