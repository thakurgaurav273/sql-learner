"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui"

function ScrollArea({
  className,
  children,
  viewportRef,
  viewportClassName,
  horizontal = false,
  type = "hover",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  /** ref to the scrolling element (for scrollTo / scrollIntoView) */
  viewportRef?: React.Ref<HTMLDivElement>
  viewportClassName?: string
  /** also show a horizontal scrollbar */
  horizontal?: boolean
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      type={type}
      scrollHideDelay={700}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className={cn(
          "size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
          viewportClassName
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      {horizontal && <ScrollBar orientation="horizontal" />}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "group/sb z-20 flex touch-none p-[3px] transition-[opacity,width,height] duration-200 select-none data-[state=hidden]:opacity-0",
        orientation === "vertical" && "h-full w-2.5 hover:w-3",
        orientation === "horizontal" && "h-2.5 flex-col hover:h-3",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-[var(--scrollbar)] transition-colors group-hover/sb:bg-[var(--scrollbar-hover)]"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
