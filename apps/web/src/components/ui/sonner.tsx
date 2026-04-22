"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-950 group-[.toaster]:border-slate-200 group-[.toaster]:shadow-lg",
          description: "group-[.toaster]:text-slate-500",
          actionButton:
            "group-[.toaster]:bg-slate-900 group-[.toaster]:text-slate-50",
          cancelButton:
            "group-[.toaster]:bg-slate-100 group-[.toaster]:text-slate-500",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
