import { useState } from 'react';
import { validateEdaFilters } from '../../../ml/edaFilters.js';

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains text' },
  { value: 'gte', label: 'At least' },
  { value: 'lte', label: 'At most' },
  { value: 'between', label: 'Between' },
  { value: 'missing', label: 'Is missing' },
  { value: 'present', label: 'Is present' },
];

export default function EdaFilterToolbar({ headers, filters, onChange, sourceCount, visibleCount }) {
  const [column, setColumn] = useState(headers[0] ?? '');
  const [operator, setOperator] = useState('equals');
  const [value, setValue] = useState('');
  const [valueTo, setValueTo] = useState('');
  const [error, setError] = useState('');
  const valueNeeded = !['missing', 'present'].includes(operator);
  const addFilter = event => {
    event.preventDefault();
    try {
      const candidate = { id: 'f-' + Date.now() + '-' + filters.length, column, operator, value, valueTo };
      const next = validateEdaFilters([...filters, candidate], headers);
      onChange(next);
      setError('');
      setValue('');
      setValueTo('');
    } catch (reason) { setError(reason.message); }
  };
  const describe = filter =>
    filter.column + ' ' + OPERATORS.find(item => item.value === filter.operator)?.label.toLowerCase() +
    (['missing', 'present'].includes(filter.operator) ? '' : ' ' + filter.value +
      (filter.operator === 'between' ? ' to ' + filter.valueTo : ''));
  return <section aria-label="EDA filters" className="rounded-xl border border-white/10 bg-obsidian p-3 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h5 className="font-semibold text-sm">Investigation filters</h5>
      <span role="status" className="text-xs text-text-muted">{visibleCount} of {sourceCount} source rows included</span>
    </div>
    <form onSubmit={addFilter} className="grid gap-2 sm:grid-cols-[minmax(110px,1fr)_minmax(120px,1fr)_minmax(100px,1fr)_auto_auto]">
      <label className="text-xs text-text-muted">Column
        <select aria-label="Filter column" className="mt-1 block w-full min-h-10 rounded-lg border border-white/20 bg-surface-dark px-2 text-text-primary" value={column}
          onChange={event=>setColumn(event.target.value)}>
          {headers.map(name=><option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <label className="text-xs text-text-muted">Condition
        <select aria-label="Filter condition" className="mt-1 block w-full min-h-10 rounded-lg border border-white/20 bg-surface-dark px-2 text-text-primary" value={operator}
          onChange={event=>setOperator(event.target.value)}>
          {OPERATORS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      {valueNeeded && <label className="text-xs text-text-muted">Value
        <input aria-label="Filter value" className="mt-1 block w-full min-h-10 rounded-lg border border-white/20 bg-surface-dark px-2 text-text-primary"
          value={value} onChange={event=>setValue(event.target.value)} placeholder="Enter value" />
      </label>}
      {operator==='between' && <label className="text-xs text-text-muted">Upper
        <input aria-label="Filter upper bound" className="mt-1 block w-full min-h-10 rounded-lg border border-white/20 bg-surface-dark px-2 text-text-primary"
          value={valueTo} onChange={event=>setValueTo(event.target.value)} placeholder="Upper bound" />
      </label>}
      <button type="submit" className="self-end min-h-10 rounded-lg border border-plasma-cyan/40 bg-plasma-cyan/10 px-3 text-sm font-semibold text-plasma-cyan">Add filter</button>
    </form>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {filters.length>0 && <div className="flex flex-wrap gap-2" aria-label="Active EDA filters">
      {filters.map(filter=><button type="button" key={filter.id} title="Remove filter" aria-label={'Remove filter: '+describe(filter)}
        onClick={()=>onChange(filters.filter(item=>item.id!==filter.id))}
        className="min-h-9 rounded-full border border-plasma-cyan/30 bg-plasma-cyan/10 px-3 text-xs text-text-primary">
        {describe(filter)} <span aria-hidden="true">×</span>
      </button>)}
      <button type="button" onClick={()=>{onChange([]);setError('');}} className="min-h-9 rounded-lg px-3 text-xs underline text-text-muted">Clear all</button>
    </div>}
    <p className="text-xs text-text-muted">Filters affect exploratory calculations across views; the original imported rows remain unchanged. Values within this toolbar are combined using AND.</p>
  </section>;
}
