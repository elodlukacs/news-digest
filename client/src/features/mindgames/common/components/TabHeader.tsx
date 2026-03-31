interface TabHeaderProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function TabHeader({ icon, title, description }: TabHeaderProps) {
  return (
    <div className="py-3 md:py-6">
      <div className="flex items-center gap-2.5 md:gap-3 mb-2">
        {icon}
        <h2 className="font-serif text-xl md:text-3xl font-bold text-ink">{title}</h2>
      </div>
      <p className="text-sm md:text-base text-ink-muted max-w-2xl leading-relaxed">
        {description}
      </p>
    </div>
  );
}
