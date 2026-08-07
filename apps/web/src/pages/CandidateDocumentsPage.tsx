import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { getApi, postApi } from '../api/client';
import type { Candidate, CandidateDocument } from '@recruitflow/contracts';

export function CandidateDocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [documentType, setDocumentType] = useState('CV');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [mimeType, setMimeType] = useState('');
  const [extractionText, setExtractionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [c, docs] = await Promise.all([
        getApi<Candidate>(`/candidates/${id}`),
        getApi<CandidateDocument[]>(`/documents/candidate/${id}`),
      ]);
      setCandidate(c);
      setDocuments(docs);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load candidate documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !fileName) return;
    setSubmitting(true);
    setUploadError(null);

    try {
      await postApi('/documents', {
        candidateId: id,
        documentType,
        fileName: fileName.trim(),
        fileSize,
        mimeType,
        storageKey: `org-docs/${id}/${Date.now()}_${fileName.trim()}`,
        extractionText: extractionText.trim() || undefined,
      });
      setIsUploadModalOpen(false);
      setFileName('');
      setFileSize(0);
      setMimeType('');
      setExtractionText('');
      loadData();
    } catch (err: unknown) {
      setUploadError((err as Error).message || 'Failed to upload document.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Loading document vault...</div>;
  }

  if (error || !candidate) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>
        {error || 'Candidate not found.'}
        <div><Link to="/candidates" style={{ textDecoration: 'underline', marginTop: '8px', display: 'inline-block' }}>Back to Candidates</Link></div>
      </div>
    );
  }

  return (
    <div className="candidate-documents-page" style={{ padding: '24px' }}>
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <span className="eyebrow" style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Candidates / {candidate.candidateCode} / Vault</span>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '4px 0' }}>Private Document Vault — {candidate.firstName} {candidate.lastName}</h1>
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Secure candidate CV, certificates, identification documents, and extracted text</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="primary-button"
            onClick={() => setIsUploadModalOpen(true)}
            style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}
          >
            + Upload Document
          </button>
        </div>
      </div>

      <div className="panel" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>Uploaded Candidate Documents ({documents.length})</h3>

        {documents.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px', background: 'var(--background)', borderRadius: '8px' }}>
            No documents uploaded yet. Click "+ Upload Document" to attach candidate CVs or certificates.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {documents.map((doc) => (
              <div key={doc.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', background: 'var(--background)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <span style={{ padding: '2px 8px', borderRadius: '12px', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', fontSize: '11px', fontWeight: 600, marginRight: '8px' }}>
                      {doc.documentType}
                    </span>
                    <strong style={{ fontSize: '13px' }}>{doc.fileName}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '12px' }}>({(doc.fileSize / 1024).toFixed(1)} KB — {doc.mimeType})</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: 500 }}>Scan Status: {doc.scanStatus}</span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Secure download is unavailable until storage is configured.</span>
                  </div>
                </div>
                {doc.extractionText && (
                  <div style={{ marginTop: '12px', padding: '12px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Parsed CV Extraction Snippet:</span>
                    <p style={{ margin: 0, fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                      {doc.extractionText}
                    </p>
                  </div>
                )}
                <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--muted)' }}>
                  Uploaded by {doc.uploadedByName || 'User'} on {new Date(doc.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Upload Candidate Document">
        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {uploadError && <div style={{ color: '#dc2626', fontSize: '12px' }}>{uploadError}</div>}
          <div>
            <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Document Type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
            >
              <option value="CV">Curriculum Vitae (CV / Resume)</option>
              <option value="Certificate">Professional Certificate</option>
              <option value="Identification">Passport / National ID</option>
              <option value="Other">Other Document</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>File Name *</label>
            <input
              required
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setFileName(file?.name ?? '');
                setFileSize(file?.size ?? 0);
                const extension = file?.name.toLowerCase().split('.').pop();
                const fallbackMime = extension === 'pdf'
                  ? 'application/pdf'
                  : extension === 'doc'
                    ? 'application/msword'
                    : extension === 'docx'
                      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                      : extension === 'jpg' || extension === 'jpeg'
                        ? 'image/jpeg'
                        : 'image/png';
                setMimeType(file?.type || fallbackMime);
              }}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>Parsed CV Extraction Text (Optional)</label>
            <textarea
              rows={3}
              value={extractionText}
              onChange={(e) => setExtractionText(e.target.value)}
              placeholder="Extracted skills, work experience text..."
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
            ></textarea>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(false)}
              style={{ padding: '8px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}
            >
              {submitting ? 'Saving...' : 'Save Document Metadata'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
