import { cn } from '@/utils/cn'
import type { ComponentPropsWithRef } from 'react'

type LabelProps = ComponentPropsWithRef<'label'>

export function Label({ className, ...props }: LabelProps) {
  return <label className={cn('text-sm font-medium text-foreground', className)} {...props} />
}
