export const PIN_CODES: Record<string, string> = {
  "1331": "bart",
  "2476": "zach",
  "5378": "greeno",
  "0245": "pgd",
  "1271": "dave",
};

export function getPlayerNameFromPin(pin: string): string | null {
  return PIN_CODES[pin] || null;
}

export function isValidPin(pin: string): boolean {
  return pin in PIN_CODES;
}
