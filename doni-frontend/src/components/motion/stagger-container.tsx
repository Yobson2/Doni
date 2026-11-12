import { motion } from 'framer-motion'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import {
  staggerContainer,
  staggerItem as staggerItemVariant,
} from '@/lib/motion'
import { cn } from '@/lib/utils'

interface StaggerContainerProps {
  className?: string
  children: React.ReactNode
}

export function StaggerContainer({ className, children }: StaggerContainerProps) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={cn(className)}
      variants={staggerContainer}
      initial='hidden'
      animate='visible'
    >
      {children}
    </motion.div>
  )
}

interface StaggerItemProps {
  className?: string
  children: React.ReactNode
}

export function StaggerItem({ className, children }: StaggerItemProps) {
  return (
    <motion.div className={cn(className)} variants={staggerItemVariant}>
      {children}
    </motion.div>
  )
}
