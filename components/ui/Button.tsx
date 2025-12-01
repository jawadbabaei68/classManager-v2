import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false,
  className = '',
  ...props 
}) => {
  const baseStyle = "px-4 py-3 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 shadow-lg",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    outline: "border-2 border-gray-200 text-gray-600 hover:border-gray-300",
    danger: "bg-red-50 text-red-600 hover:bg-red-100"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};