export function DisabledDate({ date }: { date?: string | null }) {
  return <span className="block text-xs text-rose-800 dark:text-rose-200">{date
    ? `Disabled on ${new Intl.DateTimeFormat('en-US', {dateStyle:'medium',timeZone:'America/New_York'}).format(new Date(date))}`
    : 'Disabled date not recorded (before date tracking)'}</span>;
}
