import { useState, useEffect, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  title: string;
  storageKey: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export default function CollapsibleCard({
  title,
  storageKey,
  defaultOpen = true,
  children,
  className,
}: Props) {
  const storageKeyFull = `collapsed_${storageKey}`;

  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return defaultOpen;
    const stored = localStorage.getItem(storageKeyFull);
    if (stored === null) return defaultOpen;
    return stored !== 'true';
  });

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem(storageKeyFull, String(!next));
      return next;
    });
  };

  return (
    <Card className={cn('mb-6', className)}>
      <CardHeader
        className="flex flex-row items-center justify-between cursor-pointer select-none py-3 sm:py-4"
        onClick={toggle}
      >
        <CardTitle className="text-lg">{title}</CardTitle>
        <ChevronDown
          size={18}
          className={`text-gray-400 transition-transform duration-200 ${
            open ? '' : '-rotate-90'
          }`}
        />
      </CardHeader>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}
