import React from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

/**
 * Reusable sortable table header component.
 * Renders a <th> with up/down chevrons that toggle ascending/descending sort.
 *
 * Props:
 *   field     - the API ordering field name (e.g. 'name', 'supplier__company_name')
 *   label     - display text for the header
 *   sortBy    - current sort state string (e.g. 'name' or '-name')
 *   setSortBy - setter function to update sort state
 *   align     - 'left' (default) or 'right'
 *   style     - optional inline style object (e.g. { maxWidth: '150px' })
 *   className - optional additional class names for the <th>
 */
const SortableHeader = ({ field, label, sortBy, setSortBy, align = 'left', style, className = '' }) => {
  const isAsc = sortBy === field;
  const isDesc = sortBy === `-${field}`;

  const handleClick = () => {
    if (isAsc) {
      setSortBy(`-${field}`);
    } else {
      setSortBy(field);
    }
  };

  const textAlign = align === 'right' ? 'text-right' : 'text-left';

  return (
    <th
      className={`${className || 'px-6 py-3'} ${textAlign} text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100`}
      style={style}
      onClick={handleClick}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        <span>{label}</span>
        <div className="flex flex-col -space-y-1">
          <ChevronUpIcon className={`h-3 w-3 ${isAsc ? 'text-green-600' : 'text-gray-300'}`} />
          <ChevronDownIcon className={`h-3 w-3 ${isDesc ? 'text-green-600' : 'text-gray-300'}`} />
        </div>
      </div>
    </th>
  );
};

export default SortableHeader;
