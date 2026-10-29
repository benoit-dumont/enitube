import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AddVideoRequest,
  CreatePlaylistRequest,
  Playlist,
  PlaylistListResponse,
  RenamePlaylistRequest,
} from '@enitube/shared';
import { API_URL } from '../config';

/** Les playlists sont filtrées côté API par le `userId` du JWT : aucun id utilisateur n'est envoyé. */
@Injectable({ providedIn: 'root' })
export class PlaylistService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_URL}/playlists`;

  list(): Observable<PlaylistListResponse> {
    return this.http.get<PlaylistListResponse>(this.base);
  }

  create(name: string): Observable<Playlist> {
    const body: CreatePlaylistRequest = { name };
    return this.http.post<Playlist>(this.base, body);
  }

  rename(id: string, name: string): Observable<Playlist> {
    const body: RenamePlaylistRequest = { name };
    return this.http.patch<Playlist>(`${this.base}/${id}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  addVideo(id: string, videoId: string): Observable<Playlist> {
    const body: AddVideoRequest = { videoId };
    return this.http.post<Playlist>(`${this.base}/${id}/videos`, body);
  }

  removeVideo(id: string, videoId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/videos/${videoId}`);
  }
}
