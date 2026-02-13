import type { ReactNode } from "react";

interface SliderProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  disabled = false,
}: SliderProps): ReactNode {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`flex flex-col gap-2 ${disabled ? "opacity-40" : ""}`}>
      {label !== undefined && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-400">{label}</span>
          <span className="text-sm font-semibold text-zinc-200">
            {value}
            {unit}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-500 accent-emerald-500"
        style={{
          background: `linear-gradient(to right, #10b981 0%, #10b981 ${String(percentage)}%, #2e2e44 ${String(percentage)}%, #2e2e44 100%)`,
        }}
      />
      <div className="flex justify-between text-[10px] text-zinc-600">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}
