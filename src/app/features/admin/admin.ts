import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppointmentStore, AppointmentEntry, AdminAlert, BlockedSlot } from '../../core/appointment-store';
import { SalonService } from '../../core/booking-api';

export interface TodayAppointment {
  id: number;
  nome: string;
  horario: string;
  servico: string;
  valor: number;
}

export interface ClientRecord {
  id: number;
  nome: string;
  telefone: string;
  email: string;
  dataNascimento: string;
  preferencia: string;
}

export interface CalendarPill {
  horario: string;
  servico: string;
  colorType: 'yellow' | 'pink' | 'green' | 'purple' | 'blue' | 'blocked';
}

export interface CalendarDay {
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday?: boolean;
  isBlocked?: boolean;
  blockReason?: string;
  pills?: CalendarPill[];
}

@Component({
  selector: 'app-admin',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  readonly store = inject(AppointmentStore);
  private timerId?: ReturnType<typeof setInterval>;

  activeTab: 'dashboard' | 'agendamentos' | 'clientes' | 'servicos' = 'dashboard';

  // Gerenciamento de Serviços (Valores e Tempo)
  readonly salonServices = this.store.services;
  showServicesModal = false;
  editingServices: SalonService[] = [];
  servicesFeedback = '';

  openServicesModal(): void {
    this.editingServices = this.salonServices().map((s) => ({ ...s }));
    this.showServicesModal = true;
    this.servicesFeedback = '';
    this.cdr.markForCheck();
  }

  closeServicesModal(): void {
    this.showServicesModal = false;
    this.cdr.markForCheck();
  }

  addNewServiceRow(): void {
    const nextId = Math.max(...this.editingServices.map((s) => s.id), 0) + 1;
    this.editingServices = [
      ...this.editingServices,
      {
        id: nextId,
        nome: '',
        preco: '0.00',
        duracao: 30,
        descricao: '',
      },
    ];
    this.cdr.markForCheck();
    // Dá foco ao campo nome do novo card após render
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.service-name-input');
      inputs[inputs.length - 1]?.focus();
      inputs[inputs.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  removeServiceRow(index: number): void {
    this.editingServices = this.editingServices.filter((_, i) => i !== index);
    this.cdr.markForCheck();
  }

  saveServicesChanges(): void {
    // Filtra serviços com nome vazio antes de salvar
    const valid = this.editingServices.filter((s) => s.nome.trim().length > 0);
    this.store.updateAllServices(valid);
    this.servicesFeedback = `${valid.length} serviço(s) salvos com sucesso!`;
    setTimeout(() => {
      this.servicesFeedback = '';
      this.closeServicesModal();
    }, 1200);
    this.cdr.markForCheck();
  }

  resetServicesDefaults(): void {
    this.store.resetServices();
    this.editingServices = this.salonServices().map((s) => ({ ...s }));
    this.servicesFeedback = 'Valores e tempos restaurados para os padrões.';
    setTimeout(() => {
      this.servicesFeedback = '';
    }, 2000);
    this.cdr.markForCheck();
  }

  saveSingleService(service: SalonService): void {
    this.store.updateService(service.id, service.preco, service.duracao);
    this.servicesFeedback = `Serviço "${service.nome}" atualizado!`;
    setTimeout(() => {
      this.servicesFeedback = '';
    }, 2000);
    this.cdr.markForCheck();
  }

  // Informações de data e hora do rodapé da barra lateral
  currentDayOfWeek = '';
  currentDateFormatted = '';
  currentTimeFormatted = '';

  /** Agendamentos de hoje vindos do store compartilhado (reativo via signal) */
  get todayAppointments(): AppointmentEntry[] {
    return this.store.today().slice().sort((a, b) => a.horario.localeCompare(b.horario));
  }

  // Lista de Clientes (Imagem 2) com suporte a persistência local
  clients: ClientRecord[] = this.loadClientsFromStorage();

  private initialClients(): ClientRecord[] {
    return [
      { id: 1, nome: 'Ana Souza', telefone: '(11) 91234-5678', email: 'ana@email.com', dataNascimento: '12/05/1990', preferencia: 'Escova / Hidratação' },
      { id: 2, nome: 'Beatriz Lima', telefone: '(11) 99876-5432', email: 'beatriz@email.com', dataNascimento: '03/08/1995', preferencia: 'Corte / Coloração' },
      { id: 3, nome: 'Carla Oliveira', telefone: '(11) 98765-4321', email: 'carla@email.com', dataNascimento: '27/11/1988', preferencia: 'Hidratação' },
      { id: 4, nome: 'Fernanda Costa', telefone: '(11) 93456-7890', email: 'fernanda@email.com', dataNascimento: '16/06/1993', preferencia: 'Escova / Corte' },
      { id: 5, nome: 'Juliana Santos', telefone: '(11) 97654-3210', email: 'juliana@email.com', dataNascimento: '09/04/1997', preferencia: 'Coloração' },
      { id: 6, nome: 'Larissa Martins', telefone: '(11) 96543-2109', email: 'larissa@email.com', dataNascimento: '21/02/1992', preferencia: 'Corte / Hidratação' },
    ];
  }

  private loadClientsFromStorage(): ClientRecord[] {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('vsn_clients') : null;
      return raw ? (JSON.parse(raw) as ClientRecord[]) : this.initialClients();
    } catch {
      return this.initialClients();
    }
  }

  private saveClientsToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('vsn_clients', JSON.stringify(this.clients));
      }
    } catch {
      // localStorage indisponível
    }
  }

  // Formulário para Nova Cliente
  clientForm = {
    nome: '',
    telefone: '',
    email: '',
    dataNascimento: '',
    preferencia: '',
  };

  preferenceOptions = [
    'Escova / Hidratação',
    'Corte / Coloração',
    'Hidratação',
    'Escova / Corte',
    'Coloração',
    'Corte / Hidratação',
    'Soltura de Cachos',
    'Botox / Selagem',
    'Design de Sobrancelhas',
  ];

  // Controle de Modais
  showNewAppointmentModal = false;
  showCancelAppointmentModal = false;
  showBlockModal = false;
  blockFeedback = '';
  blockForm = {
    tipo: 'hora' as 'dia' | 'hora',
    data: this.store.todayDate(),
    horario: '14:00',
    motivo: '',
  };
  readonly blockedSlots = this.store.blockedSlots;

  // Notificações e Alertas do Admin
  readonly alerts = this.store.alerts;
  readonly unreadAlertsCount = this.store.unreadAlertsCount;
  readonly activeToast = this.store.activeToast;
  showNotificationsPanel = false;

  toggleNotificationsPanel(): void {
    this.showNotificationsPanel = !this.showNotificationsPanel;
    this.cdr.markForCheck();
  }

  closeNotificationsPanel(): void {
    this.showNotificationsPanel = false;
    this.cdr.markForCheck();
  }

  markAllAlertsAsRead(): void {
    this.store.markAllAlertsAsRead();
    this.cdr.markForCheck();
  }

  clearAllAlerts(): void {
    this.store.clearAllAlerts();
    this.cdr.markForCheck();
  }

  dismissToast(): void {
    this.store.dismissToast();
    this.cdr.markForCheck();
  }

  openAlertDetails(alert: AdminAlert): void {
    this.store.markAlertAsRead(alert.id);
    this.activeTab = 'dashboard';
    this.closeNotificationsPanel();
    this.cdr.markForCheck();
  }

  timeAgo(isoString: string): string {
    if (!isoString) return 'Agora';
    try {
      const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diff < 60) return 'Agora';
      if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
      if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
      return `${Math.floor(diff / 86400)} d atrás`;
    } catch {
      return 'Recentemente';
    }
  }

  newAppointment = {
    nome: '',
    horario: '',
    servico: '',
    valor: 100,
  };

  // Calendário (Imagem 3)
  readonly monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  calendarYear = new Date().getFullYear();
  calendarMonth = new Date().getMonth(); // 0-based
  displayedMonth = '';
  calendarDays: CalendarDay[] = [];

  ngOnInit(): void {
    this.updateClock();
    this.timerId = setInterval(() => {
      this.updateClock();
      this.cdr.markForCheck();
    }, 1000);

    this.buildCalendar();
  }

  ngOnDestroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
  }

  setTab(tab: 'dashboard' | 'agendamentos' | 'clientes' | 'servicos'): void {
    this.activeTab = tab;
    if (tab === 'agendamentos') {
      this.rebuildCalendar();
    }
    this.cdr.markForCheck();
  }

  get totalServicos(): number {
    return this.todayAppointments.length;
  }

  get faturamentoTotal(): number {
    return this.todayAppointments.reduce((acc, curr) => acc + curr.valor, 0);
  }

  get clientesAtendidas(): number {
    return this.todayAppointments.length;
  }

  get agendamentosNoDia(): number {
    return this.todayAppointments.length;
  }

  formatCurrency(val: number): string {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  get minAppointmentTime(): string {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  openNewAppointmentModal(): void {
    const now = new Date();
    // Sugere o próximo bloco de 15 minutos futuro (ex: às 15:27, sugere 15:30)
    const nextSlotMinutes = Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 15) * 15;
    const h = String(Math.floor(nextSlotMinutes / 60)).padStart(2, '0');
    const m = String(nextSlotMinutes % 60).padStart(2, '0');

    this.newAppointment = {
      nome: '',
      horario: `${h}:${m}`,
      servico: 'Corte Feminino',
      valor: 80,
    };
    this.showNewAppointmentModal = true;
    this.cdr.markForCheck();
  }

  closeNewAppointmentModal(): void {
    this.showNewAppointmentModal = false;
    this.cdr.markForCheck();
  }

  saveNewAppointment(): void {
    if (!this.newAppointment.nome.trim() || !this.newAppointment.horario) {
      return;
    }

    // Bloqueia horários que já passaram para a data de hoje
    const now = new Date();
    const [h, m] = this.newAppointment.horario.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      const timeMinutes = h * 60 + m;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (timeMinutes <= nowMinutes) {
        alert('Não é possível agendar em um horário que já passou hoje. Por favor, selecione um horário a partir de agora.');
        return;
      }
    }

    this.store.add({
      nome: this.newAppointment.nome.trim(),
      horario: this.newAppointment.horario,
      servico: this.newAppointment.servico,
      valor: Number(this.newAppointment.valor) || 90,
      data: this.store.todayDate(),
    }, 'admin');

    this.closeNewAppointmentModal();
  }

  openCancelAppointmentModal(): void {
    this.showCancelAppointmentModal = true;
    this.cdr.markForCheck();
  }

  closeCancelAppointmentModal(): void {
    this.showCancelAppointmentModal = false;
    this.cdr.markForCheck();
  }

  removeAppointment(id: number): void {
    this.store.remove(id);
    this.cdr.markForCheck();
  }

  get todayDate(): string {
    return this.store.todayDate();
  }

  formatDateBR(dateStr: string): string {
    return this.store.formatDateBR(dateStr);
  }

  openBlockModal(): void {
    const now = new Date();
    const nextSlotMinutes = Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 15) * 15;
    const h = String(Math.floor(nextSlotMinutes / 60)).padStart(2, '0');
    const m = String(nextSlotMinutes % 60).padStart(2, '0');

    this.blockForm = {
      tipo: 'hora',
      data: this.store.todayDate(),
      horario: `${h}:${m}`,
      motivo: '',
    };
    this.blockFeedback = '';
    this.showBlockModal = true;
    this.cdr.markForCheck();
  }

  closeBlockModal(): void {
    this.showBlockModal = false;
    this.cdr.markForCheck();
  }

  saveBlock(): void {
    if (!this.blockForm.data) {
      this.blockFeedback = 'Selecione uma data para indisponibilizar.';
      this.cdr.markForCheck();
      return;
    }

    if (this.blockForm.tipo === 'hora' && !this.blockForm.horario) {
      this.blockFeedback = 'Informe o horário que deseja bloquear.';
      this.cdr.markForCheck();
      return;
    }

    this.store.addBlock({
      tipo: this.blockForm.tipo,
      data: this.blockForm.data,
      horario: this.blockForm.tipo === 'hora' ? this.blockForm.horario : undefined,
      motivo: this.blockForm.motivo.trim() || (this.blockForm.tipo === 'dia' ? 'Dia fechado' : 'Horário indisponível'),
    });

    const dataFmt = this.store.formatDateBR(this.blockForm.data);
    this.blockFeedback = this.blockForm.tipo === 'dia'
      ? `Dia ${dataFmt} indisponibilizado com sucesso!`
      : `Horário ${this.blockForm.horario} em ${dataFmt} indisponibilizado com sucesso!`;

    this.blockForm.motivo = '';
    this.rebuildCalendar();
    this.cdr.markForCheck();
  }

  removeBlock(id: string): void {
    this.store.removeBlock(id);
    this.blockFeedback = 'Indisponibilidade removida com sucesso!';
    this.rebuildCalendar();
    this.cdr.markForCheck();
  }

  saveNewClient(): void {
    if (!this.clientForm.nome.trim()) return;

    this.clients.unshift({
      id: Date.now(),
      nome: this.clientForm.nome.trim(),
      telefone: this.clientForm.telefone.trim() || '(11) 99999-9999',
      email: this.clientForm.email.trim() || 'cliente@email.com',
      dataNascimento: this.clientForm.dataNascimento || '01/01/1995',
      preferencia: this.clientForm.preferencia || 'Escova / Hidratação',
    });

    this.saveClientsToStorage();

    this.clientForm = {
      nome: '',
      telefone: '',
      email: '',
      dataNascimento: '',
      preferencia: '',
    };
    this.cdr.markForCheck();
  }

  removeClient(id: number): void {
    this.clients = this.clients.filter((client) => client.id !== id);
    this.saveClientsToStorage();
    this.cdr.markForCheck();
  }

  buildCalendar(): void {
    this.rebuildCalendar();
  }

  /** Reconstrói o calendário lendo o store para injetar agendamentos reais nas pílulas */
  rebuildCalendar(): void {
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth(); // 0-based
    const todayYear = today.getFullYear();

    const displayYear = this.calendarYear;
    const displayMonth = this.calendarMonth;

    this.displayedMonth = `${this.monthNames[displayMonth]} de ${displayYear}`;

    const firstDayWeekday = new Date(displayYear, displayMonth, 1).getDay();

    const days: CalendarDay[] = [];

    // Dias do mês anterior para preencher
    const prevMonthDays = new Date(displayYear, displayMonth, 0).getDate();
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      days.push({ dayNumber: prevMonthDays - i, isCurrentMonth: false });
    }

    // Agrega todos os agendamentos do store por data no formato YYYY-MM-DD
    const allAppointments = this.store.all();
    const appointmentsByDate: Record<string, typeof allAppointments> = {};
    for (const appt of allAppointments) {
      if (!appointmentsByDate[appt.data]) {
        appointmentsByDate[appt.data] = [];
      }
      appointmentsByDate[appt.data].push(appt);
    }

    const colorCycle: Array<CalendarPill['colorType']> = ['yellow', 'pink', 'green', 'purple', 'blue'];

    // Pílulas de demonstração para Outubro de 2026 (Imagem 3) caso não haja agendamentos reais
    const demoPillsOutubro: Record<number, CalendarPill[]> = {
      5:  [{ horario: '09:00', servico: 'Escova', colorType: 'yellow' }, { horario: '14:00', servico: 'Coloração', colorType: 'pink' }],
      9:  [{ horario: '10:30', servico: 'Corte', colorType: 'green' }, { horario: '16:00', servico: 'Hidratação', colorType: 'purple' }],
      18: [{ horario: '11:00', servico: 'Escova', colorType: 'blue' }, { horario: '15:30', servico: 'Corte', colorType: 'pink' }],
      21: [{ horario: '09:00', servico: 'Coloração', colorType: 'yellow' }, { horario: '14:00', servico: 'Hidratação', colorType: 'purple' }],
    };

    // Dias do mês atual
    const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = displayYear === todayYear && displayMonth === todayMonth && d === todayDay;
      const dateKey = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayAppts = (appointmentsByDate[dateKey] ?? []).sort((a, b) => a.horario.localeCompare(b.horario));

      let pills: CalendarPill[] = dayAppts.map((appt, idx) => ({
        horario: appt.horario,
        servico: appt.servico.split('+')[0].split('/')[0].trim(), // exibe só o primeiro serviço
        colorType: colorCycle[idx % colorCycle.length],
      }));

      // Adiciona as pílulas de demonstração para Outubro de 2026 se não houver agendamentos reais
      if (!pills.length && displayYear === 2026 && displayMonth === 9 && demoPillsOutubro[d]) {
        pills = [...demoPillsOutubro[d]];
      }

      const isDayBlocked = this.store.isDayBlocked(dateKey);
      const dayBlock = this.store.getBlockForDate(dateKey);
      const dayHourBlocks = this.store.blockedSlots().filter(
        (b) => b.tipo === 'hora' && this.store.normalizeDate(b.data) === dateKey
      );

      if (isDayBlocked) {
        pills.unshift({
          horario: '🚫',
          servico: dayBlock?.motivo || 'Dia Bloqueado',
          colorType: 'blocked',
        });
      } else {
        for (const hb of dayHourBlocks) {
          pills.push({
            horario: hb.horario || '🚫',
            servico: hb.motivo ? `🚫 ${hb.motivo}` : '🚫 Indisponível',
            colorType: 'blocked',
          });
        }
      }

      days.push({
        dayNumber: d,
        isCurrentMonth: true,
        isToday,
        isBlocked: isDayBlocked,
        blockReason: dayBlock?.motivo,
        pills: pills.length ? pills : undefined,
      });
    }

    // Preenche até completar múltiplos de 7 (mínimo 35 células)
    let nextDay = 1;
    while (days.length % 7 !== 0 || days.length < 35) {
      days.push({ dayNumber: nextDay++, isCurrentMonth: false });
    }

    this.calendarDays = days;
    this.cdr.markForCheck();
  }

  prevMonth(): void {
    if (this.calendarMonth === 0) {
      this.calendarMonth = 11;
      this.calendarYear--;
    } else {
      this.calendarMonth--;
    }
    this.rebuildCalendar();
  }

  nextMonth(): void {
    if (this.calendarMonth === 11) {
      this.calendarMonth = 0;
      this.calendarYear++;
    } else {
      this.calendarMonth++;
    }
    this.rebuildCalendar();
  }

  goToToday(): void {
    const today = new Date();
    this.calendarYear = today.getFullYear();
    this.calendarMonth = today.getMonth();
    this.rebuildCalendar();
  }

  onSelectMonth(monthIndex: number | string): void {
    this.calendarMonth = Number(monthIndex);
    this.rebuildCalendar();
  }

  private updateClock(): void {
    const now = new Date();
    const days = [
      'Domingo',
      'Segunda-Feira',
      'Terça-Feira',
      'Quarta-Feira',
      'Quinta-Feira',
      'Sexta-Feira',
      'Sábado',
    ];

    this.currentDayOfWeek = days[now.getDay()];

    const dia = String(now.getDate()).padStart(2, '0');
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const ano = now.getFullYear();
    this.currentDateFormatted = `${dia}/${mes}/${ano}`;

    const horas = String(now.getHours()).padStart(2, '0');
    const minutos = String(now.getMinutes()).padStart(2, '0');
    this.currentTimeFormatted = `${horas}:${minutos}`;
  }
}
