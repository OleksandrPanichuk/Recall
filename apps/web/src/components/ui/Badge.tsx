import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
	{
		variants: {
			variant: {
				default: "border-transparent bg-secondary text-secondary-foreground",
				outline: "text-foreground",
				success:
					"border-transparent bg-success/15 text-success-foreground/90 [--tw-text-opacity:1] text-success",
				destructive: "border-transparent bg-destructive/15 text-destructive",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

export type BadgeProps = ComponentProps<"span"> &
	VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<span className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}
