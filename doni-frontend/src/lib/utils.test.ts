import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins truthy class names and drops falsy ones', () => {
    expect(cn('px-2', false, undefined, 'py-1')).toBe('px-2 py-1')
  })

  it('lets the last conflicting Tailwind class win', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
