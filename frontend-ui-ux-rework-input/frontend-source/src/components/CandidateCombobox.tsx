import { useState, useEffect, useRef } from 'react';
import { getApi } from '../api/client';
import { Input } from './ui/Input';
import { Icon } from './Icon';
import type { Candidate, PaginatedResult } from '@recruitflow/contracts';

interface CandidateComboboxProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

export function CandidateCombobox({ value, onChange, id }: CandidateComboboxProps) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Track selected candidate to display their name
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  useEffect(() => {
    // If we have a value but no selectedCandidate, we might want to fetch it, 
    // but for simplicity we assume the user just selects from the dropdown.
    if (!value) {
      setSelectedCandidate(null);
      setQuery('');
    }
  }, [value]);

  useEffect(() => {
    const fetchCandidates = async () => {
      setLoading(true);
      try {
        const url = query 
          ? `/candidates?search=${encodeURIComponent(query)}&page=1&pageSize=10`
          : `/candidates?page=1&pageSize=10`;
        const res = await getApi<PaginatedResult<Candidate>>(url);
        setCandidates(res.data);
      } catch (err) {
        console.error('Failed to fetch candidates', err);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchCandidates, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <Input
          id={id}
          type="text"
          placeholder="Search for a candidate..."
          value={isOpen ? query : (selectedCandidate ? `${selectedCandidate.firstName} ${selectedCandidate.lastName}` : query)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-rf-ink-muted">
          {loading ? <Icon name="refresh-cw" size={16} className="animate-spin" /> : <Icon name="search" size={16} />}
        </div>
      </div>
      
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-rf-border-subtle rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {candidates.length === 0 && !loading ? (
            <div className="p-3 text-sm text-rf-ink-muted text-center">No candidates found.</div>
          ) : (
            <ul className="py-1">
              {candidates.map((candidate) => (
                <li
                  key={candidate.id}
                  className="px-3 py-2 text-sm text-rf-ink hover:bg-rf-surface-subtle cursor-pointer flex flex-col"
                  onClick={() => {
                    setSelectedCandidate(candidate);
                    onChange(candidate.id);
                    setIsOpen(false);
                    setQuery('');
                  }}
                >
                  <span className="font-bold">{candidate.firstName} {candidate.lastName}</span>
                  <span className="text-xs text-rf-ink-muted">{candidate.email}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
