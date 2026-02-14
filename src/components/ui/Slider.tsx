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
          <span
            className="text-sm font-medium"
            style={{ color: "var(--color-notion-text-secondary)" }}
          >
            {label}
          </span>
          <span
            className="rounded px-2 py-0.5 text-sm font-semibold"
            style={{
              background: "var(--color-notion-bg-tertiary)",
              color: "var(--color-notion-text)",
            }}
          >
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
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(to right, var(--color-btn-primary) 0%, var(--color-btn-primary) ${String(percentage)}%, var(--color-notion-border) ${String(percentage)}%, var(--color-notion-border) 100%)`,
        }}
      />
      <div
        className="flex justify-between text-[11px]"
        style={{ color: "var(--color-notion-text-tertiary)" }}
      >
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
