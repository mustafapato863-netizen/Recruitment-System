import { useState, useRef } from 'react';
import { Icon } from '../Icon';
import { Spinner } from '../Spinner';

interface CVUploadDropzoneProps {
  parsingFile: boolean;
  parsingStep: string;
  onFileSelect: (file?: File) => void;
}

export function CVUploadDropzone({
  parsingFile,
  parsingStep,
  onFileSelect,
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
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Drag & drop candidate CV or click to browse
              </h2>
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

    </div>
  );
}
