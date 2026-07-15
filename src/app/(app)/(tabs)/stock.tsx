import { Screen } from '@/components/domain/Screen';
import { FadeInView, Stat } from '@/components/domain/widgets';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { agentStock, currentAgent } from '@/data/mock';
import { TriangleAlert, Undo2 } from 'lucide-react-native';
import { View } from 'react-native';

export default function Stock() {
	const totalOnHand = agentStock.reduce((s, r) => s + r.onHand, 0);
	const totalIssued = agentStock.reduce((s, r) => s + r.issuedToday, 0);
	const totalDamaged = agentStock.reduce((s, r) => s + r.damaged, 0);

	return (
		<Screen edges={['top']}>
			<View>
				<Text variant="h3">Stock</Text>
				<Text className="text-muted-foreground mt-0.5 text-sm">
					{currentAgent.code} · agent warehouse
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
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button variant="outline" size="sm" className="flex-1">
											<Icon as={Undo2} size={16} className="text-foreground" />
											<Text>Return</Text>
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>Return stock</AlertDialogTitle>
											<AlertDialogDescription>
												Returns {row.hamperName} to the central warehouse. Not wired up yet —
												dummy data build.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogAction>
												<Text>OK</Text>
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>

								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button variant="outline" size="sm" className="flex-1">
											<Icon as={TriangleAlert} size={16} className="text-warning" />
											<Text>Damaged</Text>
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>Report damaged / expired</AlertDialogTitle>
											<AlertDialogDescription>
												Flags units of {row.hamperName} as unusable. Not wired up yet — dummy
												data build.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogAction>
												<Text>OK</Text>
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</View>
						</CardContent>
					</Card>
				</FadeInView>
			))}
		</Screen>
	);
}
