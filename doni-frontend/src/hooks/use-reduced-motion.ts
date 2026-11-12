import * as React from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState<
    boolean | undefined
  >(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(REDUCED_MOTION_QUERY)
    const onChange = () => {
      setPrefersReducedMotion(mql.matches)
    }
    mql.addEventListener('change', onChange)
    setPrefersReducedMotion(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return !!prefersReducedMotion
}
