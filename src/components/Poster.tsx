import { cn } from '../utils/cn';

interface PosterProps {
  src?: string;
  title: string;
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Poster({ src, title, className, rounded = 'xl' }: PosterProps) {
  return (
    <div
      className={cn(
        'relative w-full aspect-[2/3] overflow-hidden bg-ink-800',
        rounded === 'sm' && 'rounded-md',
        rounded === 'md' && 'rounded-lg',
        rounded === 'lg' && 'rounded-xl',
        rounded === 'xl' && 'rounded-2xl',
        rounded === '2xl' && 'rounded-3xl',
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-4 text-center bg-gradient-to-br from-ink-800 to-ink-700">
          <div>
            <div className="text-ink-500 text-[10px] uppercase tracking-widest mb-2">
              no poster
            </div>
            <div className="font-display text-ink-100 text-lg leading-tight">
              {title}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
