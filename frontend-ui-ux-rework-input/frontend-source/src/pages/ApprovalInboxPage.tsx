import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApi, patchApi } from '../api/client';
import type { Offer } from '@recruitflow/contracts';

interface ApprovalCandidateItem {
  id: string;
  candidateName: string;
  jobTitle: string;
  avatarColor: string;
  rating: number;
  stage: string;
  recommendedBy: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

const mockApprovalCandidates: ApprovalCandidateItem[] = [
  {
    id: '1',
    candidateName: 'Nour Ali',
    jobTitle: 'Registered Nurse',
    avatarColor: 'bg-blue-600',
    rating: 4.5,
    stage: 'Offer',
    recommendedBy: 'Ahmed Alfaraj',
    status: 'Pending',
  },
  {
    id: '2',
    candidateName: 'Ahmed Samir',
    jobTitle: 'Pharmacist',
    avatarColor: 'bg-emerald-600',
    rating: 4.0,
    stage: 'Offer',
    recommendedBy: 'Sara Ahmed',
    status: 'Pending',
  },
  {
    id: '3',
    candidateName: 'Omar Hassan',
    jobTitle: 'Radiology Technician',
    avatarColor: 'bg-amber-600',
    rating: 5.0,
    stage: 'Offer',
    recommendedBy: 'Omar Hassan',
    status: 'Pending',
  },
  {
    id: '4',
    candidateName: 'Heba Salah',
    jobTitle: 'Medical Coder',
    avatarColor: 'bg-purple-600',
    rating: 4.5,
    stage: 'Offer',
    recommendedBy: 'Mariam Saleh',
    status: 'Pending',
  },
  {
    id: '5',
    candidateName: 'Yousef Khaled',
    jobTitle: 'IT Support Specialist',
    avatarColor: 'bg-indigo-600',
    rating: 4.0,
    stage: 'Offer',
    recommendedBy: 'Yousef Khaled',
    status: 'Pending',
  },
  {
    id: '6',
    candidateName: 'Mai Wahba',
    jobTitle: 'Pharmacist',
    avatarColor: 'bg-rose-600',
    rating: 5.0,
    stage: 'Offer',
    recommendedBy: 'Sarah Ahmed',
    status: 'Pending',
  },
];

export function ApprovalInboxPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ApprovalCandidateItem[]>(mockApprovalCandidates);

  useEffect(() => {
    async function loadOffers() {
      try {
        const res = await getApi<Offer[]>('/offers');
        if (res && res.length > 0) {
          const mapped: ApprovalCandidateItem[] = res.map((o, idx) => ({
            id: o.id,
            candidateName: o.candidateName || 'Candidate Profile',
            jobTitle: o.positionTitle || 'Medical Staff',
            avatarColor: idx % 2 === 0 ? 'bg-blue-600' : 'bg-emerald-600',
            rating: 4.5,
            stage: 'Offer',
            recommendedBy: 'Recruitment Lead',
            status: 'Pending',
          }));
          setItems(mapped);
        }
      } catch (err) {
        console.error('Failed to load offers for approvals', err);
      }
    }
    void loadOffers();
  }, []);

  const handleAction = async (id: string, action: 'Approved' | 'Rejected') => {
    try {
      await patchApi(`/offers/${id}/status`, { status: action === 'Approved' ? 'Accepted' : 'Declined' });
    } catch {
      // Non-blocking UI update
    }
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: action } : item))
    );
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            Offer Approvals <span className="text-xs font-medium text-gray-400 font-normal">(Hiring Manager)</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Review proposed compensation packages, candidate ratings, and executive hiring decisions.
          </p>
        </div>
      </div>

      {/* ── 3 Top KPI Cards (Screen 8) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs text-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Open Roles</span>
          <span className="text-3xl font-extrabold text-gray-900 mt-2 block tnum">12</span>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs text-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Offers Pending</span>
          <span className="text-3xl font-extrabold text-gray-900 mt-2 block tnum">6</span>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs text-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Hired This Month</span>
          <span className="text-3xl font-extrabold text-gray-900 mt-2 block tnum">8</span>
        </div>
      </div>

      {/* ── Approvals Data Table (Screen 8) ── */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold">
              <tr>
                <th className="p-3.5 w-10"><input type="checkbox" className="rounded" /></th>
                <th className="p-3.5">Candidate</th>
                <th className="p-3.5">Job Title</th>
                <th className="p-3.5">Rating</th>
                <th className="p-3.5">Stage</th>
                <th className="p-3.5">Recommended By</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/70 transition">
                  <td className="p-3.5">
                    <input type="checkbox" className="rounded" />
                  </td>

                  {/* Candidate Name & Avatar */}
                  <td className="p-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full ${item.avatarColor} text-white font-bold text-[11px] flex items-center justify-center shrink-0`}>
                        {item.candidateName.charAt(0)}
                      </div>
                      <span className="font-bold text-gray-900">{item.candidateName}</span>
                    </div>
                  </td>

                  {/* Job Title */}
                  <td className="p-3.5 text-gray-700">{item.jobTitle}</td>

                  {/* Rating */}
                  <td className="p-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-400 text-xs">★★★★☆</span>
                      <span className="text-gray-900 font-bold tnum">{item.rating.toFixed(1)}</span>
                    </div>
                  </td>

                  {/* Stage */}
                  <td className="p-3.5">
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      {item.stage}
                    </span>
                  </td>

                  {/* Recommended By */}
                  <td className="p-3.5 text-gray-600">{item.recommendedBy}</td>

                  {/* Actions */}
                  <td className="p-3.5 text-center">
                    {item.status === 'Pending' ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleAction(item.id, 'Approved')}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-2xs transition cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAction(item.id, 'Rejected')}
                          className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded text-xs font-bold transition cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          item.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Link */}
        <div className="p-3.5 border-t border-gray-100 text-center">
          <button
            type="button"
            onClick={() => navigate('/offers')}
            className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
          >
            View all offers &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
