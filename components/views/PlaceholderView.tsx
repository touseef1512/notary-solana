import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PlaceholderViewProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({ title, description, icon: Icon }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full px-4 text-center">
      <div className="w-20 h-20 bg-brand-card flex items-center justify-center mb-6 border border-brand-border">
        <Icon className="w-10 h-10 text-brand-muted" />
      </div>
      <h2 className="text-3xl font-bold text-brand-text mb-3">{title}</h2>
      <p className="text-brand-muted max-w-md mx-auto mb-8 text-sm uppercase tracking-wide font-mono">
        {description}
      </p>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-card border border-brand-accent text-brand-accent text-xs font-mono uppercase tracking-widest">
        <div className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
        Coming Soon
      </div>
    </div>
  );
};
