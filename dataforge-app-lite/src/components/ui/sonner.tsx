"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-emerald-500 shrink-0" />,
        info:    <InfoIcon className="size-4 text-blue-500 shrink-0" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-500 shrink-0" />,
        error:   <OctagonXIcon className="size-4 text-rose-500 shrink-0" />,
        loading: <Loader2Icon className="size-4 animate-spin shrink-0" />,
      }}
      style={
        {
          "--normal-bg":      "var(--popover)",
          "--normal-text":    "var(--popover-foreground)",
          "--normal-border":  "var(--border)",
          "--border-radius":  "var(--radius)",
          // success — green border
          "--success-bg":     "var(--popover)",
          "--success-text":   "var(--popover-foreground)",
          "--success-border": "#22c55e",
          // error — red border
          "--error-bg":       "var(--popover)",
          "--error-text":     "var(--popover-foreground)",
          "--error-border":   "#ef4444",
          // warning — amber border
          "--warning-bg":     "var(--popover)",
          "--warning-text":   "var(--popover-foreground)",
          "--warning-border": "#f59e0b",
          // info — blue border
          "--info-bg":        "var(--popover)",
          "--info-text":      "var(--popover-foreground)",
          "--info-border":    "#3b82f6",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !border-l-2",
          icon:  "self-start mt-0.5",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
