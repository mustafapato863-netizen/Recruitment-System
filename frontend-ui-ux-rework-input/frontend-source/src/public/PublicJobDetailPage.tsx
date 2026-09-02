import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';

export function PublicJobDetailPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col justify-between">
      {/* ── Top Header Navigation (Screen 2) ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm">
              R
            </div>
            <span className="font-extrabold text-gray-900 text-base tracking-tight">RecruitFlow</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-gray-600">
            <Link to="/careers" className="text-blue-600">Jobs</Link>
            <a href="#about" className="hover:text-gray-900">About Us</a>
            <a href="#why" className="hover:text-gray-900">Why SGH</a>
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

      {/* ── Main Layout: Job Details (Left) + Apply Form (Right) (Screen 2) ── */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 flex-1 w-full space-y-6">
        {/* Back Link */}
        <div>
          <Link
            to="/careers"
            className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-blue-600 transition"
          >
            &larr; Back to jobs
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Job Description & Details (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-lg border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Registered Nurse
              </h1>
              <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-gray-500 flex-wrap">
                <span>Nursing</span>
                <span>&bull;</span>
                <span>Riyadh, Saudi Arabia</span>
                <span>&bull;</span>
                <span className="text-blue-600">Full-time</span>
                <span>&bull;</span>
                <span className="text-emerald-600 font-bold">Easy Apply</span>
              </div>
            </div>

            {/* About the role */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">About the role</h2>
              <p className="text-xs text-gray-600 leading-relaxed">
                We're looking for a compassionate and skilled Registered Nurse to deliver high-quality patient care and support our healthcare team in providing excellent service.
              </p>
              <ul className="list-disc pl-5 text-xs text-gray-600 space-y-1.5 leading-relaxed">
                <li>Deliver patient care by assessing, planning and implementing care plans.</li>
                <li>Collaborate with doctors and healthcare professionals.</li>
                <li>Ensure patient safety and comfort.</li>
                <li>Educate patients and families.</li>
                <li>Maintain accurate records and documentation.</li>
              </ul>
            </div>

            {/* Requirements */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Requirements</h2>
              <ul className="list-disc pl-5 text-xs text-gray-600 space-y-1.5 leading-relaxed">
                <li>Bachelor's degree in Nursing (BSN).</li>
                <li>Valid Saudi Commission for Health Specialties license.</li>
                <li>2+ years of clinical experience preferred.</li>
                <li>Strong communication and interpersonal skills.</li>
                <li>BLS/ACLS certification is a plus.</li>
              </ul>
            </div>

            {/* Metadata Grid */}
            <div className="pt-6 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
              <div>
                <span className="text-gray-400 block text-[11px]">Department</span>
                <span className="font-bold text-gray-900">Nursing</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Job Type</span>
                <span className="font-bold text-gray-900">Full-time</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Experience</span>
                <span className="font-bold text-gray-900">2+ years</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Posted</span>
                <span className="font-bold text-gray-900">May 12, 2024</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Vacancies</span>
                <span className="font-bold text-blue-600">5</span>
              </div>
            </div>
          </div>

          {/* Right: Sticky 1-Click Application Form (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-lg border border-gray-200 p-6 shadow-xs space-y-5 sticky top-24">
            <h2 className="text-sm font-bold text-gray-900">Apply for this position</h2>

            {submitted ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center space-y-2">
                <div className="w-10 h-10 bg-emerald-500 text-white rounded-full mx-auto flex items-center justify-center font-bold text-lg">
                  ✓
                </div>
                <h3 className="text-xs font-bold text-emerald-900">Application Submitted!</h3>
                <p className="text-[11px] text-emerald-700">
                  Thank you for applying. The hiring team has received your application and will review it shortly.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/portal/applications')}
                  className="mt-2 text-xs font-bold text-blue-600 hover:underline block mx-auto"
                >
                  Track in My Applications &gt;
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="text-gray-700 font-bold block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Ahmed Mohamed"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-gray-700 font-bold block mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="ahmed.m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-gray-700 font-bold block mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    placeholder="+966 50 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-gray-700 font-bold block mb-1">CV Upload</label>
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-blue-400 transition cursor-pointer bg-gray-50/50">
                    <Icon name="upload" size={16} className="mx-auto text-gray-400 mb-1" />
                    <span className="text-[11px] text-gray-500 block">
                      <strong className="text-blue-600">Drag &amp; drop your CV here</strong> or Browse
                    </span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">PDF, DOCX up to 10MB</span>
                  </div>
                </div>

                <div>
                  <label className="text-gray-700 font-bold block mb-1">Cover Letter (optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Tell us why you're a great fit..."
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-blue-600 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
                >
                  Submit Application
                </button>

                <p className="text-[10px] text-gray-400 text-center leading-tight">
                  By applying, you agree to our <a href="#privacy" className="text-blue-600 underline">Privacy Policy</a>
                </p>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 px-4 text-center text-xs text-gray-400">
        &copy; 2024 RecruitFlow Enterprise. All rights reserved.
      </footer>
    </div>
  );
}
