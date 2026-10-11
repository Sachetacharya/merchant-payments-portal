import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url.token';
import {
  Application,
  ApplicationDraftFields,
  ApplicationListResponse,
  ApplicationStatus,
  ReviewerSummary,
  SensitiveField,
} from './application.model';

export type StatusCounts = Record<ApplicationStatus, number>;

export interface ListApplicationsParams {
  page: number;
  pageSize: number;
  status?: ApplicationStatus | null;
  search?: string;
}

@Service()
export class ApplicationsApi {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  list(params: ListApplicationsParams): Observable<ApplicationListResponse> {
    let httpParams = new HttpParams()
    .set('page', params.page)
    .set('pageSize', params.pageSize);

    if (params.status) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }
    return this.http.get<ApplicationListResponse>(`${this.apiBaseUrl}/applications`, { params: httpParams });
  }

  statusCounts(): Observable<StatusCounts> {
    return this.http.get<StatusCounts>(`${this.apiBaseUrl}/applications/stats`);
  }

  getById(id: string): Observable<Application> {
    return this.http.get<Application>(`${this.apiBaseUrl}/applications/${id}`);
  }

  create(): Observable<Application> {
    return this.http.post<Application>(`${this.apiBaseUrl}/applications`, {});
  }

  update(id: string, patch: ApplicationDraftFields): Observable<Application> {
    return this.http.patch<Application>(`${this.apiBaseUrl}/applications/${id}`, patch);
  }

  submit(id: string): Observable<Application> {
    return this.http.post<Application>(`${this.apiBaseUrl}/applications/${id}/submit`, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBaseUrl}/applications/${id}`);
  }

  assign(id: string, reviewerId: string): Observable<Application> {
    return this.http.patch<Application>(`${this.apiBaseUrl}/applications/${id}/assign`, { reviewerId });
  }

  recordDecision(id: string, approved: boolean, notes: string): Observable<Application> {
    return this.http.patch<Application>(`${this.apiBaseUrl}/applications/${id}/decision`, { approved, notes });
  }

  reveal(id: string, field: SensitiveField): Observable<{ field: string; value: string | null }> {
    return this.http.get<{ field: string; value: string | null }>(
      `${this.apiBaseUrl}/applications/${id}/reveal/${field}`,
    );
  }

  listReviewers(): Observable<ReviewerSummary[]> {
    return this.http.get<ReviewerSummary[]>(`${this.apiBaseUrl}/auth/reviewers`);
  }
}
