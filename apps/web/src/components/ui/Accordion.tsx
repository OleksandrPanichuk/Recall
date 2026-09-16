import { ChevronDown } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

export function Accordion({
	...props
}: ComponentProps<typeof AccordionPrimitive.Root>) {
	return <AccordionPrimitive.Root {...props} />;
}

export function AccordionItem({
	className,
	...props
}: ComponentProps<typeof AccordionPrimitive.Item>) {
	return <AccordionPrimitive.Item className={cn(className)} {...props} />;
}

export function AccordionTrigger({
	className,
	children,
	...props
}: ComponentProps<typeof AccordionPrimitive.Trigger>) {
	return (
		<AccordionPrimitive.Header className="flex">
			<AccordionPrimitive.Trigger
				className={cn(
					"flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg:last-child]:rotate-180",
					className,
				)}
				{...props}
			>
				{children}
				<ChevronDown className="pointer-events-none size-4 shrink-0 transition-transform duration-200" />
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
}

export function AccordionContent({
	className,
	children,
	...props
}: ComponentProps<typeof AccordionPrimitive.Content>) {
	return (
		<AccordionPrimitive.Content
			className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
			{...props}
		>
			<div className={cn("pt-2", className)}>{children}</div>
		</AccordionPrimitive.Content>
	);
}
