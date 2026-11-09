import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Booking } from './booking';
import { AppointmentStore } from '../../core/appointment-store';

describe('Booking Component', () => {
  let component: Booking;
  let fixture: ComponentFixture<Booking>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Booking],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Booking);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize with all 9 expected services in Todos os serviços', () => {
    expect(component.services.length).toBe(9);
    const serviceNames = component.services.map((s) => s.nome.toLowerCase());

    expect(serviceNames).toContain('corte');
    expect(serviceNames).toContain('coloração');
    expect(serviceNames).toContain('escova');
    expect(serviceNames).toContain('progressiva');
    expect(serviceNames).toContain('botox / selagem');
    expect(serviceNames).toContain('soltura de cachos');
    expect(serviceNames).toContain('tratamento');
    expect(serviceNames).toContain('luzes');
    expect(serviceNames).toContain('design de sobrancelhas');
  });

  it('should use the shared service catalog returned by the backend', () => {
    const store = TestBed.inject(AppointmentStore);
    const services = store.services().map((service) =>
      service.id === 1 ? { ...service, preco: '65.00', duracao: 50 } : service,
    );
    store.updateAllServices(services);
    component.services = [...store.services()];

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/csrf/').flush({ ok: true });
    http.expectOne('/api/servicos/').flush({
      servicos: services.map((service) =>
        service.id === 1 ? { ...service, preco: '70.00', duracao: 55 } : service,
      ),
    });

    expect(component.services.find((service) => service.id === 1)).toMatchObject({
      preco: '70.00',
      duracao: 55,
    });
    expect(store.services().find((service) => service.id === 1)).toMatchObject({
      preco: '70.00',
      duracao: 55,
    });
  });

  it('should not ask for an email address in the client details form', () => {
    expect(fixture.nativeElement.querySelector('input[name="email"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="nome"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="telefone"]')).not.toBeNull();
  });

  it('should not mark fallback hours as available when the server returns no available hours', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/csrf/').flush({ ok: true });
    http.expectOne('/api/servicos/').flush({ servicos: component.services });

    component.selectedServices = [1];
    component.selectedDate = '2099-12-01';
    component.times = [];

    expect(component.timeOptions.length).toBeGreaterThan(0);
    expect(component.timeOptions.every((option) => !option.available)).toBe(true);
  });

  it('should refresh availability instead of submitting a time not returned by the server', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/csrf/').flush({ ok: true });
    http.expectOne('/api/servicos/').flush({ servicos: component.services });

    component.selectedServices = [1];
    component.selectedDate = '2099-12-01';
    component.selectedTime = '10:00';
    component.times = [];
    component.professionalsByTime = {};
    component.submitBooking();

    expect(component.selectedTime).toBe('');
    expect(component.errorMessage).toContain('disponibilidade atual');
    http.expectNone('/api/clientes/');
    const availabilityRequest = http.expectOne(
      (request) => request.url === '/api/profissionais/' && request.params.get('data') === '2099-12-01',
    );
    availabilityRequest.flush({ profissionais: [] });
  });

  it('should update Seu resumo when selecting a service', () => {
    const firstService = component.services[0]; // Corte
    expect(component.selectedServiceDetails.length).toBe(0);
    expect(component.summary).toBeNull();

    // Simula seleção do serviço
    const event = { target: { checked: true } } as unknown as Event;
    component.toggleService(firstService.id, event);
    fixture.detectChanges();

    expect(component.isSelected(firstService.id)).toBe(true);
    expect(component.selectedServiceDetails.length).toBe(1);
    expect(component.selectedServiceDetails[0].nome).toBe(firstService.nome);
    expect(component.summary?.servicos.length).toBe(1);
    expect(component.summary?.servicos[0].nome).toBe(firstService.nome);

    const compiled = fixture.nativeElement as HTMLElement;
    const summary = compiled.querySelector('.live-summary');
    expect(summary?.textContent).toContain(firstService.nome);
  });

  it('should remove service from summary when unselected or removeService is called', () => {
    const service = component.services[1]; // Coloração
    component.toggleService(service.id, { target: { checked: true } } as unknown as Event);
    expect(component.selectedServiceDetails.length).toBe(1);

    component.removeService(service.id);
    fixture.detectChanges();

    expect(component.isSelected(service.id)).toBe(false);
    expect(component.selectedServiceDetails.length).toBe(0);
    expect(component.summary).toBeNull();
  });

  it('should display the 4 category cards as static elements without click handlers', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const categoryCards = compiled.querySelectorAll('.category-card');
    expect(categoryCards.length).toBe(4);

    // Verify none of them are buttons
    for (const card of Array.from(categoryCards)) {
      expect(card.tagName.toLowerCase()).toBe('div');
      expect(card.getAttribute('role')).not.toBe('button');
    }
  });

  it('should identify past times correctly for today and reject booking past times', () => {
    const today = component.minimumDate;
    component.selectedDate = today;

    // Horário passado garantido (ex: 08:00 antes da abertura ou hora atual - 1)
    const now = new Date();
    const pastHour = Math.max(0, now.getHours() - 1);
    const pastTimeString = `${String(pastHour).padStart(2, '0')}:00`;

    if (now.getHours() > 0) {
      expect(component.isPastTime(today, pastTimeString)).toBe(true);
      component.selectTime(pastTimeString);
      expect(component.selectedTime).toBe('');
      expect(component.errorMessage).toContain('passou');
    }
  });

  it('should block submitBooking when time has already passed', () => {
    component.selectedServices = [1];
    component.selectedDate = component.minimumDate;
    component.selectedTime = '08:00'; // 08:00 já passou em relação ao horário de funcionamento

    component.submitBooking();
    expect(component.errorMessage).toContain('passou');
    expect(component.success).toBeNull();
  });

  it('should save a local request when the booking API is unavailable without claiming server confirmation', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/csrf/').error(new ProgressEvent('error'));

    component.client = {
      nome: 'Cliente local',
      telefone: '11999999999',
      anotacao: '',
      endereco: '',
    };
    component.selectedServices = [1];
    component.selectedDate = '2099-12-01';
    component.selectedTime = '10:00';
    component.times = ['10:00'];
    component.professionalsByTime = { '10:00': [1] };
    component.submitBooking();
    fixture.detectChanges();

    expect(component.success?.status).toBe('local');
    expect(component.success?.id).toBeGreaterThan(0);
    expect(TestBed.inject(AppointmentStore).all().some(
      (appointment) =>
        appointment.nome === 'Cliente local' &&
        appointment.data === '2099-12-01' &&
        appointment.horario === '10:00',
    )).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('ainda não está confirmada pelo salão');
    expect(fixture.nativeElement.textContent).toContain('Enviar solicitação pelo WhatsApp');
  });

  it('should create the admin WhatsApp alert link with confirmed booking details', () => {
    component.client.nome = 'Maria Silva';
    component.client.telefone = '11987654321';
    component.selectedDate = '2099-12-01';
    component.selectedTime = '10:30';
    component.selectedServices = [1];
    component.success = {
      id: 45,
      status: 'agendado',
      valor_total: '50.00',
      duracao_total: 45,
    };

    const whatsappUrl = new URL(component.adminWhatsAppUrl);
    const message = whatsappUrl.searchParams.get('text') ?? '';

    expect(whatsappUrl.origin + whatsappUrl.pathname).toBe('https://api.whatsapp.com/send/');
    expect(whatsappUrl.searchParams.get('phone')).toBe('5511992670080');
    expect(whatsappUrl.searchParams.get('type')).toBe('phone_number');
    expect(whatsappUrl.searchParams.get('app_absent')).toBe('0');
    expect(message).toContain('Protocolo: #45');
    expect(message).toContain('Cliente: Maria Silva');
    expect(message).toContain('Telefone: 11987654321');
    expect(message).toContain('Serviço(s): Corte');
    expect(message).toContain('10:30');
  });

  it('should only confirm and store a booking after the server saves it', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/csrf/').flush({ ok: true });
    http.expectOne('/api/servicos/').flush({ servicos: component.services });

    component.client = {
      nome: 'Cliente de teste',
      telefone: '11999999999',
      anotacao: '',
      endereco: '',
    };
    component.selectedServices = [1];
    component.selectedDate = '2099-12-01';
    component.selectedTime = '10:00';
    component.times = ['10:00'];
    component.professionalsByTime = { '10:00': [1] };
    component.submitBooking();

    expect(component.errorMessage).toBe('');
    expect(component.success).toBeNull();
    expect(component.submitting).toBe(true);
    const clientRequest = http.expectOne('/api/clientes/');
    expect(clientRequest.request.body).not.toHaveProperty('email');
    clientRequest.flush({ id: 21, nome: 'Cliente de teste' });
    http.expectOne('/api/agendamentos/').flush({
      id: 45,
      status: 'agendado',
      valor_total: '50.00',
      duracao_total: 45,
    });

    expect(component.success?.id).toBe(45);
    expect(TestBed.inject(AppointmentStore).all().some((appointment) => appointment.id === 45)).toBe(true);
    expect(component.submitting).toBe(false);
  });

  it('should not create a local appointment when the server rejects it', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/csrf/').flush({ ok: true });
    http.expectOne('/api/servicos/').flush({ servicos: component.services });

    component.client = {
      nome: 'Cliente sem confirmação',
      telefone: '11999999999',
      anotacao: '',
      endereco: '',
    };
    component.selectedServices = [1];
    component.selectedDate = '2099-12-01';
    component.selectedTime = '10:00';
    component.times = ['10:00'];
    component.professionalsByTime = { '10:00': [1] };
    component.submitBooking();

    expect(component.errorMessage).toBe('');
    http.expectOne('/api/clientes/').flush({ id: 22, nome: 'Cliente sem confirmação' });
    http.expectOne('/api/agendamentos/').flush(
      { erro: 'Horário indisponível.' },
      { status: 409, statusText: 'Conflict' },
    );

    expect(component.success).toBeNull();
    expect(component.errorMessage.toLowerCase()).toContain('agendamento não confirmado');
    const availabilityRequest = http.expectOne(
      (request) => request.url === '/api/profissionais/' && request.params.get('data') === '2099-12-01',
    );
    availabilityRequest.flush({ profissionais: [] });
    expect(TestBed.inject(AppointmentStore).all().some((appointment) => appointment.nome === 'Cliente sem confirmação')).toBe(false);
  });
});
