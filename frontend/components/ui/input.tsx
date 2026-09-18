import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const inputVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center overflow-hidden rounded-4xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 rounded-[3px]",
  {
    variants: {
      variant: {
        default: "bg-gray-300 file:text-sm file:font-medium file:text-foreground px-[10px] inline",
      },
      size: {
        default:
          "h-10 w-[220px] gap-1.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 w-[140px] gap-1 px-0 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        s: "h-8 w-[180px] gap-1 px-0 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xxl: "h-12 w-[260px] gap-1.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)


function Input({ className, variant = "default", size = "default", type, ...props }: Omit<React.ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Input }

      