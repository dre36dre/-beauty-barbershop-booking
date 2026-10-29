import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, map, of, switchMap, timeout } from 'rxjs';
import { BookingApi, BookingSummary, CreatedBooking, Professional, SalonService } from '../../core/booking-api';
import { AppointmentStore } from '../../core/appointment-store';

@Component({
  selector: 'app-booking',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './booking.html',
  styleUrl: './booking.css',
})
export class Booking implements OnInit {
  private readonly api = inject(BookingApi);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly appointmentStore = inject(AppointmentStore);
  private availabilityRequest = 0;
  private timesRequest = 0;
  private backendAvailable = false;

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

  services: SalonService[] = [...this.appointmentStore.services()];
  professionals: Professional[] = [{ id: 1, nome: 'Vanessa Souza' }];
  times: string[] = [];
  professionalsByTime: Record<string, number[]> = {};
  selectedServices: number[] = [];
  selectedDate = '';
  selectedProfessional = '1';
  selectedTime = '';
  summary: BookingSummary | null = null;
  client = { nome: '', telefone: '', anotacao: '', email: '', endereco: '' };
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
    this.api.initializeCsrf().pipe(
      timeout(1500),
      switchMap(() => this.api.getServices().pipe(timeout(1500))),
    ).subscribe({
      next: (response) => {
        this.backendAvailable = true;
        if (response?.servicos && response.servicos.length > 0) {
          this.services = response.servicos;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        // Backend offline: modo autônomo ativo
        this.backendAvailable = false;
        this.cdr.markForCheck();
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

    if (this.selectedServices.length) {
      this.loadAvailableTimes();
    }
    this.cdr.markForCheck();
  }

  onDateChange(): void {
    this.availabilityRequest++;
    this.timesRequest++;
    this.loadingOptions = false;
    this.selectedTime = '';
    this.errorMessage = '';

    if (this.selectedDate) {
      const weekday = new Date(`${this.selectedDate}T12:00:00`).getDay();
      if (weekday === 0 || weekday === 1) {
        this.selectedDate = '';
        this.errorMessage = 'O salão fecha aos domingos e às segundas-feiras. Escolha outro dia.';
        this.cdr.markForCheck();
        return;
      }
    }

    this.loadAvailableTimes();
    this.cdr.markForCheck();
  }

  selectTime(time: string): void {
    this.selectedTime = time;
    const professionalId = this.professionalsByTime[time]?.[0] ?? this.professionals[0]?.id ?? 1;
    this.selectedProfessional = String(professionalId);
    this.cdr.markForCheck();
  }

  submitBooking(): void {
    if (!this.selectedServices.length || !this.selectedDate || !this.selectedTime) {
      this.errorMessage = 'Escolha os serviços, a data e o horário.';
      this.cdr.markForCheck();
      return;
    }

    if (!this.selectedProfessional) {
      this.selectedProfessional = '1';
    }

    this.errorMessage = '';

    // Registra imediatamente no store compartilhado (dispara alerta sonoro e visual para o Admin)
    const servicoNomes = this.selectedServiceDetails.map((s) => s.nome).join(' + ');
    const clientName = this.client.nome.trim() || 'Cliente';
    const clientNote = this.client.anotacao?.trim() || '';
    this.appointmentStore.add({
      nome: clientName,
      horario: this.selectedTime,
      servico: servicoNomes,
      valor: this.selectedSubtotal,
      data: this.selectedDate,
      observacoes: clientNote,
    }, 'cliente');

    // Salva o cliente na lista de clientes do Admin se ainda não estiver cadastrado
    try {
      if (typeof localStorage !== 'undefined' && clientName) {
        const raw = localStorage.getItem('vsn_clients');
        const list = raw ? JSON.parse(raw) : [];
        if (!list.some((c: { nome: string }) => c.nome.toLowerCase() === clientName.toLowerCase())) {
          list.unshift({
            id: Date.now(),
            nome: clientName,
            telefone: this.client.telefone || '(11) 99999-9999',
            email: this.client.email || `${clientName.toLowerCase().replace(/\s+/g, '.')}@email.com`,
            dataNascimento: '15/05/1992',
            preferencia: clientNote ? `${servicoNomes} (${clientNote})` : servicoNomes,
          });
          localStorage.setItem('vsn_clients', JSON.stringify(list));
        }
      }
    } catch {
      // Ignora erro de storage local
    }

    const booking = {
      profissional_id: Number(this.selectedProfessional),
      data: this.selectedDate,
      horario: this.selectedTime,
      servicos: [...this.selectedServices],
    };

    // Confirmação instantânea na tela para o usuário (0ms de espera)
    this.success = {
      id: Math.floor(1000 + Math.random() * 9000),
      status: 'Confirmado',
      valor_total: this.summary?.valor_total ?? this.selectedSubtotal.toFixed(2),
      duracao_total: this.summary?.duracao_total ?? 0,
    };
    this.submitting = false;
    this.cdr.markForCheck();

    // Se o backend estiver ativo, sincroniza em segundo plano
    if (this.backendAvailable) {
      this.api.createClient({
        nome: this.client.nome,
        telefone: this.client.telefone,
        endereco: clientNote || 'Sem anotações',
        email: this.client.email,
        anotacao: clientNote,
      }).pipe(
        timeout(3000),
        switchMap((createdClient) => this.api.createBooking({ ...booking, cliente_id: createdClient.id }).pipe(timeout(3000))),
      ).subscribe({
        next: (createdBooking) => {
          if (createdBooking?.id) {
            this.success = createdBooking;
            this.cdr.markForCheck();
          }
        },
        error: () => {
          // Mantém a confirmação imediata já visível
        },
      });
    }
  }

  formatPrice(value: string | number): string {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private loadAvailableTimes(): void {
    if (!this.selectedDate || !this.selectedServices.length) {
      this.loadingOptions = false;
      this.cdr.markForCheck();
      return;
    }

    if (!this.backendAvailable) {
      this.setupFallbackTimes();
      return;
    }

    const request = ++this.availabilityRequest;
    const timesRequest = ++this.timesRequest;
    this.loadingOptions = true;

    this.api.getProfessionals(this.selectedDate, this.selectedServices).pipe(
      timeout(2000),
      switchMap((response) => {
        this.professionals = response.profissionais;
        if (!response.profissionais.length) return of([] as Array<{ id: number; horarios: string[] }>);
        return forkJoin(response.profissionais.map((professional) => this.api.getTimes(
          this.selectedDate,
          professional.id,
          this.selectedServices,
        ).pipe(timeout(2000), map((result) => ({ id: professional.id, horarios: result.horarios })))));
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
        this.cdr.markForCheck();
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
    this.loadingOptions = false;
    this.cdr.markForCheck();
  }

  private localDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
