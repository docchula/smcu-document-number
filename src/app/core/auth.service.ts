import { Injectable } from '@angular/core';
import * as firebase from 'firebase/app';
import { Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/auth';

@Injectable()
export class AuthService {
  constructor(private afa: AngularFireAuth, private router: Router) {}

  login() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({
      hd: 'docchula.com',
      prompt: 'select_account'
    });
    this.afa.auth.signInWithRedirect(provider);
  }

  logout() {
    this.afa.auth.signOut().then(() => {
      this.router.navigate(['/']);
    });
  }
}
