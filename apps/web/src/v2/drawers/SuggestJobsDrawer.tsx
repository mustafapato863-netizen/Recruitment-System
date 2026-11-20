import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, CircleCheck, AlertCircle, ArrowUpRight } from 'lucide-react';
import { ButtonV2, DrawerV2, EmptyStateV2, SkeletonV2, StatusChip } from '../../components/v2';
import type { CandidateJobRecommendation } from '@recruitflow/contracts';
import { fetchCandidateJobRecommendations } from '../api/ats';
import { postApi } from '../../api/client';

interface SuggestJobsDrawerProps {
  open?: boolean;
  isOpen?: boolean;
  candidateId: string;
  candidateName: string;
  onClose: () => void;
  onApplied?: () => void;
}

export function SuggestJobsDrawer({
  open = true,
  isOpen,
  candidateId,
  candidateName,
  onClose,
  onApplied,
}: SuggestJobsDrawerProps) {
  const isDrawerOpen = isOpen !== undefined ? isOpen : open;
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<CandidateJobRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<Record<string, boolean>>({});
  const [appliedJobs, setAppliedJobs] = useState<Record<string, string>>({}); // vacancyId -> applicationId

  useEffect(() => {
    if (!isDrawerOpen) return;
    let active = true;
    setLoading(true);
    fetchCandidateJobRecommendations(candidateId)
      .then((data) => {
        if (!active) return;
        setRecommendations(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not fetch job recommendations.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [candidateId, isDrawerOpen]);

  const handleApply = async (rec: CandidateJobRecommendation) => {
    setApplying((prev) => ({ ...prev, [rec.vacancyId]: true }));
    try {
      const res = await postApi<{ id: string }>('/applications', {
        vacancyId: rec.vacancyId,
        candidateId,
        source: 'Recruiter ATS Suggestion',
      });
      setAppliedJobs((prev) => ({ ...prev, [rec.vacancyId]: res.id }));
      onApplied?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to apply candidate to role.');
    } finally {
      setApplying((prev) => ({ ...prev, [rec.vacancyId]: false }));
    }
  };

  if (!isDrawerOpen) return null;

  return (
    <DrawerV2
      open={isDrawerOpen}
      onClose={onClose}
      title="Suggest Active Roles"
      subtitle={`ATS recommended opportunities for ${candidateName}`}
    >
      {loading ? (
        <div className="space-y-3 p-4">
          <SkeletonV2 lines={3} />
        </div>
      ) : error ? (
        <div className="p-4 text-xs font-semibold text-[var(--rf2-danger)] bg-[var(--rf2-danger-tint)] rounded-xl m-4">
          {error}
        </div>
      ) : recommendations.length === 0 ? (
        <EmptyStateV2
          icon={<Briefcase />}
          title="No open opportunities match"
          body="There are currently no active open requisitions matching this candidate's skills and experience."
        />
      ) : (
        <ul className="divide-y divide-[var(--rf2-divider)] p-0 m-0 list-none">
          {recommendations.map((rec) => {
            const hasApplied = rec.alreadyApplied || Boolean(appliedJobs[rec.vacancyId]);
            const targetAppId = appliedJobs[rec.vacancyId] || rec.existingApplicationId;

            return (
              <li key={rec.vacancyId} className="p-4 hover:bg-[var(--rf2-well)] transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="m-0 text-sm font-bold text-[var(--rf2-ink)] truncate">
                        {rec.title}
                      </h4>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[var(--rf2-action-soft)] text-[var(--rf2-action)]">
                        {rec.atsScore}% Match
                      </span>
                    </div>

                    <p className="m-0 text-xs text-[var(--rf2-muted)] truncate">
                      {rec.vacancyCode} · {rec.department || 'Clinical Specialty'} · {rec.branchName || 'Cairo'}
                    </p>

                    <div className="mt-2 flex items-center gap-3 text-[11px]">
                      <span className="flex items-center gap-1 text-[var(--rf2-muted)]">
                        {rec.mustHaveMatched ? (
                          <CircleCheck size={13} className="text-[var(--rf2-success)]" />
                        ) : (
                          <AlertCircle size={13} className="text-[var(--rf2-warning)]" />
                        )}
                        <span>
                          {rec.matchedSkillsCount}/{rec.totalRequiredSkillsCount} skills matched
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    {hasApplied ? (
                      targetAppId ? (
                        <Link
                          to={`/applications/${targetAppId}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--rf2-well)] text-[var(--rf2-ink)] hover:text-[var(--rf2-action)] transition no-underline border border-[var(--rf2-divider)]"
                        >
                          <span>Open File</span>
                          <ArrowUpRight size={13} />
                        </Link>
                      ) : (
                        <StatusChip tone="info" label="Applied" />
                      )
                    ) : (
                      <ButtonV2
                        kind="primary"
                        size="sm"
                        loading={applying[rec.vacancyId]}
                        onClick={() => void handleApply(rec)}
                      >
                        Apply Candidate
                      </ButtonV2>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DrawerV2>
  );
}
