// TODO: Uncomment when Apple Developer account is set up and RevenueCat is configured
// import { Platform } from 'react-native';
// import Purchases, { LOG_LEVEL } from 'react-native-purchases';

// const IOS_API_KEY = 'test_itHnCalGIYhagHyQwvWApUkOZoD';
// const ANDROID_API_KEY = 'test_itHnCalGIYhagHyQwvWApUkOZoD';
// const ENTITLEMENT_ID = 'CodePact';

export function configurePurchases() {
  // TODO: Uncomment when Apple Developer account is set up
  // if (__DEV__) {
  //   Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
  // }
  // const apiKey = Platform.OS === 'ios' ? IOS_API_KEY : ANDROID_API_KEY;
  // Purchases.configure({ apiKey });
}

export async function identifyUser(_userId: string): Promise<void> {
  // TODO: await Purchases.logIn(userId);
}

export async function clearUser(): Promise<void> {
  // TODO: await Purchases.logOut();
}

export async function hasActiveEntitlement(): Promise<boolean> {
  // TODO: Check Purchases.getCustomerInfo()
  return false;
}

export type PurchaseResult =
  | { status: 'success' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export async function purchasePlan(_planKey: 'monthly' | 'weekly'): Promise<PurchaseResult> {
  // TODO: Implement via Purchases SDK when Apple Developer account is set up
  return { status: 'error', message: 'Purchases not yet configured.' };
}

export type RestoreResult =
  | { status: 'restored' }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

export async function restorePurchases(): Promise<RestoreResult> {
  // TODO: Implement via Purchases SDK when Apple Developer account is set up
  return { status: 'not_found' };
}
