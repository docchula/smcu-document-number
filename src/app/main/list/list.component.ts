import {AfterViewChecked, Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {AngularFireDatabase} from '@angular/fire/database';
import {Observable, ReplaySubject} from 'rxjs';
import {first, map, switchMap} from 'rxjs/operators';

declare var M: any;

@Component({
  selector: 'smcu-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss']
})
export class ListComponent implements OnInit, AfterViewChecked {

  params$: ReplaySubject<[string, string]>;
  documents$: Observable<any[]>;
  year$: Observable<any>;
  category$: Observable<any>;

  constructor(private route: ActivatedRoute, private router: Router, private afd: AngularFireDatabase) {
  }

  ngOnInit() {
    this.params$ = new ReplaySubject<[string, string]>();
    this.route.params.subscribe((params) => {
      if (params.year) {
        if (params.category) {
          this.params$.next([params.year, params.category]);
        } else {
          this.afd.object('/config/allowNormal').valueChanges().pipe(first()).subscribe((allowNormal) => {
            if (allowNormal) {
              this.router.navigate(['normal'], {relativeTo: this.route});
            } else {
              this.router.navigate(['special'], {relativeTo: this.route});
            }
          });
        }
      } else {
        this.router.navigate([(new Date()).getFullYear()], {relativeTo: this.route});
      }
    });
    this.params$.pipe(map((params) => params[0])).subscribe((year) => {
      this.afd.object(`data/years/${year}`).valueChanges().pipe(first()).subscribe((yearData) => {
        if (!yearData) {
          const yearNum = parseInt(year, 10);
          this.afd.database.ref(`data/years/${year}`).set({
            christian_year: yearNum,
            buddhist_year: yearNum + 543
          });
        }
      });
    });
    this.documents$ = this.params$.pipe(switchMap((params) => {
      return this.afd.list(`data/documents/${params[0]}/${params[1]}/documents`, ref => ref.orderByChild('number'))
        .valueChanges()
        .pipe(map((list: any[]) => {
          return list.reverse();
        }));
    }));
    this.year$ = this.params$.pipe(switchMap((params) => {
      return this.afd.object(`data/years/${params[0]}`).valueChanges();
    }));
    this.category$ = this.params$.pipe(switchMap((params) => {
      return this.afd.object(`data/categories/${params[1]}`).valueChanges();
    }));
  }

  ngAfterViewChecked(): void {
    M.FloatingActionButton.init(document.querySelectorAll('.fixed-action-btn'), {});
  }
}
