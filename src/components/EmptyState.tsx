import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 my-4">
      <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mb-4 text-blue-400">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base sm:text-lg font-bold text-zinc-100 mb-1">{title}</h3>
      {description && <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mb-6 leading-relaxed">{description}</p>}
      
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-md shadow-blue-900/20"
          >
            {actionLabel}
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-zinc-200 text-xs sm:text-sm font-semibold rounded-xl border border-zinc-700 transition-all"
          >
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
