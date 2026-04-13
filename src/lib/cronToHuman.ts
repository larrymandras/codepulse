export type FrequencyPreset = "every_minute" | "every_hour" | "every_day" | "every_week" | "custom";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const FREQUENCY_TO_CRON: Record<FrequencyPreset, (h: number, m: number, dow: number) => string> = {
  every_minute: () => "* * * * *",
  every_hour: (_h, m) => `${m} * * * *`,
  every_day: (h, m) => `${m} ${h} * * *`,
  every_week: (h, m, dow) => `${m} ${h} * * ${dow}`,
  custom: () => "",
};

export function cronToHuman(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return "Invalid expression";
  const [min, hour, _dom, _mon, dow] = parts;
  if (min === "*" && hour === "*") return "Every minute";
  if (hour === "*") return `Every hour at minute ${min}`;
  if (dow !== "*") {
    const dayName = DAYS[parseInt(dow)] ?? `day ${dow}`;
    return `Every ${dayName} at ${hour}:${min.padStart(2, "0")}`;
  }
  return `Every day at ${hour}:${min.padStart(2, "0")}`;
}

export const CRON_REGEX = /^(\*|[0-9]{1,2})(\/[0-9]+)?( (\*|[0-9]{1,2})(\/[0-9]+)?){4}$/;

export function isValidCron(expr: string): boolean {
  return CRON_REGEX.test(expr.trim());
}
