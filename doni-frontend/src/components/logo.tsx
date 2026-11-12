import { type SVGProps } from 'react'

/*
 * Doni logo — "doni doni" (little by little).
 * The d's stem rises to an ochre block: the latest contribution on top.
 * Drawn on a 64-unit grid, 8-unit stroke. Source files: public/images/brand/.
 *
 * Colour: the body follows `currentColor` (set it with text-primary,
 * text-primary-foreground…); the top block uses --highlight (kola ochre).
 * Pass accent='currentColor' for a one-colour version.
 */

type LogoProps = SVGProps<SVGSVGElement> & {
  /** Top block colour. Defaults to the kola ochre highlight token. */
  accent?: string
}

function Bowl() {
  return (
    <circle
      cx='32'
      cy='42'
      r='12'
      fill='none'
      stroke='currentColor'
      strokeWidth='8'
    />
  )
}

/** Symbol only. Use `small` below 24px: a wider gap keeps the block legible. */
export function Logo({
  accent = 'var(--highlight)',
  small = false,
  ...props
}: LogoProps & { small?: boolean }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='4 4 56 56'
      aria-hidden='true'
      {...props}
    >
      <Bowl />
      <rect
        x='40'
        y={small ? 20 : 18}
        width='8'
        height={small ? 38 : 40}
        rx='2'
        fill='currentColor'
      />
      <rect x='40' y='6' width='8' height='8' rx='2' fill={accent} />
    </svg>
  )
}

/**
 * Small-size cut as a standalone component (e.g. for `logo: ElementType` props).
 * @public Part of the documented logo API (docs/brand/logo.md).
 */
export function LogoSmall(props: LogoProps) {
  return <Logo small {...props} />
}

/** Drawn "doni" wordmark. Size it by height (e.g. h-6); width follows. */
export function Wordmark({ accent = 'var(--highlight)', ...props }: LogoProps) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='12 2 130 60'
      role='img'
      aria-label='Doni'
      {...props}
    >
      <Bowl />
      <rect x='40' y='18' width='8' height='40' rx='2' fill='currentColor' />
      <rect x='40' y='6' width='8' height='8' rx='2' fill={accent} />
      <circle
        cx='70'
        cy='42'
        r='12'
        fill='none'
        stroke='currentColor'
        strokeWidth='8'
      />
      <path
        d='M96 26V58M96 42a12 12 0 0 1 24 0V58'
        fill='none'
        stroke='currentColor'
        strokeWidth='8'
      />
      <rect x='130' y='26' width='8' height='32' fill='currentColor' />
      <rect x='130' y='14' width='8' height='8' rx='2' fill='currentColor' />
    </svg>
  )
}
