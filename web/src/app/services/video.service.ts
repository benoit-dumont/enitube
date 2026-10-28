import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { VideoSearchResponse } from '@enitube/shared';
import { API_URL } from '../config';

@Injectable({ providedIn: 'root' })
export class VideoService {
  private readonly http = inject(HttpClient);

  /** `pageToken` : valeur de `nextPageToken` de la page précédente, renvoyée telle quelle. */
  search(q: string, pageToken?: string): Observable<VideoSearchResponse> {
    let params = new HttpParams().set('q', q);
    if (pageToken) params = params.set('pageToken', pageToken);
    return this.http.get<VideoSearchResponse>(`${API_URL}/videos/search`, { params });
  }
}
