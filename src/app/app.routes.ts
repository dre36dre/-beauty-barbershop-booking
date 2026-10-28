import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { Booking } from './features/booking/booking';

export const routes: Routes = [
  { path: '', component: Home, title: 'Vanessa Souza | Núcleo da Beleza' },
  { path: 'agendar', component: Booking, title: 'Agendar horário | Vanessa Souza' },
  { path: '**', redirectTo: '' },
];
