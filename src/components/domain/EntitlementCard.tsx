import { EntitlementTypeBadge } from '@/components/domain/badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { formatKES } from '@/lib/format';
import { useHamper } from '@/repositories';
import type { Entitlement } from '@/types/domain';
import { CircleCheck, ChevronDown } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

export function EntitlementCard({
	entitlement,
	householdSize,
	actionLabel,
	onAction,
	disabled,
}: {
	entitlement: Entitlement;
	householdSize?: number;
	actionLabel?: string;
	onAction?: () => void;
	disabled?: boolean;
}) {
	const issued = entitlement.status === 'issued';
	const hamper = useHamper(entitlement.hamperId);
	const [open, setOpen] = React.useState(false);

	return (
		<Card>
			<CardContent className="gap-3 pt-5">
				<View className="flex-row items-center justify-between">
					<View className="flex-row items-center gap-2">
						<EntitlementTypeBadge type={entitlement.type} />
						{issued && (
							<View className="flex-row items-center gap-1">
								<Icon as={CircleCheck} size={14} className="text-success" />
								<Text className="text-success text-xs font-medium">Issued</Text>
							</View>
						)}
					</View>
					{entitlement.amount != null && (
						<Text className="font-display text-lg">{formatKES(entitlement.amount)}</Text>
					)}
				</View>

				{hamper && (
					<Collapsible open={open} onOpenChange={setOpen} className="gap-2">
						<View className="flex-row items-center justify-between">
							<Text className="flex-1 font-medium" numberOfLines={2}>
								{hamper.name}
							</Text>
							<CollapsibleTrigger className="flex-row items-center gap-1 rounded-full px-2 py-1 active:opacity-60">
								<Text className="text-muted-foreground text-xs font-medium">
									{hamper.items.length} items
								</Text>
								<View className={open ? 'rotate-180' : undefined}>
									<Icon as={ChevronDown} size={14} className="text-muted-foreground" />
								</View>
							</CollapsibleTrigger>
						</View>
						<CollapsibleContent>
							<View className="bg-muted/50 gap-1.5 rounded-lg px-3 py-2.5">
								{hamper.items.map((it) => (
									<View key={it.itemName} className="flex-row justify-between">
										<Text className="text-muted-foreground text-sm">{it.itemName}</Text>
										<Text className="text-sm font-medium">
											{it.qtyPerHousehold} {it.unit}
											{householdSize ? ` × ${householdSize}` : ''}
										</Text>
									</View>
								))}
							</View>
						</CollapsibleContent>
					</Collapsible>
				)}

				{actionLabel && (
					<>
						<Separator />
						<Button onPress={onAction} disabled={disabled || issued}>
							<Text>{issued ? 'Already issued' : actionLabel}</Text>
						</Button>
					</>
				)}
			</CardContent>
		</Card>
	);
}
