import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Booking } from './booking';

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
});

