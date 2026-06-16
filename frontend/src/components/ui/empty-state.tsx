interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12 text-gray-500">
      <div className="text-4xl mb-4">📭</div>
      <p className="text-lg font-medium text-gray-700">{title}</p>
      {description && <p className="text-sm mt-1 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
