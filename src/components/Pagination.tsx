import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      marginTop: '16px',
    }}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={isFirstPage}
        aria-label="上一页"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          background: isFirstPage ? '#f3f4f6' : '#ffffff',
          color: isFirstPage ? '#9ca3af' : '#374151',
          cursor: isFirstPage ? 'not-allowed' : 'pointer',
          opacity: isFirstPage ? 0.6 : 1,
        }}
      >
        <ChevronLeft size={16} />
      </button>

      <span style={{
        fontSize: '0.85rem',
        color: '#374151',
        fontWeight: 500,
        padding: '0 8px',
      }}>
        {currentPage} / {totalPages}
      </span>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={isLastPage}
        aria-label="下一页"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          background: isLastPage ? '#f3f4f6' : '#ffffff',
          color: isLastPage ? '#9ca3af' : '#374151',
          cursor: isLastPage ? 'not-allowed' : 'pointer',
          opacity: isLastPage ? 0.6 : 1,
        }}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
