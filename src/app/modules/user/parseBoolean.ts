export const parseBoolean = (value?: string) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};