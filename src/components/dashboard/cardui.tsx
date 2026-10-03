// card-ui.tsx
"use client"

import { cx } from "class-variance-authority"
import React, { ReactNode, HTMLAttributes } from "react"


interface CardUiProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
  className?: string
  animated?: boolean
  delay?: string
}

export default function CardUi({
  children,
  className,
  animated,
  delay,
  ...props
}: CardUiProps) {
  return (
    <div
      className={cx(
        "rounded-md bg-white shadow",
        animated && "animate-fadeSlideUp", // class animasi kustom
        className
      )}
      style={{ animationDelay: delay }} // terapkan delay
      {...props}
    >
      {children}
    </div>
  )
}
