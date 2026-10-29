import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Admin } from './admin';
import { AppointmentStore } from '../../core/appointment-store';

describe('Admin Component', () => {
  let component: Admin;
  let fixture: ComponentFixture<Admin>;
  let store: AppointmentStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Admin],
      providers: [provideRouter([]), AppointmentStore],
    }).compileComponents();

    store = TestBed.inject(AppointmentStore);
    fixture = TestBed.createComponent(Admin);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create admin component', () => {
    expect(component).toBeTruthy();
  });

  it('should start on dashboard tab', () => {
    expect(component.activeTab).toBe('dashboard');
  });

  it('should switch between tabs', () => {
    component.setTab('agendamentos');
    expect(component.activeTab).toBe('agendamentos');

    component.setTab('clientes');
    expect(component.activeTab).toBe('clientes');

    component.setTab('dashboard');
    expect(component.activeTab).toBe('dashboard');
  });

  it('should reflect store today appointments', () => {
    const todayCount = store.today().length;
    expect(component.todayAppointments.length).toBe(todayCount);
    expect(component.totalServicos).toBe(todayCount);
    expect(component.faturamentoTotal).toBeGreaterThanOrEqual(0);
  });

  it('should add a new appointment via store', () => {
    const initialCount = component.todayAppointments.length;
    component.newAppointment = {
      nome: 'Camila Ferreira',
      horario: '18:00',
      servico: 'Corte + Escova',
      valor: 150,
    };
    component.saveNewAppointment();

    expect(component.todayAppointments.length).toBe(initialCount + 1);
    expect(component.todayAppointments.some((a) => a.nome === 'Camila Ferreira')).toBe(true);
  });

  it('should cancel/remove an appointment via store', () => {
    const first = component.todayAppointments[0];
    component.removeAppointment(first.id);

    expect(component.todayAppointments.some((a) => a.id === first.id)).toBe(false);
  });

  it('should add a new client to the client list', () => {
    const initialCount = component.clients.length;
    component.clientForm = {
      nome: 'Renata Silva',
      telefone: '(11) 98888-7777',
      email: 'renata@email.com',
      dataNascimento: '15/04/1991',
      preferencia: 'Corte / Coloração',
    };
    component.saveNewClient();

    expect(component.clients.length).toBe(initialCount + 1);
    expect(component.clients[0].nome).toBe('Renata Silva');
  });

  it('should delete a client from the client list', () => {
    const initialCount = component.clients.length;
    const firstClient = component.clients[0];
    component.removeClient(firstClient.id);

    expect(component.clients.length).toBe(initialCount - 1);
    expect(component.clients.some((c) => c.id === firstClient.id)).toBe(false);
  });

  it('should have calendar days configured with current month', () => {
    expect(component.calendarDays.length).toBeGreaterThanOrEqual(35);
    const currentDays = component.calendarDays.filter((d) => d.isCurrentMonth);
    expect(currentDays.length).toBeGreaterThanOrEqual(28); // todo mês tem ao menos 28 dias
  });

  it('should show store appointments as pills in the calendar when switching to agendamentos tab', () => {
    // Adiciona um agendamento para hoje no store
    const today = store.todayDate();
    store.add({ nome: 'Teste Calendário', horario: '11:00', servico: 'Escova', valor: 60, data: today });

    // Troca para a aba de agendamentos (dispara rebuildCalendar)
    component.setTab('agendamentos');

    const todayDay = new Date().getDate();
    const todayCell = component.calendarDays.find((d) => d.isCurrentMonth && d.dayNumber === todayDay);
    expect(todayCell).toBeDefined();
    expect(todayCell?.pills?.some((p) => p.servico === 'Escova')).toBe(true);
  });

  it('should navigate to next month and correctly update calendar grid and title', () => {
    // Define explicitamente para Outubro de 2026 (mês 9)
    component.calendarYear = 2026;
    component.calendarMonth = 9;
    component.rebuildCalendar();
    expect(component.displayedMonth).toBe('Outubro de 2026');

    // Avança para Novembro de 2026 (mês 10)
    component.nextMonth();
    expect(component.calendarMonth).toBe(10);
    expect(component.calendarYear).toBe(2026);
    expect(component.displayedMonth).toBe('Novembro de 2026');

    // Novembro tem exatamente 30 dias
    const novDays = component.calendarDays.filter((d) => d.isCurrentMonth);
    expect(novDays.length).toBe(30);

    // Avança para Dezembro de 2026 (mês 11)
    component.nextMonth();
    expect(component.calendarMonth).toBe(11);
    expect(component.displayedMonth).toBe('Dezembro de 2026');
    const decDays = component.calendarDays.filter((d) => d.isCurrentMonth);
    expect(decDays.length).toBe(31);

    // Avança para Janeiro de 2027 (virada de ano)
    component.nextMonth();
    expect(component.calendarMonth).toBe(0);
    expect(component.calendarYear).toBe(2027);
    expect(component.displayedMonth).toBe('Janeiro de 2027');
  });

  it('should navigate to previous month and return to today', () => {
    component.calendarYear = 2026;
    component.calendarMonth = 10; // Novembro
    component.rebuildCalendar();

    component.prevMonth();
    expect(component.calendarMonth).toBe(9); // Outubro
    expect(component.displayedMonth).toBe('Outubro de 2026');

    component.goToToday();
    const today = new Date();
    expect(component.calendarMonth).toBe(today.getMonth());
    expect(component.calendarYear).toBe(today.getFullYear());
  });

  it('should trigger alert toast and increment unread count when a client books a service', () => {
    const initialUnread = component.unreadAlertsCount();

    // Simula cliente agendando via appointmentStore
    store.add({
      nome: 'Patricia Mendes',
      horario: '15:00',
      servico: 'Luzes',
      valor: 350,
      data: store.todayDate(),
    }, 'cliente');

    expect(component.unreadAlertsCount()).toBe(initialUnread + 1);
    expect(component.activeToast()).not.toBeNull();
    expect(component.activeToast()?.clienteNome).toBe('Patricia Mendes');
    expect(component.activeToast()?.servico).toBe('Luzes');

    // Fechar toast
    component.dismissToast();
    expect(component.activeToast()).toBeNull();
  });

  it('should toggle notifications panel and mark all alerts as read', () => {
    expect(component.showNotificationsPanel).toBe(false);
    component.toggleNotificationsPanel();
    expect(component.showNotificationsPanel).toBe(true);

    component.markAllAlertsAsRead();
    expect(component.unreadAlertsCount()).toBe(0);

    component.closeNotificationsPanel();
    expect(component.showNotificationsPanel).toBe(false);
  });

  it('should switch to servicos tab and load salon services', () => {
    component.setTab('servicos');
    expect(component.activeTab).toBe('servicos');
    expect(component.salonServices().length).toBe(9);
  });

  it('should open services modal, modify service prices and durations, and save', () => {
    component.openServicesModal();
    expect(component.showServicesModal).toBe(true);
    expect(component.editingServices.length).toBe(9);

    // Altera o valor e o tempo do primeiro serviço (Corte)
    component.editingServices[0].preco = '65.00';
    component.editingServices[0].duracao = 50;

    component.saveServicesChanges();

    // Verifica que o store foi atualizado
    const updated = store.services().find((s) => s.id === 1);
    expect(updated?.preco).toBe('65.00');
    expect(updated?.duracao).toBe(50);
  });

  it('should reset services to defaults', () => {
    // Altera primeiro
    store.updateService(1, '99.00', 90);
    expect(store.services().find((s) => s.id === 1)?.preco).toBe('99.00');

    component.resetServicesDefaults();
    expect(store.services().find((s) => s.id === 1)?.preco).toBe('50.00');
    expect(store.services().find((s) => s.id === 1)?.duracao).toBe(45);
  });
});
