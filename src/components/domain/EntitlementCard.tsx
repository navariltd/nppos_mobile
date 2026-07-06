import { EntitlementTypeBadge } from '@/components/domain/badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { getHamper } from '@/data/mock';
import { formatKES } from '@/lib/format';
import type { Entitlement } from '@/types/domain';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
	const hamper = getHamper(entitlement.hamperId);

	return (
		<Card>
			<CardContent className="gap-3 pt-6">
				<View className="flex-row items-center justify-between">
					<View className="flex-row items-center gap-2">
						<EntitlementTypeBadge type={entitlement.type} />
						{issued && (
							<View className="flex-row items-center gap-1">
								<MaterialIcons name="check-circle" size={14} color="#059669" />
								<Text className="text-xs text-emerald-600">Issued</Text>
							</View>
						)}
					</View>
					{entitlement.amount != null && (
						<Text className="text-lg font-semibold">{formatKES(entitlement.amount)}</Text>
					)}
				</View>

				{hamper && (
					<View className="gap-2">
						<Text className="font-medium">{hamper.name}</Text>
						<View className="gap-1">
							{hamper.items.map((it) => (
								<View key={it.itemName} className="flex-row justify-between">
									<Text className="text-muted-foreground text-sm">{it.itemName}</Text>
									<Text className="text-sm">
										{it.qtyPerHousehold} {it.unit}
										{householdSize ? ` × ${householdSize}` : ''}
									</Text>
								</View>
							))}
						</View>
					</View>
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
