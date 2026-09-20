/**
 * Comparison & Evaluation Contracts
 * Establishes typed comparison semantics between Student (Local AI) and Teacher (Affinda/External)
 * as well as evaluation metrics against Human-Approved Ground Truth.
 */

export type ComparisonClassification =
  | 'AGREE'             // Parity according to field-type equivalence rules
  | 'MINOR_DIFFERENCE'  // Title synonyms ("Sr." vs "Senior"), minor date tolerance, formatting
  | 'CONFLICT'          // Substantive disagreement (different company, disparate dates)
  | 'LOCAL_ONLY'        // Predicted only by local student; omitted by teacher
  | 'TEACHER_ONLY';     // Predicted only by teacher; omitted by local student

export interface SetMetricScores {
  readonly precision: number; // [0.0 - 1.0]
  readonly recall: number;    // [0.0 - 1.0]
  readonly f1Score: number;   // [0.0 - 1.0]
  readonly commonItems: readonly string[];
  readonly localExtraItems: readonly string[];
  readonly teacherExtraItems: readonly string[];
}

export interface DateComparisonDetails {
  readonly localDate?: string;
  readonly teacherDate?: string;
  readonly deltaDays: number;
  readonly withinTolerance: boolean; // e.g. within 30 days or same month
}

export interface RecordComparisonDetail {
  readonly localJobTitle?: string;
  readonly teacherJobTitle?: string;
  readonly localCompany?: string;
  readonly teacherCompany?: string;
  readonly companyAgreed: boolean;
  readonly titleClassification: ComparisonClassification;
  readonly dateDetails?: DateComparisonDetails;
}

/** Alias for record comparison detail */
export type WorkHistoryAlignmentItem = RecordComparisonDetail;

export interface FieldComparisonDetail {
  readonly fieldPath: string;
  readonly classification: ComparisonClassification;
  readonly localValue: unknown;
  readonly teacherValue: unknown;
  readonly localConfidence?: number;
  readonly teacherConfidence?: number;
  readonly notes?: string;

  // Type-specific comparison semantics
  readonly setMetrics?: SetMetricScores;
  readonly dateComparison?: DateComparisonDetails;
  readonly workHistoryAlignments?: readonly RecordComparisonDetail[];
}

/** Alias for backward compatibility */
export type FieldComparisonResult = FieldComparisonDetail;

export interface DisagreementSummary {
  readonly conflicts: readonly string[];
  readonly minorDifferences: readonly string[];
  readonly localOnly: readonly string[];
  readonly teacherOnly: readonly string[];
}

export interface ResumeComparisonReport {
  readonly organizationId: string;
  readonly binaryChecksum: string;
  readonly localRunId: string;
  readonly teacherRunId: string;
  readonly comparedAt: string;

  /**
   * Field agreement ratio between Local and Teacher:
   * (Agree + MinorDifference) / Total Fields Compared
   * NOTE: Agreement is an inter-rater consistency metric, NOT an accuracy metric.
   */
  readonly teacherAgreementRate: number;

  readonly fieldComparisons: Record<string, FieldComparisonDetail>;
  readonly disagreementSummary: DisagreementSummary;
}

/** Composite comparison result type */
export type ComparisonResult = ResumeComparisonReport;

export interface ParserAccuracyEvaluation {
  readonly evaluationId: string;
  readonly organizationId: string;
  readonly binaryChecksum: string;
  readonly evaluatedAt: string;

  /** Accuracy of Local AI compared against Human-Approved Ground Truth */
  readonly localVsHumanAccuracy: number;

  /** Accuracy of Teacher compared against Human-Approved Ground Truth */
  readonly teacherVsHumanAccuracy: number;

  /** Consistency metric between Local and Teacher */
  readonly localVsTeacherAgreement: number;

  readonly skillScores: {
    readonly localVsHuman: SetMetricScores;
    readonly teacherVsHuman: SetMetricScores;
  };

  readonly fieldAccuracies: Record<
    string,
    {
      readonly localMatchesHuman: boolean;
      readonly teacherMatchesHuman: boolean;
      readonly localAgreesWithTeacher: boolean;
    }
  >;
}
