"use client";

export function LoadingSpinner({ size = "md", label }: { size?: "sm" | "md" | "lg"; label?: string }) {
  const sizeMap = {
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        {/* Outer ring */}
        <div
          className={`${sizeMap[size]} rounded-full border-2 border-blue-500/20`}
        />
        {/* Spinning arc */}
        <div
          className={`${sizeMap[size]} absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 border-r-cyan-400 spin-slow`}
        />
        {/* Inner glow */}
        <div
          className={`absolute inset-1 rounded-full bg-blue-500/5`}
        />
      </div>
      {label && (
        <p className="text-sm text-slate-400 animate-pulse">{label}</p>
      )}
    </div>
  );
}

export function PageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" label={label} />
    </div>
  );
}

export function ButtonSpinner() {
  return (
    <svg className="w-4 h-4 spin-slow" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="50"
        strokeDashoffset="15"
        strokeLinecap="round"
      />
    </svg>
  );
}
