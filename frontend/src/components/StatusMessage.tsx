import { ReactNode } from 'react';

interface LoadingMessageProps {
  children?: ReactNode;
  className?: string;
}

export function LoadingMessage({ children = '読み込み中...', className = '' }: LoadingMessageProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`text-sm text-gray-400 dark:text-gray-500 ${className}`}
    >
      {children}
    </p>
  );
}

interface ErrorMessageProps {
  children: ReactNode;
  className?: string;
}

export function ErrorMessage({ children, className = '' }: ErrorMessageProps) {
  return (
    <p role="alert" aria-live="assertive" className={`text-sm text-red-600 dark:text-red-400 ${className}`}>
      {children}
    </p>
  );
}
