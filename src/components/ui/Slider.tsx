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
            style={{ color: "rgba(55, 53, 47, 0.65)" }}
          >
            {label}
          </span>
          <span
            className="rounded px-2 py-0.5 text-sm font-semibold"
            style={{
              background: "rgba(55, 53, 47, 0.08)",
              color: "rgba(55, 53, 47, 1)",
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
          background: `linear-gradient(to right, #222222 0%, #222222 ${String(percentage)}%, rgba(55,53,47,0.16) ${String(percentage)}%, rgba(55,53,47,0.16) 100%)`,
        }}
      />
      <div
        className="flex justify-between text-[11px]"
        style={{ color: "rgba(55, 53, 47, 0.45)" }}
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
