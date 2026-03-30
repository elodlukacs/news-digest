interface TabHeaderProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function TabHeader({ icon, title, description }: TabHeaderProps) {
  return (
    <div className="text-center py-2 md:py-4">
      <div className="flex items-center justify-center gap-2 md:gap-3 mb-2">
        {icon}
        <h2 className="font-serif text-lg md:text-2xl font-bold text-ink">{title}</h2>
      </div>
      <p className="text-[13px] md:text-[15px] text-ink-muted max-w-2xl mx-auto leading-relaxed px-2">
        {description}
      </p>
    </div>
  );
}
