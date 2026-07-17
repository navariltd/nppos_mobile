import { EntitlementCard } from '@/components/domain/EntitlementCard';
import { Screen } from '@/components/domain/Screen';
import { EmptyState } from '@/components/domain/widgets';
import { Alert as AlertBanner, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
	issueGoodsEntitlement,
	useBeneficiary,
	useEntitlement,
	useProject,
	useVoucher,
} from '@/repositories';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
	Check,
	CircleAlert,
	ClipboardList,
	FolderOpen,
	IdCard,
	Info,
	Ticket,
	UserRound,
	type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Alert, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

function InfoRow({ icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
	return (
		<View className="flex-row items-center gap-3">
			<Icon as={icon} size={17} className="text-muted-foreground" />
			<Text className="text-muted-foreground flex-1 text-sm">{label}</Text>
			<Text className="text-sm font-medium">{value}</Text>
		</View>
	);
}

export default function ConfirmIssue() {
	const { entitlementId } = useLocalSearchParams<{ entitlementId: string }>();
	const router = useRouter();
	const [done, setDone] = React.useState(false);

	const ent = useEntitlement(entitlementId);
	const beneficiary = useBeneficiary(ent?.beneficiaryId);
	const voucher = useVoucher(ent?.voucherId);
	const project = useProject(ent?.projectId);

	const recipient = beneficiary?.name ?? voucher?.voucherNo ?? '—';

	if (done) {
		return (
			<Screen>
				<View className="flex-1 items-center justify-center gap-5 py-16">
					<Animated.View
						entering={ZoomIn.springify().damping(12)}
						className="bg-success/10 h-24 w-24 items-center justify-center rounded-full"
					>
						<Icon as={Check} size={52} className="text-success" />
					</Animated.View>
					<Animated.View entering={FadeInDown.duration(350).delay(150)} className="items-center gap-2">
						<Text variant="h3">Hamper issued</Text>
						<Text className="text-muted-foreground px-4 text-center">
							Goods-issue recorded for {recipient}. Queued as a Stock Entry for background sync.
						</Text>
					</Animated.View>
					<Animated.View entering={FadeInDown.duration(350).delay(300)} className="w-full">
						<Button size="lg" className="mt-2 w-full" onPress={() => router.dismissAll()}>
							<Text>Back to dashboard</Text>
						</Button>
					</Animated.View>
				</View>
			</Screen>
		);
	}

	if (!ent) {
		return (
			<Screen>
				<EmptyState icon={CircleAlert} title="Entitlement not found" subtitle={entitlementId} />
			</Screen>
		);
	}

	const confirm = () => {
		const result = issueGoodsEntitlement(ent.id);
		if (result.ok) {
			setDone(true);
		} else {
			Alert.alert('Could not issue', result.reason);
		}
	};

	return (
		<Screen>
			<Animated.View entering={FadeInDown.duration(300)}>
				<Card>
					<CardContent className="gap-3.5 pt-5">
						<InfoRow icon={UserRound} label="Recipient" value={recipient} />
						{beneficiary && (
							<InfoRow icon={IdCard} label="Beneficiary no" value={beneficiary.beneficiaryNo} />
						)}
						{voucher && <InfoRow icon={Ticket} label="Voucher" value={voucher.voucherNo} />}
						<InfoRow icon={FolderOpen} label="Project" value={project?.code ?? '—'} />
						<InfoRow icon={ClipboardList} label="DO" value={ent.disbursementOrderId} />
					</CardContent>
				</Card>
			</Animated.View>

			<Animated.View entering={FadeInDown.duration(300).delay(70)}>
				<EntitlementCard entitlement={ent} householdSize={beneficiary?.householdSize} />
			</Animated.View>

			<Animated.View entering={FadeInDown.duration(300).delay(140)} className="gap-4">
				<AlertBanner icon={Info} className="border-info/30 bg-info/10">
					<AlertTitle className="text-info">Offline-safe</AlertTitle>
					<AlertDescription className="text-info">
						Confirming deducts from your warehouse and records the issue offline.
					</AlertDescription>
				</AlertBanner>

				<Button size="lg" onPress={confirm}>
					<Icon as={Check} size={20} className="text-primary-foreground" />
					<Text>Confirm issue</Text>
				</Button>
				<Button variant="ghost" onPress={() => router.back()}>
					<Text>Cancel</Text>
				</Button>
			</Animated.View>
		</Screen>
	);
}
