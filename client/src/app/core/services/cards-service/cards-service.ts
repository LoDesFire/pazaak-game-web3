import { inject, Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Game } from '../../models/game';

export interface AvailableCardsResponse {
  player1Id: number;
  player1Name: string;
  player1WalletId: string;
  cards: string[];
}

@Injectable({
  providedIn: 'root',
})
export class CardsService {
  private readonly baseUrl = environment.apiUrl;
  private httpClient = inject(HttpClient);

  getAvailableCards(): Observable<AvailableCardsResponse> {
    return this.httpClient.get<AvailableCardsResponse>(`${this.baseUrl}/collection`);
  }

  getCurrentDeckCards(): Observable<AvailableCardsResponse> {
    return this.httpClient.get<AvailableCardsResponse>(`${this.baseUrl}/collection/deck`);
  }

  updateDeck(cards: string[]) {
    return this.httpClient.post(`${this.baseUrl}/collection/deck`, cards);
  }
}
