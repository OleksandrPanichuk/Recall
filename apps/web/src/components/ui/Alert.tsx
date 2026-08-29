import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
	"relative w-full rounded-lg border p-4 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7",
	{
		variants: {
			variant: {
				default: "bg-card text-card-foreground",
				success: "border-success/40 bg-success/10 text-foreground",
				destructive: "border-destructive/40 bg-destructive/10 text-foreground",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

export type AlertProps = ComponentProps<"div"> &
	VariantProps<typeof alertVariants>;

export function Alert({ className, variant, ...props }: AlertProps) {
	return (
		<div
			role="alert"
			className={cn(alertVariants({ variant }), className)}
			{...props}
		/>
	);
}

export function AlertTitle({ className, ...props }: ComponentProps<"h5">) {
	return (
		<h5
			className={cn("mb-1 font-medium leading-none tracking-tight", className)}
			{...props}
		/>
	);
}

export function AlertDescription({
	className,
	...props
}: ComponentProps<"div">) {
	return (
		<div
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}
