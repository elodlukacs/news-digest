import * as React from 'react';
import { cn } from '@/lib/utils';

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ value, onValueChange, min = 0, max = 100, step = 1, className, disabled }, ref) => {
    const pct = ((value[0] - min) / (max - min)) * 100;

    return (
      <div className={cn('relative flex items-center w-full', className)}>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[0]}
          onChange={(e) => onValueChange([Number(e.target.value)])}
          disabled={disabled}
          className="w-full h-1.5 appearance-none bg-ink/15 rounded-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-masthead [&::-webkit-slider-thumb]:shadow-sm
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-paper
            [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-masthead [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-paper"
          style={{
            background: `linear-gradient(to right, var(--color-masthead) 0%, var(--color-masthead) ${pct}%, rgba(0,0,0,0.1) ${pct}%, rgba(0,0,0,0.1) 100%)`,
          }}
        />
      </div>
    );
  }
);
Slider.displayName = 'Slider';

export { Slider };
