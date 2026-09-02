import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';

interface CareerJob {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  easyApply: boolean;
  posted: string;
}

const mockJobs: CareerJob[] = [
  {
    id: '1',
    title: 'Registered Nurse',
    department: 'Nursing',
    location: 'Riyadh, Saudi Arabia',
    type: 'Full-time',
    easyApply: true,
    posted: 'May 12, 2024',
  },
  {
    id: '2',
    title: 'Radiology Technician',
    department: 'Radiology',
    location: 'Jeddah, Saudi Arabia',
    type: 'Full-time',
    easyApply: true,
    posted: 'May 10, 2024',
  },
  {
    id: '3',
    title: 'Pharmacist',
    department: 'Pharmacy',
    location: 'Riyadh, Saudi Arabia',
    type: 'Full-time',
    easyApply: true,
    posted: 'May 8, 2024',
  },
  {
    id: '4',
    title: 'IT Support Specialist',
    department: 'IT Department',
    location: 'Riyadh, Saudi Arabia',
    type: 'Full-time',
    easyApply: true,
    posted: 'May 5, 2024',
  },
  {
    id: '5',
    title: 'Medical Coder',
    department: 'Health Information',
    location: 'Riyadh, Saudi Arabia',
    type: 'Full-time',
    easyApply: true,
    posted: 'May 2, 2024',
  },
  {
    id: '6',
    title: 'HR Specialist',
    department: 'Human Resources',
    location: 'Riyadh, Saudi Arabia',
    type: 'Full-time',
    easyApply: true,
    posted: 'Apr 28, 2024',
  },
];

export function PublicJobsPage() {
  const navigate = useNavigate();
  const [searchTitle, setSearchTitle] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});

  const toggleBookmark = (id: string) => {
    setBookmarked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredJobs = mockJobs.filter((j) => {
    const matchTitle = !searchTitle || j.title.toLowerCase().includes(searchTitle.toLowerCase());
    const matchLoc = !searchLocation || j.location.toLowerCase().includes(searchLocation.toLowerCase());
    const matchDept = selectedDept === 'ALL' || j.department.toLowerCase().includes(selectedDept.toLowerCase());
    return matchTitle && matchLoc && matchDept;
  });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col justify-between">
      {/* ── Top Header Navigation (Screen 1) ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm">
              R
            </div>
            <span className="font-extrabold text-gray-900 text-base tracking-tight">RecruitFlow</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-gray-600">
            <a href="#jobs" className="text-blue-600">Jobs</a>
            <a href="#about" className="hover:text-gray-900">About Us</a>
            <a href="#why" className="hover:text-gray-900">Why RecruitFlow</a>
            <a href="#contact" className="hover:text-gray-900">Contact</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/auth/login')}
              className="px-4 py-2 text-xs font-bold text-gray-700 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Banner (Screen 1) ── */}
      <div className="bg-white border-b border-gray-200 py-12 px-4 sm:px-8 text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Join Our Team
          </h1>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">
            Find your next opportunity and build your future with us. Discover clinical, operational, and technology roles.
          </p>

          {/* Search Inputs Bar */}
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 max-w-2xl mx-auto bg-white p-2 rounded-xl border border-gray-200 shadow-xs">
            <div className="relative flex-1 w-full">
              <Icon name="search" size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Job title or keyword"
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
                className="w-full h-10 pl-9 pr-3 text-xs bg-transparent text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </div>

            <div className="relative flex-1 w-full border-t sm:border-t-0 sm:border-l border-gray-200 sm:pl-3">
              <Icon name="map-pin" size={14} className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Location (e.g. Riyadh)"
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                className="w-full h-10 pl-8 sm:pl-10 pr-3 text-xs bg-transparent text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </div>

            <button
              type="button"
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content Area: Left Filters + Job Grid (Screen 1) ── */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Filter Sidebar (3 cols) */}
        <aside className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Filters</h2>
            <button
              onClick={() => {
                setSearchTitle('');
                setSearchLocation('');
                setSelectedDept('ALL');
              }}
              className="text-[11px] text-blue-600 font-semibold hover:underline"
            >
              Clear all
            </button>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-600"
            >
              <option value="ALL">All Departments</option>
              <option value="Nursing">Nursing</option>
              <option value="Radiology">Radiology</option>
              <option value="Pharmacy">Pharmacy</option>
              <option value="IT">IT & Technology</option>
              <option value="Health Information">Health Information</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Job Type</label>
            <select className="w-full h-9 px-3 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-600">
              <option>All Types</option>
              <option>Full-time</option>
              <option>Part-time</option>
              <option>Contract</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Location</label>
            <select className="w-full h-9 px-3 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-600">
              <option>All Locations</option>
              <option>Riyadh, Saudi Arabia</option>
              <option>Jeddah, Saudi Arabia</option>
              <option>Muscat, Oman</option>
            </select>
          </div>

          <div className="pt-2 border-t border-gray-100 space-y-2 text-xs font-semibold text-gray-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded text-blue-600" />
              <span>Remote only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded text-blue-600" />
              <span>Easy Apply</span>
            </label>
          </div>
        </aside>

        {/* Right Job Cards Grid (9 cols) */}
        <section className="lg:col-span-9 space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
            <span>{filteredJobs.length} jobs found</span>
            <span className="text-gray-400">Most Recent ▼</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-lg border border-gray-200 p-5 shadow-xs hover:border-blue-300 hover:shadow-sm transition flex flex-col justify-between space-y-4 relative"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 leading-snug">{job.title}</h3>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">{job.department}</p>
                  </div>
                  <button
                    onClick={() => toggleBookmark(job.id)}
                    className={`p-1.5 rounded-lg border transition ${
                      bookmarked[job.id] ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    ♥
                  </button>
                </div>

                {/* Location & Metadata */}
                <div className="space-y-1.5 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Icon name="map-pin" size={12} className="text-gray-400" />
                    <span>{job.location}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                      {job.type}
                    </span>
                    {job.easyApply && (
                      <span className="text-[10px] font-bold text-emerald-700">
                        Easy Apply
                      </span>
                    )}
                  </div>
                </div>

                {/* Apply Link */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 font-medium">Posted {job.posted}</span>
                  <Link
                    to={`/careers/1`}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    View Role & Apply &gt;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── Bottom Feature Strip (Screen 1) ── */}
      <footer className="bg-white border-t border-gray-200 py-6 px-4">
        <div className="max-w-[1440px] mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-xs font-bold text-gray-700">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            Competitive Salary
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            Great Benefits
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-600" />
            Career Growth
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-600" />
            Impact Lives
          </div>
        </div>
      </footer>
    </div>
  );
}
