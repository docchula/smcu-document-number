import {environment} from '../../../environments/environment';
import {ActivatedRoute, Router} from '@angular/router';
import {Component, OnInit} from '@angular/core';
import {FormGroup, FormControl, Validators} from '@angular/forms';
import {AngularFireDatabase} from '@angular/fire/database';
import {AngularFireAuth} from '@angular/fire/auth';
import {HttpClient} from '@angular/common/http';
import {combineLatest, Observable} from 'rxjs';
import {first, map, switchMap} from 'rxjs/operators';

declare var M: any;

@Component({
  selector: 'smcu-new',
  templateUrl: './new.component.html',
  styleUrls: ['./new.component.scss']
})
export class NewComponent implements OnInit {
  params$: Observable<any>;
  year$: Observable<any>;
  category$: Observable<any>;
  divisions: { name: string, value: number }[];
  form: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private afd: AngularFireDatabase,
    private http: HttpClient,
    private afa: AngularFireAuth) {
  }

  ngOnInit() {
    this.params$ = this.route.params;
    this.params$.pipe(map((params) => params.year)).subscribe((year) => {
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
    this.year$ = this.params$.pipe(switchMap((params) => {
      return this.afd.object(`data/years/${params.year}`).valueChanges();
    }));
    this.category$ = this.params$.pipe(switchMap((params) => {
      return this.afd.object(`data/categories/${params.category}`).valueChanges();
    }));
    this.afd.list('data/divisions').valueChanges()
      .pipe(map((divisions: any[]) => divisions.filter((division) => division.value !== 0)))
      .subscribe(divisions => {
        this.divisions = divisions;
        // @todo Find better way to hook this into DOM rendering
        setTimeout(() => {
          // This needs to be called every time the select box updated.
          M.FormSelect.init(document.querySelectorAll('select'), {});
        }, 300);
      });
    this.form = new FormGroup({
      name: new FormControl('', Validators.required),
      divisionId: new FormControl(1, Validators.required)
    });
  }

  submit() {
    if (this.form.valid) {
      this.form.disable();
      combineLatest([this.year$, this.category$]).pipe(first()).subscribe(([year, category]) => {
        this.afa.authState.pipe(first()).subscribe((user) => {
          this.http.post(`${environment.baseUrl}/submit`, {
            name: this.form.value.name,
            divisionId: this.form.value.divisionId,
            year: year.christian_year,
            category: category.value,
            uid: user.uid
          }).subscribe((res) => {
            console.log(res);
            if (res) {
              this.router.navigate(['..'], {relativeTo: this.route});
            }
          });
        });
      });
    }
  }

}
