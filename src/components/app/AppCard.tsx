import React from 'react';

interface AppCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const AppCard = ({ children, className = '', onClick }: AppCardProps) => (
  <div
    onClick={onClick}
    className={`bg-card dark:bg-card rounded-kakao-lg p-kakao-lg shadow-soft dark:shadow-none border border-transparent dark:border-border transition-all duration-200 hover:shadow-card hover:-translate-y-0.5 ${className} ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}
  >
    {children}
  </div>
);

export default AppCard;
