export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-[12px] font-bold uppercase tracking-wider text-brand-700">{eyebrow}</p>}
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-white ${className}`}>{children}</section>;
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/60 px-6 py-10 text-center">
      <p className="text-[16px] font-bold text-brand-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{text}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
