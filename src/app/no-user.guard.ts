import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, CanLoad, Route, Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { first, map } from 'rxjs/operators';

@Injectable()
export class NoUserGuard implements CanActivate, CanLoad {
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
      map(authState => {
        if (!authState) {
          return true;
        } else {
          this.router.navigate(['/', 'main', new Date().getFullYear(), 'normal']);
          return false;
        }
      })
    );
  }
}
