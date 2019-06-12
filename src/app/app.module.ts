import { CoreModule } from './core/core.module';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { UserGuard } from './user.guard';
import { NoUserGuard } from './no-user.guard';
import { HomeComponent } from './home/home.component';
import { ThaiDatePipe } from './thai-date.pipe';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    ThaiDatePipe
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    CoreModule,
  ],
  providers: [UserGuard, NoUserGuard],
  bootstrap: [AppComponent]
})
export class AppModule { }
