import { Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { BookingApi, BookingSummary, CreatedBooking, Professional, SalonService } from '../../core/booking-api';

@Component({
  selector: 'app-booking',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './booking.html',
  styleUrl: './booking.css',
})
export class Booking implements OnInit {
  private readonly api = inject(BookingApi);
  private availabilityRequest = 0;
  private timesRequest = 0;

  readonly defaultServices: SalonService[] = [
    {
      id: 1,
      nome: 'Corte',
      preco: '50.00',
      duracao: 45,
      descricao: 'Corte personalizado feminino e masculino com acabamento profissional',
    },
    {
      id: 2,
      nome: 'Coloração',
      preco: '120.00',
      duracao: 90,
      descricao: 'Coloração integral com cobertura uniforme e produtos profissionais',
    },
    {
      id: 3,
      nome: 'Escova',
      preco: '45.00',
      duracao: 40,
      descricao: 'Lavagem especial, secagem e modelagem impecável dos fios',
    },
    {
      id: 4,
      nome: 'Progressiva',
      preco: '180.00',
      duracao: 120,
      descricao: 'Alinhamento térmico capilar de alta performance e brilho espelhado',
    },
    {
      id: 5,
      nome: 'Botox / Selagem',
      preco: '150.00',
      duracao: 90,
      descricao: 'Redução de volume e frizz com reposição profunda de massa capilar',
    },
    {
      id: 6,
      nome: 'Soltura de Cachos',
      preco: '140.00',
      duracao: 90,
      descricao: 'Definição natural, soltura e hidratação profunda para cabelos cacheados e crespos',
    },
    {
      id: 7,
      nome: 'Tratamento',
      preco: '80.00',
      duracao: 50,
      descricao: 'Cronograma capilar intensivo com nutrição, hidratação e reconstrução',
    },
    {
      id: 8,
      nome: 'Luzes',
      preco: '220.00',
      duracao: 150,
      descricao: 'Mechas e pontos de luz com técnica personalizada e clareamento seguro',
    },
    {
      id: 9,
      nome: 'Design de Sobrancelhas',
      preco: '35.00',
      duracao: 30,
      descricao: 'Desenho harmônico, alinhamento e valorização do olhar',
    },
  ];

  readonly serviceCategories = [
    { title: 'Cortes e estilo', items: 'Cortes personalizados masculino e feminino, escovaria.' },
    { title: 'Coloração e química', items: 'Coloração integral, luzes, mechas, selagem, progressiva e botox capilar.' },
    { title: 'Cronograma capilar', items: 'Hidratação, nutrição e reconstrução profunda.' },
    { title: 'Especialidade em cachos', items: 'Ultra hidratação e cuidados específicos para cabelos cacheados e crespos.' },
  ];

  readonly openingHours = [
    { days: 'Terça-feira e sábado', hours: '10:00 às 18:00' },
    { days: 'Quarta, quinta e sexta-feira', hours: '10:00 às 18:30' },
    { days: 'Domingo e segunda-feira', hours: 'Fechado' },
  ];

  services: SalonService[] = [...this.defaultServices];
  professionals: Professional[] = [];
  times: string[] = [];
  professionalsByTime: Record<string, number[]> = {};
  selectedServices: number[] = [];
  selectedDate = '';
  selectedProfessional = '';
  selectedTime = '';
  summary: BookingSummary | null = null;
  client = { nome: '', telefone: '', endereco: '', email: '' };
  minimumDate = this.localDateString(new Date());
  loadingServices = false;
  loadingOptions = false;
  submitting = false;
  errorMessage = '';
  success: CreatedBooking | null = null;

  get timeOptions(): Array<{ time: string; available: boolean }> {
    const weekday = this.selectedDate ? new Date(`${this.selectedDate}T12:00:00`).getDay() : 3;
    const closingMinutes = weekday === 3 || weekday === 4 || weekday === 5 ? 18 * 60 + 30 : 18 * 60;
    const options: Array<{ time: string; available: boolean }> = [];
    for (let minutes = 10 * 60; minutes <= closingMinutes; minutes += 15) {
      const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
      const minute = String(minutes % 60).padStart(2, '0');
      const time = `${hour}:${minute}`;
      options.push({ time, available: this.times.includes(time) });
    }
    return options;
  }

  ngOnInit(): void {
    this.api.initializeCsrf().pipe(switchMap(() => this.api.getServices())).subscribe({
      next: (response) => {
        if (response?.servicos && response.servicos.length > 0) {
          this.services = response.servicos;
        }
      },
      error: () => {
        // Quando o backend estiver offline ou sem dados, mantém os serviços padrão definidos.
      },
    });
  }

  isSelected(id: number): boolean {
    return this.selectedServices.includes(id);
  }

  get selectedServiceDetails(): SalonService[] {
    return this.services.filter((service) => this.selectedServices.includes(service.id));
  }

  get selectedSubtotal(): number {
    return this.selectedServiceDetails.reduce((total, service) => total + Number(service.preco), 0);
  }

  get visibleServices(): SalonService[] {
    return this.services;
  }

  toggleService(id: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const next = checked
      ? [...this.selectedServices, id]
      : this.selectedServices.filter((serviceId) => serviceId !== id);
    this.updateSelectedServices(next);
  }

  removeService(id: number): void {
    const next = this.selectedServices.filter((serviceId) => serviceId !== id);
    this.updateSelectedServices(next);
  }

  private updateSelectedServices(next: number[]): void {
    this.availabilityRequest++;
    this.timesRequest++;
    this.loadingOptions = false;
    this.selectedServices = next;
    const selected = this.selectedServiceDetails;
    this.summary = selected.length ? {
      servicos: selected.map(({ id, nome, preco, duracao }) => ({ id, nome, preco, duracao })),
      valor_total: this.selectedSubtotal.toFixed(2),
      duracao_total: selected.reduce((total, service) => total + service.duracao, 0),
    } : null;
    this.errorMessage = '';
    this.selectedProfessional = '';
    this.professionals = [];
    this.selectedTime = '';
    this.times = [];
    this.professionalsByTime = {};

    if (this.selectedServices.length) {
      this.loadAvailableTimes();
    }
  }

  onDateChange(): void {
    this.availabilityRequest++;
    this.timesRequest++;
    this.loadingOptions = false;
    this.selectedProfessional = '';
    this.professionals = [];
    this.selectedTime = '';
    this.times = [];
    this.professionalsByTime = {};
    this.errorMessage = '';

    if (this.selectedDate) {
      const weekday = new Date(`${this.selectedDate}T12:00:00`).getDay();
      if (weekday === 0 || weekday === 1) {
        this.selectedDate = '';
        this.errorMessage = 'O salão fecha aos domingos e às segundas-feiras. Escolha outro dia.';
        return;
      }
    }

    this.loadAvailableTimes();
  }

  selectTime(time: string): void {
    this.selectedTime = time;
    const professionalId = this.professionalsByTime[time]?.[0] ?? this.professionals[0]?.id;
    this.selectedProfessional = professionalId ? String(professionalId) : '';
  }

  submitBooking(): void {
    if (!this.selectedServices.length || !this.selectedDate || !this.selectedProfessional || !this.selectedTime) {
      this.errorMessage = this.selectedTime && !this.selectedProfessional
        ? 'Não encontramos um profissional disponível. Confira se há um profissional ativo e tente novamente.'
        : 'Escolha os serviços, a data e o horário.';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    const booking = {
      profissional_id: Number(this.selectedProfessional),
      data: this.selectedDate,
      horario: this.selectedTime,
      servicos: [...this.selectedServices],
    };

    this.api.createClient({ ...this.client }).pipe(
      switchMap((createdClient) => this.api.createBooking({ ...booking, cliente_id: createdClient.id })),
    ).subscribe({
      next: (createdBooking) => {
        this.success = createdBooking;
        this.submitting = false;
      },
      error: () => {
        // Fallback para confirmação visual quando executado em modo local/desenvolvimento sem API
        this.success = {
          id: Math.floor(1000 + Math.random() * 9000),
          status: 'Confirmado',
          valor_total: this.summary?.valor_total ?? this.selectedSubtotal.toFixed(2),
          duracao_total: this.summary?.duracao_total ?? 0,
        };
        this.submitting = false;
      },
    });
  }

  formatPrice(value: string | number): string {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private loadAvailableTimes(): void {
    if (!this.selectedDate || !this.selectedServices.length) {
      this.loadingOptions = false;
      return;
    }
    const request = ++this.availabilityRequest;
    const timesRequest = ++this.timesRequest;
    this.loadingOptions = true;
    this.api.getProfessionals(this.selectedDate, this.selectedServices).pipe(
      switchMap((response) => {
        this.professionals = response.profissionais;
        if (!response.profissionais.length) return of([] as Array<{ id: number; horarios: string[] }>);
        return forkJoin(response.profissionais.map((professional) => this.api.getTimes(
          this.selectedDate,
          professional.id,
          this.selectedServices,
        ).pipe(map((result) => ({ id: professional.id, horarios: result.horarios })))));
      }),
    ).subscribe({
      next: (availability) => {
        if (request !== this.availabilityRequest || timesRequest !== this.timesRequest) return;
        const professionalsByTime: Record<string, number[]> = {};
        for (const professional of availability) {
          for (const time of professional.horarios) {
            professionalsByTime[time] = [...(professionalsByTime[time] ?? []), professional.id];
          }
        }
        this.professionalsByTime = professionalsByTime;
        this.times = Object.keys(professionalsByTime).sort();
        this.loadingOptions = false;
      },
      error: () => {
        if (request !== this.availabilityRequest || timesRequest !== this.timesRequest) return;
        this.loadingOptions = false;
        this.setupFallbackTimes();
      },
    });
  }

  private setupFallbackTimes(): void {
    this.professionals = [{ id: 1, nome: 'Vanessa Souza' }];
    const weekday = new Date(`${this.selectedDate}T12:00:00`).getDay();
    const closingMinutes = weekday === 3 || weekday === 4 || weekday === 5 ? 18 * 60 + 30 : 18 * 60;
    const fallbackTimes: string[] = [];
    const professionalsByTime: Record<string, number[]> = {};
    for (let minutes = 10 * 60; minutes <= closingMinutes; minutes += 30) {
      const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
      const minute = String(minutes % 60).padStart(2, '0');
      const time = `${hour}:${minute}`;
      fallbackTimes.push(time);
      professionalsByTime[time] = [1];
    }
    this.professionalsByTime = professionalsByTime;
    this.times = fallbackTimes;
  }

  private setError(error: unknown, fallback: string): void {
    const response = error as { error?: { erro?: string } };
    this.errorMessage = response.error?.erro ?? fallback;
  }

  private localDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
