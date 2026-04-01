interface TabHeaderProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function TabHeader({ icon, title, description }: TabHeaderProps) {
  return (
    <div className="pt-6 md:pt-8 mb-6 border-b border-rule pb-4">
      <div className="flex items-center gap-2.5 md:gap-3">
        {icon}
        <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-black text-masthead leading-none">
          {title}
        </h1>
      </div>
      <p className="text-xs sm:text-[13px] text-ink-muted mt-1.5 sm:mt-2 font-[family-name:var(--font-body)] max-w-2xl">
        {description}
      </p>
    </div>
  );
}
