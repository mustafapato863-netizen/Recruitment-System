import { useState, useRef } from 'react';
import { Icon } from '../Icon';
import { Spinner } from '../Spinner';
import type { ExtractedCandidate } from '../../utils/resumeParser';

export const SAMPLE_CV_PRESETS: { name: string; title: string; filename: string; department: string; data: ExtractedCandidate }[] = [
  {
    name: 'Dr. Sarah Mansoor',
    title: 'Specialist Dermatologist',
    filename: 'sarah_mansoor_cv.pdf',
    department: 'Medical Specialties',
    data: {
      firstName: 'Sarah',
      lastName: 'Mansoor',
      email: 'sarah.mansoor@example.com',
      phone: '+971 50 999 0011',
      title: 'Specialist Dermatologist',
      currentCompany: 'DermaCare Specialties',
      experienceYears: 9,
      location: 'Dubai, UAE',
      education: 'MBBS, Master of Clinical Dermatology',
      summary: 'Board-certified Specialist Dermatologist with 9+ years of clinical and cosmetic dermatology experience. Specializes in laser therapies, diagnostics, and patient-centered skincare plans.',
      skills: ['Clinical Dermatology', 'Cosmetic Injectables', 'Laser Therapy', 'Skin Biopsy', 'Patient Care'],
      certifications: ['Specialist License', 'Board of Dermatology', 'BLS Certified'],
      languages: ['Arabic (Native)', 'English (Fluent)'],
    },
  },
  {
    name: 'Tariq Al-Ghamdi',
    title: 'Senior Frontend Engineer',
    filename: 'tariq_alghamdi_cv.docx',
    department: 'Information Technology',
    data: {
      firstName: 'Tariq',
      lastName: 'Al-Ghamdi',
      email: 'tariq.alghamdi@example.com',
      phone: '+966 55 444 3322',
      title: 'Senior Frontend Engineer',
      currentCompany: 'Digital Healthcare Solutions',
      experienceYears: 6,
      location: 'Riyadh, Saudi Arabia',
      education: 'B.Sc. in Computer Science',
      summary: 'Senior Frontend Engineer specializing in high-performance web applications using React, TypeScript, and modern CSS architecture.',
      skills: ['React 19', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Vite', 'GraphQL'],
      certifications: ['Cloud Practitioner', 'Frontend Professional Certificate'],
      languages: ['Arabic (Native)', 'English (Professional)'],
    },
  },
  {
    name: 'Mona El-Shenawy',
    title: 'Staff Nurse (ICU)',
    filename: 'mona_shenawy_cv.pdf',
    department: 'Critical Care & Nursing',
    data: {
      firstName: 'Mona',
      lastName: 'El-Shenawy',
      email: 'mona.shenawy@example.com',
      phone: '+966 54 111 3355',
      title: 'Staff Nurse (ICU)',
      currentCompany: 'Al-Noor Specialist Hospital',
      experienceYears: 5,
      location: 'Jeddah, Saudi Arabia',
      education: 'Bachelor of Science in Nursing (BSN)',
      summary: 'Dedicated Critical Care Staff Nurse with 5 years in high-acuity ICUs and emergency cardiac units. Skilled in ventilator management and hemodynamic monitoring.',
      skills: ['Critical Care Nursing', 'ICU Protocol', 'Hemodynamic Monitoring', 'Ventilator Management', 'EMR'],
      certifications: ['SCFHS Registered Nurse', 'ACLS Certified', 'BLS Certified'],
      languages: ['Arabic (Native)', 'English (Fluent)'],
    },
  },
];

interface CVUploadDropzoneProps {
  parsingFile: boolean;
  parsingStep: string;
  onFileSelect: (file?: File) => void;
  onPresetSelect: (preset: (typeof SAMPLE_CV_PRESETS)[0]) => void;
}

export function CVUploadDropzone({
  parsingFile,
  parsingStep,
  onFileSelect,
  onPresetSelect,
}: CVUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Drag and drop upload box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-md scale-[1.005]'
            : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-white dark:bg-slate-900 shadow-xs'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={(e) => onFileSelect(e.target.files?.[0])}
          className="hidden"
        />

        {parsingFile ? (
          <div className="flex flex-col items-center justify-center space-y-3 py-6">
            <Spinner size={36} className="text-blue-600" />
            <div className="space-y-1">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block">
                Parsing & Extracting CV Content...
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {parsingStep || 'Scanning text layers, contact info, and medical credentials...'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
              <Icon name="upload" size={28} />
            </div>

            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Drag & drop candidate CV or click to browse
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Supports Adobe PDF (.pdf) and Microsoft Word (.doc, .docx) up to 10 MB.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                📄 PDF
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                📝 Word DOCX
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                ⚡ Instant OCR & Entity Extraction
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Preset demo candidates */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Or test with verified sample CVs:
          </h3>
          <span className="text-[11px] text-slate-400">1-click simulated upload</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SAMPLE_CV_PRESETS.map((preset) => (
            <div
              key={preset.name}
              onClick={() => onPresetSelect(preset)}
              className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 hover:shadow-xs transition cursor-pointer flex items-center gap-3 group"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition">
                {preset.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600">
                  {preset.name}
                </span>
                <span className="block text-[11px] text-slate-400 truncate">
                  {preset.title}
                </span>
              </div>
              <Icon name="chevron-right" size={14} className="text-slate-300 group-hover:text-blue-600 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
