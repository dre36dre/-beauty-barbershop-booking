import { Injectable, signal, computed } from '@angular/core';
import { SalonService } from './booking-api';

export interface AppointmentEntry {
  id: number;
  nome: string;
  horario: string;
  servico: string;
  valor: number;
  data: string; // YYYY-MM-DD
  observacoes?: string;
}

export interface AdminAlert {
  id: string;
  tipo: 'novo_agendamento' | 'cancelamento' | 'info';
  titulo: string;
  mensagem: string;
  clienteNome: string;
  servico: string;
  data: string; // DD/MM/AAAA ou YYYY-MM-DD
  horario: string;
  valor?: number;
  criadoEm: string; // ISO string
  lido: boolean;
  observacoes?: string;
}

export const DEFAULT_SALON_SERVICES: SalonService[] = [
  { id: 1, nome: 'Corte', preco: '50.00', duracao: 45, descricao: 'Corte personalizado feminino e masculino com acabamento profissional' },
  { id: 2, nome: 'Coloração', preco: '120.00', duracao: 90, descricao: 'Coloração integral com cobertura uniforme e produtos profissionais' },
  { id: 3, nome: 'Escova', preco: '45.00', duracao: 40, descricao: 'Lavagem especial, secagem e modelagem impecável dos fios' },
  { id: 4, nome: 'Progressiva', preco: '180.00', duracao: 120, descricao: 'Alinhamento térmico capilar de alta performance e brilho espelhado' },
  { id: 5, nome: 'Botox / Selagem', preco: '150.00', duracao: 90, descricao: 'Redução de volume e frizz com reposição profunda de massa capilar' },
  { id: 6, nome: 'Soltura de Cachos', preco: '140.00', duracao: 90, descricao: 'Definição natural, soltura e hidratação profunda para cabelos cacheados e crespos' },
  { id: 7, nome: 'Tratamento', preco: '80.00', duracao: 50, descricao: 'Cronograma capilar intensivo com nutrição, hidratação e reconstrução' },
  { id: 8, nome: 'Luzes', preco: '220.00', duracao: 150, descricao: 'Mechas e pontos de luz com técnica personalizada e clareamento seguro' },
  { id: 9, nome: 'Design de Sobrancelhas', preco: '35.00', duracao: 30, descricao: 'Desenho harmônico, alinhamento e valorização do olhar' },
];

const STORAGE_KEY = 'vsn_appointments';
const ALERTS_STORAGE_KEY = 'vsn_admin_alerts';
const SERVICES_STORAGE_KEY = 'vsn_salon_services';
const CROSS_TAB_TRIGGER_KEY = 'vsn_alert_cross_tab_trigger';
const CHANNEL_NAME = 'vsn_appointments_channel';

@Injectable({ providedIn: 'root' })
export class AppointmentStore {
  private readonly _appointments = signal<AppointmentEntry[]>(this.loadFromStorage());
  private readonly _alerts = signal<AdminAlert[]>(this.loadAlertsFromStorage());
  private readonly _services = signal<SalonService[]>(this.loadServicesFromStorage());
  private readonly _activeToast = signal<AdminAlert | null>(null);

