
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false, 
  icon,
  className = '',
  ...props 
}) => {
  const baseStyles = "rounded-xl font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary-600 text-white shadow-lg shadow-primary-200/50 dark:shadow-none hover:bg-primary-700",
    secondary: "bg-secondary-600 text-white shadow-lg shadow-secondary-200/50 dark:shadow-none hover:bg-secondary-700",
    accent: "bg-accent-500 text-white shadow-lg shadow-accent-200/50 dark:shadow-none hover:bg-accent-600",
    danger: "bg-red-500 text-white shadow-lg shadow-red-200/50 dark:shadow-none hover:bg-red-600",
    ghost: "bg-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400",
    outline: "border-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary-500 hover:text-primary-500 dark:hover:text-primary-400"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-3 text-sm",
    lg: "px-6 py-4 text-base"
  };

  const widthStyle = fullWidth ? "w-full" : "";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyle} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
