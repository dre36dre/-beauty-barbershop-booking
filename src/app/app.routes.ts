import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { Booking } from './features/booking/booking';
import { Admin } from './features/admin/admin';

export const routes: Routes = [
  { path: '', component: Home, title: 'Vanessa Souza | Núcleo da Beleza' },
  { path: 'agendar', component: Booking, title: 'Agendar horário | Vanessa Souza' },
  { path: 'admin', component: Admin, title: 'Painel Administrativo | Vanessa Souza' },
  { path: '**', redirectTo: '' },
];
