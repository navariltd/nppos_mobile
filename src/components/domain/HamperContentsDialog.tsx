// "What's actually in this hamper?" — the component list behind a goods
// entitlement, shown wherever a hamper is named (voucher redemption, stock).
//
// Contents come from the BOM the voucher names (Entitlement Voucher.bom), so an
// agent sees exactly what they must hand over — not the item's default recipe.
// Vouchers pulled before the backend gained that field fall back to the item's
// default-BOM expansion; the footer says which one is on screen.

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useHamperContents } from '@/repositories';
import { PackageOpen } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

// Trailing zeros look wrong on a packing list ("10 kg", not "10.0 kg").
function qtyText(n: number): string {
	return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}

export function HamperContentsDialog({
	open,
	onOpenChange,
	title,
	bomId,
	hamperId,
	/** Hampers being issued — shows a per-line total alongside the per-hamper qty. */
	multiplier = 1,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	bomId?: string | null;
	hamperId?: string | null;
	multiplier?: number;
}) {
	const contents = useHamperContents(bomId, hamperId);
	const showTotals = multiplier > 1;

	// The list gets a slice of the actual viewport rather than a fixed 320: a
	// hamper with many components needs the room on a big phone, and on a small
	// one a fixed height pushes the dialog's own footer off-screen — which reads
	// as "it doesn't scroll" even though the list itself does.
	const { height: windowHeight } = useWindowDimensions();
	const listMaxHeight = Math.max(180, Math.round(windowHeight * 0.45));

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[92%]">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						{contents
							? `${contents.lines.length} item${contents.lines.length === 1 ? '' : 's'} in one hamper${
									showTotals ? ` — totals shown for ${multiplier}.` : '.'
								}`
							: 'No component list has been synced for this hamper yet.'}
					</DialogDescription>
				</DialogHeader>

				{contents ? (
					<>
						{/* nestedScrollEnabled: the dialog overlay renders as a Pressable
						    (see ui/dialog.tsx), and on Android a scrollable inside a
						    touch-handling parent needs this to claim the drag. The
						    indicator stays VISIBLE here — a clipped list with no
						    indicator is indistinguishable from a truncated one. */}
						<ScrollView
							style={{ maxHeight: listMaxHeight, flexShrink: 1 }}
							nestedScrollEnabled
							showsVerticalScrollIndicator
							persistentScrollbar
							contentContainerClassName="gap-2.5"
						>
							{contents.lines.map((line, i) => (
								<View key={`${line.itemName}-${i}`} className="flex-row items-center gap-3">
									<View className="bg-primary/10 h-8 w-8 items-center justify-center rounded-lg">
										<Icon as={PackageOpen} size={15} className="text-primary" />
									</View>
									<Text className="flex-1 text-sm" numberOfLines={2}>
										{line.itemName}
									</Text>
									<View className="items-end">
										<Text className="font-display-medium text-sm">
											{qtyText(line.qty)} {line.unit}
										</Text>
										{showTotals && (
											<Text className="text-muted-foreground text-[11px]">
												{qtyText(line.qty * multiplier)} {line.unit} total
											</Text>
										)}
									</View>
								</View>
							))}
						</ScrollView>
						<Separator />
						<Text className="text-muted-foreground text-[11px]">
							{contents.source === 'bom'
								? `From BOM ${contents.bomId}`
								: "From the item's default recipe — this voucher names no BOM."}
						</Text>
					</>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
