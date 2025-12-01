import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, title, className = '', action }) => {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-gray-900 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="text-lg font-bold text-gray-900">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};