export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

export interface ApiProblem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}
