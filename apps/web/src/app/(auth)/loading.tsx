import { AuthLoading } from "@/features/auth/components/AuthLoading";

/**
 * Every auth and onboarding screen.
 *
 * Reuses the existing AuthLoading rather than a skeleton: these screens are a
 * single narrow column, and a skeleton of one field looks more like a fault than
 * a spinner does. The component already matches the auth layout's centring.
 */
export default function AuthGroupLoading() {
  return <AuthLoading />;
}
