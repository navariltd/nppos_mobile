// Session state via React Context (no Redux for now — dummy auth only).
// Holds who is "logged in" and their role, used to gate the (app) group and the
// admin/ stack. When the real auth lands this becomes the auth slice/secure-store
// flow described in docs/ARCHITECTURE.md §7.

import { currentAgent } from '@/data/mock';
import type { Role } from '@/types/domain';
import * as React from 'react';

interface SessionValue {
	isAuthenticated: boolean;
	name: string;
	role: Role;
	signIn: (role?: Role) => void;
	signOut: () => void;
	setRole: (role: Role) => void;
}

const SessionContext = React.createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
	const [isAuthenticated, setIsAuthenticated] = React.useState(false);
	const [role, setRole] = React.useState<Role>('agent');

	const value = React.useMemo<SessionValue>(
		() => ({
			isAuthenticated,
			name: currentAgent.name,
			role,
			signIn: (r: Role = 'agent') => {
				setRole(r);
				setIsAuthenticated(true);
			},
			signOut: () => setIsAuthenticated(false),
			setRole,
		}),
		[isAuthenticated, role]
	);

	return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
	const ctx = React.useContext(SessionContext);
	if (!ctx) throw new Error('useSession must be used within a SessionProvider');
	return ctx;
}
