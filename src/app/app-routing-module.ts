import { NgModule } from '@angular/core';
import { RouterModule, Routes, TitleStrategy } from '@angular/router';

import { AuthGuard } from './core/guards/auth.guard';
import { PublicOnlyGuard } from './core/guards/public-only.guard';
import { PermissaoGuard } from './core/guards/permissao.guard';
import { TituloPaginaStrategy } from './core/services/titulo-pagina.strategy';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';

const rotas: Routes = [
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.module').then((m) => m.AuthModule),
    canActivate: [PublicOnlyGuard],
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.module').then((m) => m.DashboardModule),
      },
      {
        // Leitura de veículos liberada aos 3 papéis; o PermissaoGuard fica dentro do módulo.
        path: 'fleet',
        loadChildren: () => import('./features/fleet/fleet.module').then((m) => m.FleetModule),
      },
      {
        path: 'account',
        loadChildren: () => import('./features/account/account.module').then((m) => m.AccountModule),
      },
      {
        path: 'trips',
        loadChildren: () => import('./features/trips/trips.module').then((m) => m.TripsModule),
      },
      {
        path: 'refuelings',
        loadChildren: () =>
          import('./features/refuelings/refuelings.module').then((m) => m.RefuelingsModule),
      },
      {
        path: 'maintenance',
        loadChildren: () =>
          import('./features/maintenance/maintenance.module').then((m) => m.MaintenanceModule),
        canActivate: [PermissaoGuard],
        data: { algumaPermissao: ['MAINTENANCE_VIEW_ALL'] },
      },
      {
        path: 'incidents',
        loadChildren: () =>
          import('./features/incidents/incidents.module').then((m) => m.IncidentsModule),
      },
      {
        path: 'analytics',
        loadChildren: () =>
          import('./features/analytics/analytics.module').then((m) => m.AnalyticsModule),
        canActivate: [PermissaoGuard],
        data: { algumaPermissao: ['ANALYTICS_VIEW'] },
      },
      {
        // Entra quem gerencia usuários; cada sub-rota repete o guard com a permission exata.
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.module').then((m) => m.AdminModule),
        canActivate: [PermissaoGuard],
        data: { algumaPermissao: ['USER_VIEW', 'USER_CREATE'] },
      },
    ],
  },
  { path: '**', redirectTo: '/dashboard' },
];

@NgModule({
  imports: [RouterModule.forRoot(rotas)],
  exports: [RouterModule],
  providers: [{ provide: TitleStrategy, useClass: TituloPaginaStrategy }],
})
export class AppRoutingModule {}
