import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface SalonService {
  id: number;
  nome: string;
  preco: string;
  duracao: number;
  descricao: string;
}

export interface Professional {
  id: number;
  nome: string;
}

export interface BookingSummary {
  servicos: Array<Pick<SalonService, 'id' | 'nome' | 'preco' | 'duracao'>>;
  valor_total: string;
  duracao_total: number;
}

export interface CreatedClient {
  id: number;
  nome: string;
}

export interface CreatedBooking {
  id: number;
  status: string;
  valor_total: string;
  duracao_total: number;
}

@Injectable({ providedIn: 'root' })
export class BookingApi {
  private readonly http = inject(HttpClient);

  // Em desenvolvimento, o proxy do Angular encaminha /api para o Django local.
  // Na publicação, a meta api-base-url pode apontar para a origem pública do backend.
  private readonly baseUrl = document.querySelector<HTMLMetaElement>('meta[name="api-base-url"]')?.content || '/api';

  initializeCsrf(): Observable<{ ok: boolean }> {
    return this.http.get<{ ok: boolean }>(`${this.baseUrl}/csrf/`, {
      withCredentials: true,
    });
  }

  getServices(): Observable<{ servicos: SalonService[] }> {
    return this.http.get<{ servicos: SalonService[] }>(`${this.baseUrl}/servicos/`, {
      withCredentials: true,
    });
  }

  getProfessionals(date: string, serviceIds: number[]): Observable<{ profissionais: Professional[] }> {
    let params = new HttpParams().set('data', date);
    for (const id of serviceIds) params = params.append('servico_id', id);
    return this.http.get<{ profissionais: Professional[] }>(`${this.baseUrl}/profissionais/`, {
      params,
      withCredentials: true,
    });
  }

  getTimes(date: string, professionalId: number, serviceIds: number[]): Observable<{ horarios: string[] }> {
    let params = new HttpParams().set('data', date).set('profissional_id', professionalId);
    for (const id of serviceIds) params = params.append('servico_id', id);
    return this.http.get<{ horarios: string[] }>(`${this.baseUrl}/horarios/`, {
      params,
      withCredentials: true,
    });
  }

  getSummary(serviceIds: number[]): Observable<BookingSummary> {
    return this.post<BookingSummary>('/resumo/', { servicos: serviceIds });
  }

  createClient(client: { nome: string; telefone: string; endereco?: string; email: string; anotacao?: string }): Observable<CreatedClient> {
    return this.post<CreatedClient>('/clientes/', client);
  }

  createBooking(booking: {
    cliente_id: number;
    profissional_id: number;
    data: string;
    horario: string;
    servicos: number[];
  }): Observable<CreatedBooking> {
    return this.post<CreatedBooking>('/agendamentos/', booking);
  }

  private post<T>(path: string, body: unknown): Observable<T> {
    const csrfToken = this.readCookie('csrftoken');
    const headers = csrfToken ? new HttpHeaders({ 'X-CSRFToken': csrfToken }) : undefined;
    return this.http.post<T>(`${this.baseUrl}${path}`, body, {
      headers,
      withCredentials: true,
    });
  }

  private readCookie(name: string): string | null {
    const prefix = `${name}=`;
    const cookie = document.cookie.split('; ').find((item) => item.startsWith(prefix));
    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
  }
}
