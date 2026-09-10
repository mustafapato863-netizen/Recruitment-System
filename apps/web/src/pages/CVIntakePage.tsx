import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageFrame } from '../components/ui/PageFrame';
import { PipelineStepper } from '../components/PipelineStepper';
import { Alert } from '../components/ui/Alert';
import { Toast } from '../components/ui/Toast';
import { Icon } from '../components/Icon';
import { Spinner } from '../components/Spinner';

import { useCVIntakeFlow, INTAKE_STEPS } from '../hooks/useCVIntakeFlow';
import { CVUploadDropzone } from '../components/intake/CVUploadDropzone';
import { CVParsedEditor } from '../components/intake/CVParsedEditor';
import { CVMatchAssigner } from '../components/intake/CVMatchAssigner';
import { CVIngestSuccess } from '../components/intake/CVIngestSuccess';

export const CVIntakePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialVacancyId = searchParams.get('vacancyId');

  const {
    currentStep,
    setCurrentStep,
    jobs,
    loadingJobs,
    uploadedFileName,
    profile,
    setProfile,
    targetVacancy,
    setTargetVacancy,
    targetStage,
    setTargetStage,
    candidateSource,
    candidateSourceOptions,
    setCandidateSource,
    duplicateDecision,
    setDuplicateDecision,
    duplicateCandidates,
    checkingDuplicates,
    duplicateCheckError,
    vacancies,
    scoredVacancies,
    confirmedCandidateCode,
    confirmedCandidateId,
    confirmedAppId,
    parsingFile,
    parsingStep,
    submitting,
    error,
    successToast,
    showToast,
    handleFile,
    proceedToResolve,
    executeFinalIngest,
    clearUpload,
    resetToParsed,
  } = useCVIntakeFlow(initialVacancyId);

  const selectedVacancyLabel = vacancies.find((vacancy) => vacancy.id === targetVacancy)?.position?.title
    || vacancies.find((vacancy) => vacancy.id === targetVacancy)?.title;

  return (
    <PageFrame
      eyebrow="AI Clinical Intake Engine • Saudi German Health RecruitFlow"
      title="CV Intake & Profile Extraction"
      description="Automated entity parsing, duplicate identity resolution, and direct candidate ingestion."
      actions={
        <button
          type="button"
          onClick={() => navigate('/candidates')}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
        >
          <Icon name="arrow-left" size={13} />
          <span>Candidate Directory</span>
        </button>
      }
    >
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-short">
          <Toast tone="success" title={successToast} />
        </div>
      )}

      {/* Connected 4-Stage Stepper */}
      <PipelineStepper steps={INTAKE_STEPS} currentStep={currentStep} />

      {/* Error Alert */}
      {error && (
        <Alert tone="danger" title="Intake Attention">
          {error}
        </Alert>
      )}

      {initialVacancyId && (
        <Alert tone="info" title="Target position selected">
          This CV will be matched to {selectedVacancyLabel || 'the selected vacancy'} after extraction and duplicate review.
        </Alert>
      )}

      {/* ── STAGE 0: UPLOAD ── */}
      {currentStep === 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 animate-fade-in">
          <div className="lg:col-span-2">
            <CVUploadDropzone
              parsingFile={parsingFile}
              parsingStep={parsingStep}
              onFileSelect={(file) => void handleFile(file)}
            />
          </div>

          {/* Right Column: Batch Info & Accepted Formats */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">
                Recent Intake Batches
              </h2>
              {loadingJobs ? (
                <div className="py-6 flex justify-center">
                  <Spinner size={20} />
                </div>
              ) : (
                <div className="space-y-2.5">
                  {jobs.slice(0, 4).map((job) => (
                    <div
                      key={job.id}
                      className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30 text-xs"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                        <span className="truncate max-w-[160px] text-[11px]">{job.fileName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          {job.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                        <span>{job.validRows || 0} processed</span>
                        <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Intake Guidelines
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Accepted file formats and parsing capabilities:
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-extrabold text-[10px]">PDF</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Adobe PDF (.pdf)</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-extrabold text-[10px]">DOC</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Microsoft Word (.docx, .doc)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE 1: VALIDATE & EDIT ── */}
      {currentStep === 1 && profile && (
        <CVParsedEditor
          profile={profile}
          setProfile={setProfile}
          scoredVacancies={scoredVacancies}
          uploadedFileName={uploadedFileName}
          candidateSource={candidateSource}
          candidateSourceOptions={candidateSourceOptions}
          setCandidateSource={setCandidateSource}
          onReset={resetToParsed}
          onBack={clearUpload}
          onProceed={proceedToResolve}
        />
      )}

      {/* ── STAGE 2: RESOLVE & MATCH ── */}
      {currentStep === 2 && profile && (
        <CVMatchAssigner
          profile={profile}
          vacancies={vacancies}
          scoredVacancies={scoredVacancies}
          targetVacancy={targetVacancy}
          setTargetVacancy={setTargetVacancy}
          targetStage={targetStage}
          setTargetStage={setTargetStage}
          candidateSource={candidateSource}
          candidateSourceOptions={candidateSourceOptions}
          setCandidateSource={setCandidateSource}
          duplicateDecision={duplicateDecision}
          setDuplicateDecision={setDuplicateDecision}
          duplicateCandidates={duplicateCandidates}
          checkingDuplicates={checkingDuplicates}
          duplicateCheckError={duplicateCheckError}
          submitting={submitting}
          onBack={() => setCurrentStep(1)}
          onConfirm={() => void executeFinalIngest()}
        />
      )}

      {/* ── STAGE 3: CONFIRM & INGEST SUCCESS ── */}
      {currentStep === 3 && profile && (
        <CVIngestSuccess
          profile={profile}
          vacancies={vacancies}
          confirmedCandidateCode={confirmedCandidateCode}
          confirmedCandidateId={confirmedCandidateId}
          confirmedAppId={confirmedAppId}
          targetVacancy={targetVacancy}
          targetStage={targetStage}
          candidateSource={candidateSource}
          onClearUpload={clearUpload}
          onShowToast={showToast}
        />
      )}
    </PageFrame>
  );
};
