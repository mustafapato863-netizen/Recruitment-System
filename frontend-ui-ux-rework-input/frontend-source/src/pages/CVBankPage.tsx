import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApi } from '../api/client';
import type { Candidate, PaginatedResult } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';

interface CVBankCandidate {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  expYears: number;
  location: string;
  skills: string[];
  matchScore: number;
  source: string;
  lastActive: string;
}

const mockTalentPool: CVBankCandidate[] = [
  {
    id: '1',
    name: 'Nour Ali',
    role: 'Registered Nurse',
    avatarColor: 'bg-blue-600',
    expYears: 5,
    location: 'Riyadh',
    skills: ['ICU', 'BLS/ACLS', 'IV Therapy'],
    matchScore: 92,
    source: 'Referral',
    lastActive: 'May 6, 2024',
  },
  {
    id: '2',
    name: 'Heba Salah',
    role: 'Registered Nurse',
    avatarColor: 'bg-emerald-600',
    expYears: 4,
    location: 'Jeddah',
    skills: ['Wound Care', 'BLS'],
    matchScore: 88,
    source: 'LinkedIn',
    lastActive: 'May 5, 2024',
  },
  {
    id: '3',
    name: 'Omar Hassan',
    role: 'Radiology Tech',
    avatarColor: 'bg-amber-600',
    expYears: 6,
    location: 'Riyadh',
    skills: ['MRI', 'CT Scan', 'Radiation Safety'],
    matchScore: 95,
    source: 'Career Site',
    lastActive: 'May 4, 2024',
  },
  {
    id: '4',
    name: 'Ahmed Samir',
    role: 'Pharmacist',
    avatarColor: 'bg-purple-600',
    expYears: 3,
    location: 'Riyadh',
    skills: ['Clinical Pharmacy', 'Dispensing'],
    matchScore: 84,
    source: 'Referral',
    lastActive: 'Apr 30, 2024',
  },
  {
    id: '5',
    name: 'Yousef Meqdy',
    role: 'IT Support Specialist',
    avatarColor: 'bg-indigo-600',
    expYears: 4,
    location: 'Riyadh',
    skills: ['Windows Server', 'Network Admin', 'VOIP'],
    matchScore: 89,
    source: 'Employee Ref',
    lastActive: 'Apr 28, 2024',
  },
  {
    id: '6',
    name: 'Mariam Saleh',
    role: 'Medical Coder',
    avatarColor: 'bg-rose-600',
    expYears: 3,
    location: 'Riyadh',
    skills: ['ICD-10', 'CPT Coding', 'Health Info'],
    matchScore: 78,
    source: 'LinkedIn',
    lastActive: 'Apr 25, 2024',
  },
  {
    id: '7',
    name: 'Lina Mostafa',
    role: 'Registered Nurse',
    avatarColor: 'bg-blue-600',
    expYears: 3,
    location: 'Jeddah',
    skills: ['Pediatrics', 'BLS'],
    matchScore: 76,
    source: 'Career Site',
    lastActive: 'Apr 20, 2024',
  },
];

