import { ValidationError } from './validation-error.model';

export interface ApiResponse<T = void> {
  data?: T;
  succeeded: boolean;
  message?: string;
  errors?: ValidationError[];
}

export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
  traceId?: string;
}
