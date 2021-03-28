import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MainRoutingModule } from './main-routing.module';
import { ListComponent } from './list/list.component';
import { ReactiveFormsModule } from '@angular/forms';
import { TimePipe } from './time.pipe';
import { NgDompurifyModule } from '@tinkoff/ng-dompurify';

@NgModule({
  imports: [CommonModule, MainRoutingModule, NgDompurifyModule, ReactiveFormsModule],
  declarations: [ListComponent, TimePipe]
})
export class MainModule {}
