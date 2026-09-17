// Full-screen QR scanner for voucher codes (expo-camera, SDK 54 CameraView).
//
// The backend prints one QR per Entitlement Voucher encoding its voucher
// number; scanning is just a faster way to fill the search box. The decoded
// text is normalised by parseVoucherCode() before it leaves this component, so
// callers always get a voucher number — never a `/files/…-qr.png` path.
//
// The camera is only mounted while `visible` is true: one preview can be live
// at a time, and leaving it mounted behind a closed modal keeps the sensor hot.

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { parseVoucherCode } from '@/lib/voucher-code';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera, CameraOff, ScanLine, X, Zap, ZapOff } from 'lucide-react-native';
import * as React from 'react';
import { Linking, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function QrScanner({
	visible,
	onClose,
	onScan,
}: {
	visible: boolean;
	onClose: () => void;
	// Called with the parsed voucher number; the scanner closes itself first.
	onScan: (voucherNo: string) => void;
}) {
	const [permission, requestPermission] = useCameraPermissions();
	const [torch, setTorch] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	// The camera keeps firing frames after a hit — latch so one scan = one result.
	const handled = React.useRef(false);
	// One automatic prompt per open: on Android a plain "deny" leaves
	// canAskAgain true, so re-asking on every permission change would loop the
	// system dialog. After that it's the "Allow camera" button's job.
	const asked = React.useRef(false);

	React.useEffect(() => {
		if (!visible) {
			asked.current = false;
			return;
		}
		handled.current = false;
		setError(null);
		setTorch(false);
	}, [visible]);

	React.useEffect(() => {
		// `permission` is null until the initial status read resolves.
		if (!visible || asked.current || !permission) return;
		if (!permission.granted && permission.canAskAgain) {
			asked.current = true;
			void requestPermission();
		}
	}, [visible, permission, requestPermission]);

	const handleBarcode = ({ data }: { data: string }) => {
		if (handled.current) return;
		const code = parseVoucherCode(data);
		if (!code) {
			// Keep scanning — a QR that carries nothing usable isn't a voucher.
			setError("That code doesn't contain a voucher number.");
			return;
		}
		handled.current = true;
		setTorch(false);
		onClose();
		onScan(code);
	};

	const granted = permission?.granted === true;
	const blocked = permission !== null && !permission.granted && !permission.canAskAgain;

	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="fullScreen"
			onRequestClose={onClose}
			statusBarTranslucent
		>
			<View className="flex-1 bg-black">
				{visible && granted && (
					<CameraView
						style={{ flex: 1 }}
						facing="back"
						enableTorch={torch}
						barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
						onBarcodeScanned={handleBarcode}
						onMountError={() => setError('The camera could not be started.')}
					/>
				)}

				{/* Reticle + chrome sit above the preview */}
				<SafeAreaView edges={['top', 'bottom']} className="absolute inset-0">
					<View className="flex-row items-center justify-between p-4">
						<Text className="font-display text-lg text-white">Scan voucher QR</Text>
						<View className="flex-row gap-2">
							{granted && (
								<Pressable
									onPress={() => setTorch((t) => !t)}
									accessibilityLabel={torch ? 'Turn torch off' : 'Turn torch on'}
									className="h-10 w-10 items-center justify-center rounded-full bg-white/15"
								>
									<Icon as={torch ? Zap : ZapOff} size={20} className="text-white" />
								</Pressable>
							)}
							<Pressable
								onPress={onClose}
								accessibilityLabel="Close scanner"
								className="h-10 w-10 items-center justify-center rounded-full bg-white/15"
							>
								<Icon as={X} size={20} className="text-white" />
							</Pressable>
						</View>
					</View>

					<View className="flex-1 items-center justify-center px-8">
						{granted ? (
							<>
								<View className="border-primary aspect-square w-64 rounded-3xl border-2" />
								<View className="mt-6 flex-row items-center gap-2">
									<Icon as={ScanLine} size={16} className="text-white/70" />
									<Text className="text-sm text-white/70">
										Point the camera at the voucher's QR code
									</Text>
								</View>
							</>
						) : (
							<View className="items-center gap-4">
								<Icon as={blocked ? CameraOff : Camera} size={40} className="text-white/70" />
								<Text className="text-center text-white/80">
									{blocked
										? 'Camera access is blocked. Enable it for AIGT-HDR in system settings, then try again.'
										: 'AIGT-HDR needs camera access to scan voucher QR codes.'}
								</Text>
								<Button
									variant="secondary"
									onPress={() => (blocked ? void Linking.openSettings() : void requestPermission())}
								>
									<Text>{blocked ? 'Open settings' : 'Allow camera'}</Text>
								</Button>
							</View>
						)}
					</View>

					{error && (
						<View className="mx-4 mb-4 rounded-xl bg-black/70 p-3">
							<Text className="text-center text-sm text-white">{error}</Text>
						</View>
					)}
				</SafeAreaView>
			</View>
		</Modal>
	);
}
