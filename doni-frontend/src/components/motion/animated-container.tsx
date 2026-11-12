import { motion } from 'framer-motion'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { variants, type VariantName } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface AnimatedContainerProps {
  variant?: VariantName
  delay?: number
  className?: string
  children: React.ReactNode
}

export function AnimatedContainer({
  variant = 'fadeSlideUp',
  delay = 0,
  className,
  children,
}: AnimatedContainerProps) {
  const prefersReducedMotion = useReducedMotion()
  const selectedVariant = variants[variant]

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={cn(className)}
      variants={selectedVariant}
      initial='hidden'
      animate='visible'
      transition={delay ? { delay } : undefined}
    >
      {children}
    </motion.div>
  )
}
