import {environment} from '../../../environments/environment';
import {ActivatedRoute, Router} from '@angular/router';
import {AfterViewChecked, Component, OnInit} from '@angular/core';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {AngularFireDatabase} from '@angular/fire/database';
import {AngularFireAuth} from '@angular/fire/auth';
import {HttpClient} from '@angular/common/http';
import {combineLatest, Observable} from 'rxjs';
import {first, map, switchMap} from 'rxjs/operators';
import * as Docxtemplater from 'docxtemplater';
import {saveAs} from 'file-saver';
import {ThaiDatePipe} from '../../thai-date.pipe';

declare var M: any;
declare var JSZip: any;
declare var JSZipUtils: any;

@Component({
  selector: 'smcu-new',
  templateUrl: './new.component.html',
  styleUrls: ['./new.component.scss']
})
export class NewComponent implements OnInit, AfterViewChecked {
  params$: Observable<any>;
  year$: Observable<any>;
  category$: Observable<any>;
  divisions$: Observable<{ name: string, value: number }[]>;
  numberForm: FormGroup;
  docForm: FormGroup;

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
    this.divisions$ = this.afd.list('data/divisions').valueChanges()
      .pipe(map((divisions: any[]) => divisions.filter((division) => division.value !== 0)));
    this.numberForm = new FormGroup({
      name: new FormControl('', Validators.required),
      divisionId: new FormControl(1, Validators.required)
    });
    this.docForm = new FormGroup({
      name: new FormControl('', Validators.required),
      divisionId: new FormControl(1, Validators.required),
      to: new FormControl('', Validators.required),
      insideTo: new FormControl(),
      attachment: new FormControl(''),
      paragraph_1: new FormControl('', Validators.required),
      paragraph_2: new FormControl('', Validators.required),
      paragraph_3: new FormControl('', Validators.required),
      signer_1: new FormControl(''),
      signer_2: new FormControl(''),
      signer_3: new FormControl(''),
      hasAssocSign: new FormControl('')
    });
  }

  ngAfterViewChecked(): void {
    M.Collapsible.init(document.querySelectorAll('.collapsible'), {});
  }

  submitNumber() {
    if (this.numberForm.valid) {
      this.numberForm.disable();
      combineLatest([this.year$, this.category$]).pipe(first()).subscribe(([year, category]) => {
        this.afa.authState.pipe(first()).subscribe((user) => {
          this.http.post(`${environment.baseUrl}/submit`, {
            name: this.numberForm.value.name,
            divisionId: this.numberForm.value.divisionId,
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

  submitDoc() {
    if (this.docForm.valid) {
      this.docForm.disable();
      /*combineLatest([this.year$, this.category$]).pipe(first()).subscribe(([year, category]) => {
        this.afa.authState.pipe(first()).subscribe((user) => {
          this.http.post(`${environment.baseUrl}/submit`, {
            name: this.docForm.value.name,
            divisionId: this.docForm.value.divisionId,
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
      });*/
      JSZipUtils.getBinaryContent('/assets/template-in.docx', (error, content) => {
        if (error) {
          throw error;
        }
        ;
        const zip = new JSZip(content);
        const doc = new Docxtemplater();
        doc.loadZip(zip);
        doc.setOptions({linebreaks: true});
        doc.setData({
          ...this.docForm.value,
          date: (new ThaiDatePipe()).transform(new Date(), 'medium'),
          close: (this.docForm.value.insideTo === 'in') ? 'ด้วยความเคารพอย่างสูง' : 'ขอแสดงความนับถือ',
          signer_3_name: '(นายณัฐภัทร อนุดวง)',
          signer_3_title: 'นายกสโมสรนิสิต\nคณะแพทยศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย'
        });
        try {
          // render the document (replace all occurences of {first_name} by John, {last_name} by Doe, ...)
          doc.render();
        } catch (error) {
          console.log(JSON.stringify({
            error: {
              message: error.message,
              name: error.name,
              stack: error.stack,
              properties: error.properties
            }
          }));
          throw error;
        }
        const out = doc.getZip().generate({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        saveAs(out, 'output.docx');
      });
    }
  }

}
