import * as React from "react"
import { cn } from "@/lib/utils"

interface AccordionProps {
// //   type?: "single" | "multiple"
//   collapsible?: boolean
  className?: string
  children: React.ReactNode
}

const Accordion = ({ className, children }: AccordionProps) => {
  return (
    <div className={cn("w-full", className)}>
      {children}
    </div>
  )
}

interface AccordionItemProps {
  value: string
  className?: string
  children: React.ReactNode
}

const AccordionItem = ({ className, children }: AccordionItemProps) => {
  return (
    <div className={cn("border-b", className)}>
      {children}
    </div>
  )
}

interface AccordionTriggerProps {
  className?: string
  children: React.ReactNode
}

const AccordionTrigger = ({ className, children }: AccordionTriggerProps) => {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        "flex w-full items-center justify-between py-4 font-medium transition-all hover:underline",
        className
      )}
    >
      {children}
      <svg
        className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )
}

interface AccordionContentProps {
  className?: string
  children: React.ReactNode
}

const AccordionContent = ({ className, children }: AccordionContentProps) => {
  return (
    <div className={cn("overflow-hidden text-sm", className)}>
      <div className="pb-4 pt-0">{children}</div>
    </div>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } 