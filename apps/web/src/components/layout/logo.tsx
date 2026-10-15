import { Link } from 'react-router';
import { cn } from '@/lib/utils';

/** SILT wordmark: wide-tracked letters with a rust bar standing in for the "I". */
export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <Link to="/" aria-label="SILT — на главную" className={cn('inline-flex items-center', className)}>
      <svg viewBox="0 0 112 22" className="h-[18px] w-auto" aria-hidden>
        <g fill={light ? '#F4F1EA' : '#141414'}>
          <path d="M1.2 16.4c1.9 1.7 4.3 2.6 6.9 2.6 3 0 4.8-1.3 4.8-3.3 0-1.8-1.2-2.7-4.4-3.4l-1.9-.4C2.9 11.1 1.5 9.6 1.5 7c0-3.1 2.7-5.2 6.5-5.2 2.4 0 4.6.7 6.2 1.9l-1.2 2c-1.4-1-3.1-1.6-5-1.6-2.4 0-3.9 1.1-3.9 2.8 0 1.6 1.1 2.4 4 3l1.9.4c3.8.8 5.4 2.4 5.4 5.1 0 3.4-2.8 5.6-7.4 5.6-3 0-5.8-1-7.9-2.8z" />
          <path d="M62 2.1h2.6v16.6h9.6v2.3H62zM92.4 4.4h-6.3V2.1h15.2v2.3H95V21h-2.6z" />
        </g>
        <rect x="37" y="2.1" width="3.4" height="18.9" fill="#C4572B" />
      </svg>
    </Link>
  );
}
