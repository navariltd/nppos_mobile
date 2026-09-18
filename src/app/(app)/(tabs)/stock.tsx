import { HamperContentsDialog } from '@/components/domain/HamperContentsDialog';
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
import {
	returnStock,
	staleSyncMessage,
	useAgentStock,
	useSettings,
	useSyncFreshness,
} from '@/repositories';
import type { AgentStockRow } from '@/types/domain';
import { ChevronRight, PackageOpen, Undo2 } from 'lucide-react-native';
import * as React from 'react';
import { Alert, Pressable, View } from 'react-native';

// Returns to the central warehouse are the only stock adjustment in the POS —
// damaged/lost goods run through AIGT's procurement process instead.
type Adjust = { row: AgentStockRow };

export default function Stock() {
	const profile = useActivePosProfile();
	const agentStock = useAgentStock(profile?.warehouse);
	const settings = useSettings();
	const freshness = useSyncFreshness();
	// Setting 5: without it, a stock line names its hamper but offers no way
	// into the component list.
	const canPeek = settings.showHamperContents;
	const [adjust, setAdjust] = React.useState<Adjust | null>(null);
	const [qty, setQty] = React.useState('1');
	const [contentsOf, setContentsOf] = React.useState<AgentStockRow | null>(null);

	const totalOnHand = agentStock.reduce((s, r) => s + r.onHand, 0);
	const totalIssued = agentStock.reduce((s, r) => s + r.issuedToday, 0);

	const open = (row: AgentStockRow) => {
		setQty('1');
		setAdjust({ row });
	};

	const confirm = () => {
		if (!adjust) return;
		const n = Number(qty) || 0;
		const result = returnStock(adjust.row.warehouse, adjust.row.hamperId, n);
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
				{/* The returns below are disabled while stale — say why, or the
				    greyed-out button reads as a bug. */}
				{freshness.isStale && (
					<Text className="text-warning mt-2 text-xs">{staleSyncMessage(freshness)}</Text>
				)}
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
					</CardContent>
				</Card>
			</FadeInView>

			{agentStock.map((row, i) => (
				<FadeInView key={row.hamperId} delay={80 + i * 70}>
					<Card>
						{/* Tapping a stock line shows what one unit contains (its default
						    BOM) — the same list the agent sees when redeeming. Inert when
						    hamper contents are switched off. */}
						<Pressable
							onPress={canPeek ? () => setContentsOf(row) : undefined}
							disabled={!canPeek}
							accessibilityRole={canPeek ? 'button' : undefined}
							accessibilityLabel={
								canPeek ? `Show contents of ${row.hamperName}` : undefined
							}
							className={canPeek ? 'active:bg-accent/40 rounded-t-xl' : undefined}
						>
							<CardHeader>
								<View className="flex-row items-center justify-between gap-2">
									<CardTitle className="flex-1" numberOfLines={2}>
										{row.hamperName}
									</CardTitle>
									<Badge variant="secondary">
										<Text>{row.hamperId}</Text>
									</Badge>
								</View>
								{canPeek && (
									<View className="mt-1 flex-row items-center gap-1.5">
										<Icon as={PackageOpen} size={13} className="text-primary" />
										<Text className="text-primary flex-1 text-xs">What's in this hamper</Text>
										<Icon as={ChevronRight} size={14} className="text-muted-foreground" />
									</View>
								)}
							</CardHeader>
						</Pressable>
						<CardContent className="gap-3">
							<View className="flex-row">
								<Stat label="On hand" value={String(row.onHand)} />
								<Stat label="Issued" value={String(row.issuedToday)} />
							</View>
							<Separator />
							<Button
								variant="outline"
								size="sm"
								disabled={freshness.isStale}
								onPress={() => open(row)}
							>
								<Icon as={Undo2} size={16} className="text-foreground" />
								<Text>Return to central warehouse</Text>
							</Button>
						</CardContent>
					</Card>
				</FadeInView>
			))}

			{canPeek && (
				<HamperContentsDialog
					open={contentsOf !== null}
					onOpenChange={(o) => !o && setContentsOf(null)}
					title={contentsOf?.hamperName ?? ''}
					bomId={contentsOf?.bomId}
					hamperId={contentsOf?.hamperId}
				/>
			)}

			<AlertDialog open={adjust !== null} onOpenChange={(o) => !o && setAdjust(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Return stock</AlertDialogTitle>
						<AlertDialogDescription>
							{`Return units of ${adjust?.row.hamperName ?? 'this item'} to the central warehouse. Recorded offline and queued for sync.`}
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
			<Text className="text-muted-foreground text-center text-xs">
					Stocks are coupled to vouchers
			</Text>
		</Screen>
	);
}
