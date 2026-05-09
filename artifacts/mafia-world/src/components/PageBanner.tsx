interface PageBannerProps {
  image: string;
  title: string;
  subtitle?: string;
}

export function PageBanner({ image, title, subtitle }: PageBannerProps) {
  return (
    <div className="relative w-full h-44 sm:h-56 rounded-xl overflow-hidden mb-6 shadow-[0_0_30px_rgba(0,0,0,0.6)]">
      <img
        src={image}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 p-6">
        <h1 className="text-3xl sm:text-4xl font-heading font-bold uppercase tracking-widest text-white drop-shadow-lg">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-white/70 mt-1 font-mono tracking-wider">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
