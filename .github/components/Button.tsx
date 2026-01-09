import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  loadingText?: string;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading = false, 
  fullWidth = false,
  icon,
  className = '',
  disabled,
  loadingText = "Processing...",
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center px-4 py-2.5 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed text-sm";
  
  const variants = {
    primary: "bg-facebook-blue hover:bg-facebook-dark text-white focus:ring-blue-500 shadow-sm",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-400 shadow-sm",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-sm",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-400"
  };

  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${widthClass} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {loadingText}
        </>
      ) : (
        <>
          {icon && <span className="mr-2">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};