'use client';

import React, { useRef, useEffect } from 'react';
import { Table as ReactTable } from '@tanstack/react-table';
import { TodoNFTDisplay } from '../../types/nft-display';

interface HeaderCheckboxProps {
  table: ReactTable<TodoNFTDisplay>;
}

const HeaderCheckbox: React.FC<HeaderCheckboxProps> = ({ table }) => {
  const checkboxRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (checkboxRef.current) {
      const isSomeRowsSelected = table.getIsSomeRowsSelected();
      const isAllRowsSelected = table.getIsAllRowsSelected();
      checkboxRef.current.indeterminate = isSomeRowsSelected && !isAllRowsSelected;
    }
  }, [table]);

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      checked={table.getIsAllRowsSelected()}
      onChange={table.getToggleAllRowsSelectedHandler()}
      className="cursor-pointer"
    />
  );
};

interface TodoNFTTableHeaderProps {
  table: ReactTable<TodoNFTDisplay>;
}

export const TodoNFTTableHeader: React.FC<TodoNFTTableHeaderProps> = ({ table }) => {
  return (
    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700 z-10">
      {table.getHeaderGroups().map(headerGroup => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map(header => (
            <th
              key={header.id}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
              style={{ width: header.getSize() }}
            >
              {header.isPlaceholder ? null : (
                <div
                  className={`flex items-center gap-2 ${
                    header.column.getCanSort() ? 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200' : ''
                  }`}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {/* Special handling for selection column */}
                  {header.id === 'select' ? (
                    <HeaderCheckbox table={table} />
                  ) : (
                    <>
                      {typeof header.column.columnDef.header === 'function' 
                        ? header.column.columnDef.header(header.getContext())
                        : header.column.columnDef.header
                      }
                      {header.column.getCanSort() && (
                        <span className="text-gray-400 transition-colors">
                          {{
                            asc: '↑',
                            desc: '↓',
                          }[header.column.getIsSorted() as string] ?? '↕'}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
            </th>
          ))}
        </tr>
      ))}
    </thead>
  );
};

export { HeaderCheckbox };