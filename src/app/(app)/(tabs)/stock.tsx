import { Screen } from '@/components/domain/Screen';
import { FadeInView, Stat } from '@/components/domain/widgets';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useActivePosProfile } from '@/hooks/pos-profile';
import { reportDamagedStock, returnStock, useAgentStock } from '@/repositories';
import type { AgentStockRow } from '@/types/domain';
import { TriangleAlert, Undo2 } from 'lucide-react-native';
import * as React from 'react';
import { Alert, View } from 'react-native';

type Adjust = { row: AgentStockRow; kind: 'return' | 'damaged' };

export default function Stock() {
	const profile = useActivePosProfile();
	const agentStock = useAgentStock(profile?.warehouse);
	const [adjust, setAdjust] = React.useState<Adjust | null>(null);
	const [qty, setQty] = React.useState('1');

	const totalOnHand = agentStock.reduce((s, r) => s + r.onHand, 0);
	const totalIssued = agentStock.reduce((s, r) => s + r.issuedToday, 0);
	const totalDamaged = agentStock.reduce((s, r) => s + r.damaged, 0);

	const open = (row: AgentStockRow, kind: Adjust['kind']) => {
		setQty('1');
		setAdjust({ row, kind });
	};

	const confirm = () => {
		if (!adjust) return;
		const n = Number(qty) || 0;
		const result =
			adjust.kind === 'return'
				? returnStock(adjust.row.warehouse, adjust.row.hamperId, n)
				: reportDamagedStock(adjust.row.warehouse, adjust.row.hamperId, n);
		setAdjust(null);
		if (!result.ok) {
			Alert.alert('Could not record', result.reason);
		}
	};

	return (
		<Screen edges={['top']}>
			<View>
				<Text variant="h3">Stock</Text>
				<Text className="text-muted-foreground mt-0.5 text-sm">
					{profile ? `${profile.warehouse} · ${profile.name}` : 'no active POS profile'}
				</Text>
			</View>

			<FadeInView>
				<Card className="bg-primary border-primary">
					<CardContent className="flex-row pt-5">
						<Stat
							label="On hand"
							value={String(totalOnHand)}
							valueClassName="text-primary-foreground"
							labelClassName="text-primary-foreground/60"
						/>
						<Stat
							label="Issued today"
							value={String(totalIssued)}
							valueClassName="text-primary-foreground"
							labelClassName="text-primary-foreground/60"
						/>
						<Stat
							label="Damaged"
							value={String(totalDamaged)}
							valueClassName="text-primary-foreground"
							labelClassName="text-primary-foreground/60"
						/>
					</CardContent>
				</Card>
			</FadeInView>

			{agentStock.map((row, i) => (
				<FadeInView key={row.hamperId} delay={80 + i * 70}>
					<Card>
						<CardHeader>
							<View className="flex-row items-center justify-between gap-2">
								<CardTitle className="flex-1" numberOfLines={2}>
									{row.hamperName}
								</CardTitle>
								<Badge variant="secondary">
									<Text>{row.hamperId}</Text>
								</Badge>
							</View>
						</CardHeader>
						<CardContent className="gap-3">
							<View className="flex-row">
								<Stat label="On hand" value={String(row.onHand)} />
								<Stat label="Issued" value={String(row.issuedToday)} />
								<Stat label="Damaged" value={String(row.damaged)} />
							</View>
							<Separator />
							<View className="flex-row gap-2">
								<Button
									variant="outline"
									size="sm"
									className="flex-1"
									onPress={() => open(row, 'return')}
								>
									<Icon as={Undo2} size={16} className="text-foreground" />
									<Text>Return</Text>
								</Button>
								<Button
									variant="outline"
									size="sm"
									className="flex-1"
									onPress={() => open(row, 'damaged')}
								>
									<Icon as={TriangleAlert} size={16} className="text-warning" />
									<Text>Damaged</Text>
								</Button>
							</View>
						</CardContent>
					</Card>
				</FadeInView>
			))}

			<AlertDialog open={adjust !== null} onOpenChange={(o) => !o && setAdjust(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{adjust?.kind === 'return' ? 'Return stock' : 'Report damaged / expired'}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{adjust?.kind === 'return'
								? `Return units of ${adjust?.row.hamperName} to the central warehouse. Recorded offline and queued for sync.`
								: `Write off units of ${adjust?.row.hamperName} as unusable. Recorded offline and queued for sync.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<View className="gap-1.5">
						<Text className="text-muted-foreground text-xs">
							Quantity (max {adjust?.row.onHand ?? 0})
						</Text>
						<Input
							value={qty}
							onChangeText={setQty}
							keyboardType="number-pad"
							className="h-12 rounded-xl"
						/>
					</View>
					<AlertDialogFooter>
						<AlertDialogCancel>
							<Text>Cancel</Text>
						</AlertDialogCancel>
						<AlertDialogAction onPress={confirm}>
							<Text>Confirm</Text>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Screen>
	);
}
