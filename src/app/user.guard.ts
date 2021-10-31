import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, CanLoad, Route, Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Observable, of } from 'rxjs';
import { first, switchMap } from 'rxjs/operators';

@Injectable()
export class UserGuard implements CanActivate, CanLoad {
  constructor(private afa: AngularFireAuth, private router: Router) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    return this.userExist();
  }

  canLoad(route: Route): Observable<boolean> | Promise<boolean> | boolean {
    return this.userExist();
  }

  userExist() {
    return this.afa.authState.pipe(first()).pipe(
      switchMap(authState => {
        if (authState && authState.emailVerified && authState.email.endsWith('docchula.com')) {
          return of(true);
        } else {
          this.router.navigate(['/']);
          return of(false);
        }
      })
    );
  }
}
