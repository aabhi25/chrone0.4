import { ReactNode } from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  iconColor: string;
  change?: {
    value: string;
    positive?: boolean;
  };
}

export default function StatsCard({ title, value, icon, iconColor, change }: StatsCardProps) {
  return (
    <div className="bg-card p-6 rounded-lg border border-border" data-testid={`stats-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{title}</p>
          <p className="text-2xl font-bold" data-testid={`stats-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </p>
        </div>
        <div className={`w-12 h-12 ${iconColor} rounded-lg flex items-center justify-center`}>
          <i className={`${icon} text-white`}></i>
        </div>
      </div>
      {change && (
        <div className="mt-4 flex items-center text-sm">
          <i className={`fas ${change.positive ? 'fa-arrow-up text-green-500' : change.positive === false ? 'fa-arrow-down text-red-500' : 'fa-minus text-gray-500'} mr-1`}></i>
          <span className={change.positive ? 'text-green-500' : change.positive === false ? 'text-red-500' : 'text-gray-500'}>
            {change.value}
          </span>
        </div>
      )}
    </div>
  );
}
