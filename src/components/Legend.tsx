import { STATUS_COLORS } from '../lib/status';

const ITEMS: Array<{ status: keyof typeof STATUS_COLORS; label: string; range: string }> = [
  { status: 'gray', label: 'عادي', range: '0' },
  { status: 'green', label: 'الضو رجع', range: '✓' },
  { status: 'yellow', label: 'مبعثر', range: '1-4' },
  { status: 'orange', label: 'محتمل', range: '5-9' },
  { status: 'red', label: 'مؤكّد', range: '10+' },
];

export function Legend() {
  return (
    <div aria-label="دليل الألوان" role="group" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {ITEMS.map((item) => (
        <div key={item.status} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: STATUS_COLORS[item.status] }}
          />
          <span className="text-slate-200">
            <span className="font-semibold">{item.label}</span>
            <span className="text-slate-400"> ({item.range})</span>
          </span>
        </div>
      ))}
    </div>
  );
}
