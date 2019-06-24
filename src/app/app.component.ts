import { AuthService } from './core/auth.service';
import { Component, OnInit } from '@angular/core';
import * as firebase from 'firebase/app';
import {AngularFireAuth} from '@angular/fire/auth';
import {Observable} from 'rxjs';
import * as M from 'materialize-css';

@Component({
  selector: 'smcu-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {
  user$: Observable<firebase.User>;

  constructor(
    private afa: AngularFireAuth,
    private auth: AuthService
  ) { }

  ngOnInit() {
    this.user$ = this.afa.authState;
  }

  ngAfterViewInit(): void {
    M.Sidenav.init(document.querySelectorAll('.sidenav'), {});
  }

  login() {
    this.auth.login();
  }

  logout() {
    this.auth.logout();
  }
}
