import { type SVGProps } from 'react'

export function Logo({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      {...props}
    >
      <rect x='3' y='3' width='18' height='18' rx='3' />
      <polyline points='8,9 12,13 8,17' />
      <line x1='14' y1='17' x2='18' y2='17' />
    </svg>
  )
}
