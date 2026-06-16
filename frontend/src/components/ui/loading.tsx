export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className || 'py-8'}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
    </div>
  );
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className || 'h-4 w-full'}`} />
  );
}