  private broadcastChannel?: BroadcastChannel;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.setupCrossTabSync();
  }

  /** Lista reativa de todos os agendamentos */
  readonly all = this._appointments.asReadonly();
  readonly appointments = this._appointments.asReadonly();

  /** Agendamentos do dia atual */
  readonly today = computed(() => {
    const today = this.todayDate();
    return this._appointments().filter((a) => a.data === today);
  });

  /** Lista reativa de todos os alertas do admin */
  readonly alerts = this._alerts.asReadonly();

  /** Lista reativa de serviços com valores e durações atualizados */
  readonly services = this._services.asReadonly();

  /** Quantidade de alertas não lidos */
  readonly unreadAlertsCount = computed(() => {
    return this._alerts().filter((a) => !a.lido).length;
  });

  /** Alerta atualmente exibido no Toast (pop-up) */
  readonly activeToast = this._activeToast.asReadonly();

  /** Atualiza o valor e a duração de um serviço específico */
  updateService(id: number, preco: string | number, duracao: number): void {
    const formattedPrice = Number(preco).toFixed(2);
    const numDuration = Math.max(5, Number(duracao) || 30);

    this._services.update((prev) =>
      prev.map((s) => (s.id === id ? { ...s, preco: formattedPrice, duracao: numDuration } : s))
    );
    this.saveServicesToStorage();
    this.broadcastServicesUpdate();
  }

  /** Atualiza múltiplos serviços de uma só vez */
  updateAllServices(updated: SalonService[]): void {
    const sanitized = updated.map((s) => ({
      ...s,
      preco: Number(s.preco).toFixed(2),
      duracao: Math.max(5, Number(s.duracao) || 30),
    }));
    this._services.set(sanitized);
    this.saveServicesToStorage();
    this.broadcastServicesUpdate();
  }

  /** Restaura todos os serviços para os valores e tempos padrão originais */
  resetServices(): void {
    this._services.set([...DEFAULT_SALON_SERVICES]);
    this.saveServicesToStorage();
    this.broadcastServicesUpdate();
  }

  /** Adiciona um novo serviço personalizado à lista */
  addNewService(service: Omit<SalonService, 'id'>): SalonService {
    const newId = Math.max(...this._services().map((s) => s.id), 0) + 1;
    const newService: SalonService = {
      id: newId,
      nome: service.nome.trim() || 'Novo Serviço',
      preco: Number(service.preco).toFixed(2),
      duracao: Math.max(5, Number(service.duracao) || 30),
      descricao: service.descricao?.trim() || '',
    };
    this._services.update((prev) => [...prev, newService]);
    this.saveServicesToStorage();
    this.broadcastServicesUpdate();
    return newService;
  }

  /** Remove um serviço da lista pelo id */
  removeService(id: number): void {
    this._services.update((prev) => prev.filter((s) => s.id !== id));
    this.saveServicesToStorage();
    this.broadcastServicesUpdate();
  }

  /** Adiciona um agendamento, persiste e dispara alerta para o Admin */
  add(entry: Omit<AppointmentEntry, 'id'>, origem: 'cliente' | 'admin' = 'cliente'): AppointmentEntry {
    const newEntry: AppointmentEntry = { ...entry, id: Date.now() };
    this._appointments.update((prev) => [...prev, newEntry]);
    this.saveToStorage();

    // Cria o alerta do Admin
    const formattedDate = this.formatDateBR(newEntry.data);
    const titulo = origem === 'cliente' ? 'Novo Agendamento de Cliente!' : 'Novo Agendamento Realizado';
    const obsText = newEntry.observacoes ? ` • Obs: "${newEntry.observacoes}"` : '';
    const mensagem = `${newEntry.nome} agendou ${newEntry.servico} para ${formattedDate} às ${newEntry.horario}.${obsText}`;

    const alert: AdminAlert = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tipo: 'novo_agendamento',
      titulo,
      mensagem,
      clienteNome: newEntry.nome,
      servico: newEntry.servico,
      data: formattedDate,
      horario: newEntry.horario,
      valor: newEntry.valor,
      criadoEm: new Date().toISOString(),
      lido: false,
      observacoes: newEntry.observacoes,
    };

    this.pushAlert(alert, true);

    return newEntry;
  }

  /** Remove um agendamento pelo id e persiste */
  remove(id: number): void {
    const target = this._appointments().find((a) => a.id === id);
    this._appointments.update((prev) => prev.filter((a) => a.id !== id));
    this.saveToStorage();

    if (target) {
      const alert: AdminAlert = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        tipo: 'cancelamento',
        titulo: 'Agendamento Cancelado',
        mensagem: `O agendamento de ${target.nome} (${target.servico} às ${target.horario}) foi cancelado.`,
        clienteNome: target.nome,
        servico: target.servico,
        data: this.formatDateBR(target.data),
        horario: target.horario,
        criadoEm: new Date().toISOString(),
        lido: false,
      };
      this.pushAlert(alert, true);
    }
  }

  /** Adiciona alerta à lista, toca som e exibe Toast */
  pushAlert(alert: AdminAlert, broadcast = true): void {
    this._alerts.update((prev) => [alert, ...prev]);
    this.saveAlertsToStorage();
    this.showToast(alert);
    this.playChime();

    if (broadcast) {
      this.broadcastAlert(alert);
    }
  }

  /** Exibe o toast com auto-dismiss após 8 segundos */
  showToast(alert: AdminAlert): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this._activeToast.set(alert);
    this.toastTimer = setTimeout(() => {
      this.dismissToast();
    }, 8000);
  }

  /** Fecha o toast atual */
  dismissToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = undefined;
    }
    this._activeToast.set(null);
  }

  /** Marca um alerta específico como lido */
  markAlertAsRead(id: string): void {
    this._alerts.update((prev) =>
      prev.map((a) => (a.id === id ? { ...a, lido: true } : a))
    );
    this.saveAlertsToStorage();
  }

  /** Marca todos os alertas como lidos */
  markAllAlertsAsRead(): void {
    this._alerts.update((prev) => prev.map((a) => ({ ...a, lido: true })));
    this.saveAlertsToStorage();
  }

  /** Limpa todos os alertas */
  clearAllAlerts(): void {
    this._alerts.set([]);
    this.saveAlertsToStorage();
    this.dismissToast();
  }

  /** Retorna a data de hoje no formato YYYY-MM-DD */
  todayDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Converte YYYY-MM-DD em DD/MM/AAAA */
  formatDateBR(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  /** Toca um som suave de sino/chime usando a Web Audio API nativa */
  private playChime(): void {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      // Nota 1: Sol 5 (784 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(784, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.2, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Nota 2: Si 5 (987.77 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.12);
      gain2.gain.setValueAtTime(0, now + 0.12);
      gain2.gain.linearRampToValueAtTime(0.25, now + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.55);
    } catch {
      // Ignora silenciosamente se o navegador bloquear autoplay
    }
  }

  /** Comunicação entre abas em tempo real via BroadcastChannel e localStorage */
  private setupCrossTabSync(): void {
    if (typeof window === 'undefined') return;

    // 1. BroadcastChannel (moderno e veloz)
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'NEW_ALERT' && event.data.alert) {
            this.handleIncomingCrossTabAlert(event.data.alert);
          } else if (event.data?.type === 'SERVICES_UPDATED') {
            this._services.set(this.loadServicesFromStorage());
          }
        };
      }
    } catch {
      // BroadcastChannel não suportado
    }

    // 2. Storage event (fallback universal entre abas)
    window.addEventListener('storage', (event) => {
      if (event.key === CROSS_TAB_TRIGGER_KEY && event.newValue) {
        try {
          const payload = JSON.parse(event.newValue);
          if (payload?.alert) {
            this.handleIncomingCrossTabAlert(payload.alert);
          }
        } catch {
          // Erro de parse
        }
      } else if (event.key === STORAGE_KEY) {
        this._appointments.set(this.loadFromStorage());
      } else if (event.key === ALERTS_STORAGE_KEY) {
        this._alerts.set(this.loadAlertsFromStorage());
      } else if (event.key === SERVICES_STORAGE_KEY) {
        this._services.set(this.loadServicesFromStorage());
      }
    });
  }

  private broadcastServicesUpdate(): void {
    try {
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: 'SERVICES_UPDATED' });
      }
    } catch {
      // BroadcastChannel indisponível
    }
  }

  private broadcastAlert(alert: AdminAlert): void {
    try {
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: 'NEW_ALERT', alert });
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CROSS_TAB_TRIGGER_KEY, JSON.stringify({ alert, timestamp: Date.now() }));
      }
    } catch {
      // Falha ao transmitir
    }
  }

  private handleIncomingCrossTabAlert(alert: AdminAlert): void {
    // Recarrega lista do storage
    this._appointments.set(this.loadFromStorage());
    this._alerts.set(this.loadAlertsFromStorage());

    // Se o alerta ainda não estiver presente na lista local, insere
    if (!this._alerts().some((a) => a.id === alert.id)) {
      this._alerts.update((prev) => [alert, ...prev]);
    }

    this.showToast(alert);
    this.playChime();
  }

  private loadFromStorage(): AppointmentEntry[] {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      return raw ? (JSON.parse(raw) as AppointmentEntry[]) : this.seedData();
    } catch {
      return this.seedData();
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._appointments()));
      }
    } catch {
      // localStorage indisponível
    }
  }

  private loadServicesFromStorage(): SalonService[] {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SERVICES_STORAGE_KEY) : null;
      return raw ? (JSON.parse(raw) as SalonService[]) : [...DEFAULT_SALON_SERVICES];
    } catch {
      return [...DEFAULT_SALON_SERVICES];
    }
  }

  private saveServicesToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(this._services()));
      }
    } catch {
      // localStorage indisponível
    }
  }

  private loadAlertsFromStorage(): AdminAlert[] {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ALERTS_STORAGE_KEY) : null;
      return raw ? (JSON.parse(raw) as AdminAlert[]) : this.seedAlerts();
    } catch {
      return this.seedAlerts();
    }
  }

  private saveAlertsToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(this._alerts()));
      }
    } catch {
      // localStorage indisponível
    }
  }

  private seedAlerts(): AdminAlert[] {
    return [
      {
        id: 'seed-1',
        tipo: 'novo_agendamento',
        titulo: 'Novo Agendamento!',
        mensagem: 'Larissa Martins agendou Corte + Coloração para hoje às 17:30.',
        clienteNome: 'Larissa Martins',
        servico: 'Corte + Coloração',
        data: 'Hoje',
        horario: '17:30',
        valor: 260,
        criadoEm: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        lido: false,
      },
      {
        id: 'seed-2',
        tipo: 'novo_agendamento',
        titulo: 'Novo Agendamento!',
        mensagem: 'Juliana Santos agendou Hidratação para hoje às 16:00.',
        clienteNome: 'Juliana Santos',
        servico: 'Hidratação',
        data: 'Hoje',
        horario: '16:00',
        valor: 90,
        criadoEm: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        lido: true,
      },
    ];
  }

  /** Dados de exemplo iniciais (usados apenas na primeira vez) */
  private seedData(): AppointmentEntry[] {
    const today = this.todayDate();
    return [
      { id: 1, nome: 'Ana Souza', horario: '09:00', servico: 'Escova + Hidratação', valor: 125, data: today },
      { id: 2, nome: 'Beatriz Lima', horario: '10:30', servico: 'Corte Feminino', valor: 80, data: today },
      { id: 3, nome: 'Carla Oliveira', horario: '12:00', servico: 'Coloração', valor: 220, data: today },
      { id: 4, nome: 'Fernanda Costa', horario: '14:30', servico: 'Escova', valor: 60, data: today },
      { id: 5, nome: 'Juliana Santos', horario: '16:00', servico: 'Hidratação', valor: 90, data: today },
      { id: 6, nome: 'Larissa Martins', horario: '17:30', servico: 'Corte + Coloração', valor: 260, data: today },
    ];
  }
}


