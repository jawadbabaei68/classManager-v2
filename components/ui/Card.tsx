
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  variant?: 'default' | 'outlined' | 'flat';
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, hoverable = false, variant = 'default' }) => {
  let variantStyles = "bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700";
  
  if (variant === 'outlined') {
    variantStyles = "bg-transparent border-2 border-gray-200 dark:border-gray-700";
  } else if (variant === 'flat') {
    variantStyles = "bg-gray-50 dark:bg-gray-700 border-none shadow-none";
  }

  const hoverStyle = hoverable ? "hover:shadow-md cursor-pointer active:scale-[0.99]" : "";
  const baseStyle = "rounded-3xl p-5 transition-all";

  return (
    <div 
      className={`${baseStyle} ${variantStyles} ${hoverStyle} ${className}`} 
      onClick={onClick}
    >
      {children}
    </div>
  );
};
