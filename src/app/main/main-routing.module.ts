import { ListComponent } from './list/list.component';
import { UserGuard } from '../user.guard';
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    canActivate: [UserGuard],
    children: [
      {
        path: '',
        component: ListComponent
      },
      {
        path: ':year',
        component: ListComponent
      },
      {
        path: ':year/:category',
        component: ListComponent
      },
      {
        path: ':year/:category/new',
        loadChildren: () => import('./new/new-component.module').then(mod => mod.NewComponentModule),
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MainRoutingModule { }
