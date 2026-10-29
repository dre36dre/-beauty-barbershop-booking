import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, map, of, switchMap, timeout } from 'rxjs';
import { BookingApi, BookingSummary, CreatedBooking, Professional, SalonService } from '../../core/booking-api';
import { AppointmentStore, AppointmentEntry } from '../../core/appointment-store';

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
    if (!this.selectedDate) return [];
    const parts = this.parseDateParts(this.selectedDate);
    if (!parts || this.isDatePast(this.selectedDate) || this.isDayBlocked(this.selectedDate)) return [];

    const dateObj = new Date(parts.year, parts.month - 1, parts.day);
    const weekday = dateObj.getDay();
    const closingMinutes = weekday === 3 || weekday === 4 || weekday === 5 ? 18 * 60 + 30 : 18 * 60;
    const options: Array<{ time: string; available: boolean }> = [];
    const isToday = this.isDateToday(this.selectedDate);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (let minutes = 10 * 60; minutes <= closingMinutes; minutes += 15) {
      // Se a data for hoje, horários passados (ex: até 15:27, 15:00 e 15:15) não são exibidos como opções
      if (isToday && minutes <= currentMinutes) {
        continue;
      }
      const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
      const minute = String(minutes % 60).padStart(2, '0');
      const time = `${hour}:${minute}`;

      const isBooked = this.isTimeBooked(this.selectedDate, time);
      const isBlocked = this.isTimeBlocked(this.selectedDate, time);
      const isAvailableInTimes = this.times.length === 0 || this.times.includes(time);
      const available = !isBooked && !isBlocked && isAvailableInTimes;

      options.push({ time, available });
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
      this.minimumDate = this.localDateString(new Date());
      if (this.isDatePast(this.selectedDate)) {
        this.selectedDate = '';
        this.errorMessage = 'Não é possível agendar para uma data passada. Escolha hoje ou uma data futura.';
        this.cdr.markForCheck();
        return;
      }

      if (this.isDayBlocked(this.selectedDate)) {
        const block = this.appointmentStore.getBlockForDate(this.selectedDate);
        const motivo = block?.motivo ? ` (${block.motivo})` : '';
        this.selectedDate = '';
        this.errorMessage = `Esta data foi indisponibilizada pelo salão${motivo}. Por favor, escolha outro dia.`;
        this.cdr.markForCheck();
        return;
      }

      const parts = this.parseDateParts(this.selectedDate);
      if (parts) {
        const weekday = new Date(parts.year, parts.month - 1, parts.day).getDay();
        if (weekday === 0 || weekday === 1) {
          this.selectedDate = '';
          this.errorMessage = 'O salão fecha aos domingos e às segundas-feiras. Escolha outro dia.';
          this.cdr.markForCheck();
          return;
        }

        if (this.isDateToday(this.selectedDate)) {
          const now = new Date();
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          const closingMinutes = weekday === 3 || weekday === 4 || weekday === 5 ? 18 * 60 + 30 : 18 * 60;
          if (currentMinutes >= closingMinutes) {
            this.errorMessage = 'O expediente de hoje já foi encerrado. Por favor, escolha outra data.';
          }
        }
      }
    }

    this.loadAvailableTimes();
    this.cdr.markForCheck();
  }

  selectTime(time: string): void {
    if (!time || this.isPastTime(this.selectedDate, time)) {
      this.selectedTime = '';
      this.errorMessage = 'Este horário já passou. Por favor, escolha um horário futuro.';
      this.cdr.markForCheck();
      return;
    }
    if (this.isDayBlocked(this.selectedDate)) {
      this.selectedTime = '';
      this.errorMessage = 'Esta data foi indisponibilizada pelo salão. Por favor, escolha outro dia.';
      this.cdr.markForCheck();
      return;
    }
    if (this.isTimeBlocked(this.selectedDate, time)) {
      this.selectedTime = '';
      const block = this.appointmentStore.getBlockForDateTime(this.selectedDate, time);
      const motivo = block?.motivo ? ` (${block.motivo})` : '';
      this.errorMessage = `Este horário foi indisponibilizado pelo salão${motivo}. Por favor, escolha outro horário.`;
      this.cdr.markForCheck();
      return;
    }
    if (this.isTimeBooked(this.selectedDate, time)) {
      this.selectedTime = '';
      this.errorMessage = 'Este horário já está reservado. Por favor, escolha outro horário.';
      this.cdr.markForCheck();
      return;
    }

    this.errorMessage = '';
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

    if (this.isDatePast(this.selectedDate) || this.isPastTime(this.selectedDate, this.selectedTime)) {
      this.errorMessage = 'Este horário já passou. Por favor, escolha um horário futuro.';
      this.cdr.markForCheck();
      return;
    }

    if (this.isDayBlocked(this.selectedDate)) {
      this.errorMessage = 'Esta data foi indisponibilizada pelo salão. Por favor, escolha outro dia.';
      this.cdr.markForCheck();
      return;
    }

    if (this.isTimeBlocked(this.selectedDate, this.selectedTime)) {
      const block = this.appointmentStore.getBlockForDateTime(this.selectedDate, this.selectedTime);
      const motivo = block?.motivo ? ` (${block.motivo})` : '';
      this.errorMessage = `Este horário foi indisponibilizado pelo salão${motivo}. Por favor, escolha outro horário.`;
      this.cdr.markForCheck();
      return;
    }

    if (this.isTimeBooked(this.selectedDate, this.selectedTime)) {
      this.errorMessage = 'Este horário já está reservado. Por favor, escolha outro horário.';
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
        const validTimes = Object.keys(professionalsByTime).filter(
          (time) =>
            !this.isPastTime(this.selectedDate, time) &&
            !this.isTimeBooked(this.selectedDate, time) &&
            !this.isTimeBlocked(this.selectedDate, time)
        ).sort();
        this.professionalsByTime = professionalsByTime;
        this.times = validTimes;
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
    if (!this.selectedDate) {
      this.times = [];
      this.loadingOptions = false;
      this.cdr.markForCheck();
      return;
    }
    const parts = this.parseDateParts(this.selectedDate);
    if (!parts || this.isDayBlocked(this.selectedDate)) {
      this.times = [];
      this.loadingOptions = false;
      this.cdr.markForCheck();
      return;
    }

    const weekday = new Date(parts.year, parts.month - 1, parts.day).getDay();
    const closingMinutes = weekday === 3 || weekday === 4 || weekday === 5 ? 18 * 60 + 30 : 18 * 60;
    const fallbackTimes: string[] = [];
    const professionalsByTime: Record<string, number[]> = {};
    const isToday = this.isDateToday(this.selectedDate);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (let minutes = 10 * 60; minutes <= closingMinutes; minutes += 15) {
      if (isToday && minutes <= currentMinutes) {
        continue;
      }
      const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
      const minute = String(minutes % 60).padStart(2, '0');
      const time = `${hour}:${minute}`;

      if (!this.isTimeBooked(this.selectedDate, time) && !this.isTimeBlocked(this.selectedDate, time)) {
        fallbackTimes.push(time);
        professionalsByTime[time] = [1];
      }
    }
    this.professionalsByTime = professionalsByTime;
    this.times = fallbackTimes;
    this.loadingOptions = false;
    this.cdr.markForCheck();
  }

  isDayBlocked(dateStr: string): boolean {
    return this.appointmentStore.isDayBlocked(dateStr);
  }

  isTimeBlocked(dateStr: string, timeStr: string): boolean {
    return this.appointmentStore.isTimeBlocked(dateStr, timeStr);
  }

  parseDateParts(dateStr: string): { year: number; month: number; day: number } | null {
    if (!dateStr) return null;
    const clean = String(dateStr).trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(clean)) {
      const [y, m, d] = clean.split('T')[0].split('-').map(Number);
      return { year: y, month: m, day: d };
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(clean)) {
      const [d, m, y] = clean.split('T')[0].split('/').map(Number);
      return { year: y, month: m, day: d };
    }
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      return { year: parsed.getFullYear(), month: parsed.getMonth() + 1, day: parsed.getDate() };
    }
    return null;
  }

  isDateToday(dateStr: string): boolean {
    const parts = this.parseDateParts(dateStr);
    if (!parts) return false;
    const now = new Date();
    return (
      parts.year === now.getFullYear() &&
      parts.month === now.getMonth() + 1 &&
      parts.day === now.getDate()
    );
  }

  isDatePast(dateStr: string): boolean {
    const parts = this.parseDateParts(dateStr);
    if (!parts) return false;
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();

    if (parts.year < todayYear) return true;
    if (parts.year > todayYear) return false;
    if (parts.month < todayMonth) return true;
    if (parts.month > todayMonth) return false;
    return parts.day < todayDay;
  }

  isPastTime(dateStr: string, timeStr: string): boolean {
    if (!dateStr || !timeStr) return false;
    if (this.isDatePast(dateStr)) return true;
    if (!this.isDateToday(dateStr)) return false;

    const now = new Date();
    const parts = timeStr.split(':').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return false;
    const timeMinutes = parts[0] * 60 + parts[1];
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return timeMinutes <= nowMinutes;
  }

  isTimeBooked(dateStr: string, timeStr: string): boolean {
    if (!dateStr || !timeStr) return false;
    const targetParts = this.parseDateParts(dateStr);
    if (!targetParts) return false;

    return this.appointmentStore.appointments().some((a: AppointmentEntry) => {
      const aParts = this.parseDateParts(a.data);
      if (!aParts) return false;
      return (
        aParts.year === targetParts.year &&
        aParts.month === targetParts.month &&
        aParts.day === targetParts.day &&
        a.horario === timeStr
      );
    });
  }

  private localDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