export function CVBankPage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<CVBankCandidate[]>(mockTalentPool);
  const [search, setSearch] = useState('');
  const [selectedExp, setSelectedExp] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [selectedSkill, setSelectedSkill] = useState('ALL');

  useEffect(() => {
    async function loadCandidates() {
      try {
        const res = await getApi<PaginatedResult<Candidate>>('/candidates?page=1&pageSize=50');
        if (res?.data && res.data.length > 0) {
          const mapped: CVBankCandidate[] = res.data.map((c, idx) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName}`,
            role: 'Medical Specialist',
            avatarColor: idx % 2 === 0 ? 'bg-blue-600' : 'bg-emerald-600',
            expYears: c.experienceYears ?? 3,
            location: c.location || 'Riyadh',
            skills: c.skills || ['Clinical Care', 'BLS'],
            matchScore: 85 + (idx % 10),
            source: 'Career Site',
            lastActive: new Date(c.createdAt).toLocaleDateString(),
          }));
          setCandidates(mapped);
        }
      } catch (err) {
        console.error('Failed to load CV Bank', err);
      }
    }
    void loadCandidates();
  }, []);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.role.toLowerCase().includes(search.toLowerCase());

      const matchExp =
        selectedExp === 'ALL' ||
        (selectedExp === '0-2' && c.expYears <= 2) ||
        (selectedExp === '3-5' && c.expYears >= 3 && c.expYears <= 5) ||
        (selectedExp === '5+' && c.expYears >= 5);

      const matchLoc = selectedLocation === 'ALL' || c.location.toLowerCase().includes(selectedLocation.toLowerCase());
      const matchSkill = selectedSkill === 'ALL' || c.skills.some((s) => s.toLowerCase().includes(selectedSkill.toLowerCase()));

      return matchSearch && matchExp && matchLoc && matchSkill;
    });
  }, [candidates, search, selectedExp, selectedLocation, selectedSkill]);

  const handleClearFilters = () => {
    setSearch('');
    setSelectedExp('ALL');
    setSelectedLocation('ALL');
    setSelectedSkill('ALL');
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-6">
      {/* ── Top Header & Sourcing Search Bar (Screen 12) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            CV Bank / Talent Database <span className="text-xs font-medium text-gray-400 font-normal">(Recruiter)</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Search, filter, and match vetted healthcare profiles across the enterprise candidate repository.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/candidates')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Icon name="plus" size={14} /> Add to CV Bank
          </button>
        </div>
      </div>

      {/* ── Search Toolbar ── */}
      <div className="flex items-center gap-3 bg-white p-3.5 rounded-lg border border-gray-200 shadow-xs flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search CV Bank by name, title, or skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs bg-gray-50/70 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600"
          />
        </div>

        <select className="h-9 px-3 text-xs font-semibold bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-blue-600">
          <option>Smart Searches ▼</option>
          <option>ICU Certified Nurses (5+ yrs)</option>
          <option>Licensed Pharmacists</option>
          <option>Radiology Techs in Riyadh</option>
        </select>
      </div>

      {/* ── Main Layout: Faceted Filter Sidebar (Left) + Candidate Table (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Faceted Filter Sidebar (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Filters</h2>
            <button
              onClick={handleClearFilters}
              className="text-[11px] text-blue-600 font-semibold hover:underline"
            >
              Clear All
            </button>
          </div>

          {/* Experience Filter */}
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Experience</span>
            <div className="space-y-1.5 text-xs">
              {[
                { label: 'All Experience', val: 'ALL' },
                { label: '0 – 2 years', val: '0-2' },
                { label: '3 – 5 years', val: '3-5' },
                { label: '5+ years', val: '5+' },
              ].map((exp) => (
                <label key={exp.val} className="flex items-center gap-2 cursor-pointer text-gray-700">
                  <input
                    type="radio"
                    name="exp"
                    checked={selectedExp === exp.val}
                    onChange={() => setSelectedExp(exp.val)}
                    className="text-blue-600"
                  />
                  <span>{exp.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Skills Filter */}
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Top Skills</span>
            <div className="flex flex-wrap gap-1.5">
              {['ICU', 'BLS/ACLS', 'Radiology', 'Pharmacy', 'Pediatrics', 'EMR', 'IV Therapy'].map((sk) => {
                const isSelected = selectedSkill === sk;
                return (
                  <button
                    key={sk}
                    onClick={() => setSelectedSkill(isSelected ? 'ALL' : sk)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {sk}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location Filter */}
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Location</span>
            <div className="space-y-1.5 text-xs">
              {[
                { label: 'All Locations', val: 'ALL' },
                { label: 'Riyadh, Saudi Arabia', val: 'Riyadh' },
                { label: 'Jeddah, Saudi Arabia', val: 'Jeddah' },
                { label: 'Muscat, Oman', val: 'Muscat' },
              ].map((loc) => (
                <label key={loc.val} className="flex items-center gap-2 cursor-pointer text-gray-700">
                  <input
                    type="radio"
                    name="location"
                    checked={selectedLocation === loc.val}
                    onChange={() => setSelectedLocation(loc.val)}
                    className="text-blue-600"
                  />
                  <span>{loc.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Candidate Data Table (9 cols) */}
        <div className="lg:col-span-9 bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between text-xs font-bold text-gray-700">
            <span>{filteredCandidates.length.toLocaleString()} candidates found</span>
            <span className="text-gray-400 font-normal">Sorted by Match Score ▼</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold">
                <tr>
                  <th className="p-3.5 w-10"><input type="checkbox" className="rounded" /></th>
                  <th className="p-3.5">Name</th>
                  <th className="p-3.5">Applied Role</th>
                  <th className="p-3.5 text-center">Exp</th>
                  <th className="p-3.5">Location</th>
                  <th className="p-3.5">Top Skills</th>
                  <th className="p-3.5 text-center">Match Score</th>
                  <th className="p-3.5">Source</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredCandidates.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/70 transition">
                    <td className="p-3.5">
                      <input type="checkbox" className="rounded" />
                    </td>

                    {/* Candidate Name & Avatar */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-full ${c.avatarColor} text-white font-bold text-[11px] flex items-center justify-center shrink-0`}>
                          {c.name.charAt(0)}
                        </div>
                        <span className="font-bold text-gray-900">{c.name}</span>
                      </div>
                    </td>

                    {/* Applied Role */}
                    <td className="p-3.5 text-gray-700">{c.role}</td>

                    {/* Exp */}
                    <td className="p-3.5 text-center font-bold text-gray-800 tnum">{c.expYears} yrs</td>

                    {/* Location */}
                    <td className="p-3.5 text-gray-600">{c.location}</td>

                    {/* Skills */}
                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1">
                        {c.skills.slice(0, 2).map((sk, i) => (
                          <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                            {sk}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Match Score */}
                    <td className="p-3.5 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100 tnum">
                        {c.matchScore}%
                      </span>
                    </td>

                    {/* Source */}
                    <td className="p-3.5 text-gray-500 text-[11px]">{c.source}</td>

                    {/* Action */}
                    <td className="p-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/candidates/${c.id}`)}
                        className="px-3 py-1 bg-white hover:bg-gray-50 text-blue-600 border border-gray-200 rounded text-xs font-bold transition cursor-pointer"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Showing 1 to {filteredCandidates.length} of {candidates.length}</span>
            <div className="flex items-center gap-1">
              <button className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">&lt;</button>
              <button className="px-2.5 py-1 rounded bg-blue-600 text-white font-bold">1</button>
              <button className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">&gt;</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
