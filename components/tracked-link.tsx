"use client"

import * as React from "react"
import { track } from "@vercel/analytics"

interface TrackedLinkProps extends React.ComponentProps<"a"> {
  eventName: string
}

export function TrackedLink({ eventName, onClick, ...props }: TrackedLinkProps) {
  return (
    <a
      {...props}
      onClick={(event) => {
        track(eventName)
        onClick?.(event)
      }}
    />
  )
}
