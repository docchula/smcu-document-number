import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, CanLoad, Route, Router } from '@angular/router';
import {AngularFireAuth} from '@angular/fire/auth';
import {AngularFireDatabase} from '@angular/fire/database';
import {Observable, of} from 'rxjs';
import {first, map, switchMap} from 'rxjs/operators';

@Injectable()
export class UserGuard implements CanActivate, CanLoad {

  constructor(private afa: AngularFireAuth, private router: Router, private afd: AngularFireDatabase) { }

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean> | Promise<boolean> | boolean {
    return this.userExist();
  }

  canLoad(
    route: Route
  ): Observable<boolean> | Promise<boolean> | boolean {
    return this.userExist();
  }

  userExist() {
    return this.afa.authState.pipe(first()).pipe(switchMap((authState) => {
      if (authState && authState.email.endsWith('docchula.com')) {
        return this.afd.object(`data/users/${authState.uid}/profile`).valueChanges().pipe(first()).pipe(map((data) => {
          if (!data) {
            this.afd.database.ref(`data/users/${authState.uid}/profile`).set({
              displayName: authState.displayName,
              uid: authState.uid,
              email: authState.email
            });
          }
          return true;
        }));
      } else {
        this.router.navigate(['/']);
        return of(false);
      }
    }));
  }
}
