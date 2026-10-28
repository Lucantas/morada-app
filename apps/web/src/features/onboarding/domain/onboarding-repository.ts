export interface OnboardingRepository {
  complete(): Promise<void>;
  isPending(condoId: string): Promise<boolean>;
}
