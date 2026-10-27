export interface OnboardingRepository {
  complete(): Promise<void>;
}
