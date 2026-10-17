import { useSyncExternalStore } from 'react';
import { auth } from '../api/client';
import type { AuthController } from './controller';
export { AuthController } from './controller';
export type { AuthUser, AuthState } from './controller';

/** A state hook only; rendering and routing remain in the app/UI layers. */
export function useAuth(controller: AuthController = auth) {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
