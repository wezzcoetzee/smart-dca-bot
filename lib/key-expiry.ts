export const EXPIRY_DAYS = 180;
export const WARNING_THRESHOLD_DAYS = 7;

export const getDaysUntilExpiry = (keyCreatedDate: Date): number => {
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysSince = Math.floor((Date.now() - keyCreatedDate.getTime()) / msPerDay);
  return EXPIRY_DAYS - daysSince;
};

export const shouldWarnExpiry = (keyCreatedDate: Date): boolean =>
  getDaysUntilExpiry(keyCreatedDate) <= WARNING_THRESHOLD_DAYS;
