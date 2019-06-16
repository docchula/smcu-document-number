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
import * as M from 'materialize-css';

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
  signers: { name: string, title: string, picture_url: string | null }[][] = [[], [], [], []];
  initializedSignerSelect: boolean;
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
    [1, 2, 3].forEach(num => {
      this.afd.list<{ name: string, title: string, picture_url: string | null }>(`data/signers/level_${num}`)
        .valueChanges().pipe(first())
        .subscribe(data => {
          this.signers[num] = data;
        });
    });
    this.numberForm = new FormGroup({
      name: new FormControl('', Validators.required),
      divisionId: new FormControl(1, Validators.required)
    });
    this.docForm = new FormGroup({
      name: new FormControl('', Validators.required),
      divisionId: new FormControl('', Validators.required),
      to: new FormControl('', Validators.required),
      insideTo: new FormControl(true),
      attachment: new FormControl(''),
      paragraph_1: new FormControl('', Validators.required),
      paragraph_2: new FormControl('', Validators.required),
      paragraph_3: new FormControl('', Validators.required),
      signer_1: new FormControl('', Validators.required),
      signer_2: new FormControl('', Validators.required),
      signer_3: new FormControl('', Validators.required),
      contact_name: new FormControl('', Validators.required),
      contact_phone: new FormControl('', Validators.required),
      hasAssocSign: new FormControl(false),
      wantIssue: new FormControl({value: false, disabled: true})
    });
  }

  ngAfterViewChecked(): void {
    M.Collapsible.init(document.querySelectorAll('.collapsible'), {});
    if (this.signers[1].length && this.signers[2].length && this.signers[3].length && !this.initializedSignerSelect) {
      setTimeout(_ => {
        M.FormSelect.init(document.querySelectorAll('select'), {});
        M.Autocomplete.init(document.getElementById('gTo'), {
          data: {
            'รองคณบดีฝ่ายกิจการนิสิต': 'https://firebasestorage.googleapis.com/v0/b/smcu-document-number.appspot.com/o/board-face%2Fpongsak.jpg?alt=media&token=20b6b894-989e-42d0-98d7-d4585bc7ddd2',
            'รองคณบดีฝ่ายบริหาร': null,
            'รองผู้อำนวยการโรงพยาบาลจุฬาลงกรณ์ ฝ่ายกายภาพ': null
          }
        });
      }, 1000);
      this.initializedSignerSelect = true;
    }
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

  async submitDoc() {
    // Cannot add associate dean's field if the recipient is himself
    if (this.docForm.value.hasAssocSign && this.docForm.value.to === 'รองคณบดีฝ่ายกิจการนิสิต') {
      this.docForm.patchValue({hasAssocSign: false});
    }

    if (this.docForm.valid) {
      // this.docForm.disable();

      // Build an array of signers' info
      const signers = [];
      [1, 2, 3].forEach(num => {
        const formValue = this.docForm.value['signer_' + num];
        if (formValue !== 'skip') {
          const formValueExtracted = formValue.split('/');
          signers.push({name: formValueExtracted[0], title: formValueExtracted[1]});
        }
      });

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

      JSZipUtils.getBinaryContent('/assets/template.docx', (error, content) => {
        if (error) {
          throw error;
        }
        const zip = new JSZip(content);
        const doc = new Docxtemplater();
        doc.loadZip(zip);
        doc.setOptions({linebreaks: true});
        doc.setData({
          ...this.docForm.value,
          noAssocSign: !this.docForm.value.hasAssocSign,
          number: '     /',
          date: (new ThaiDatePipe()).transform(new Date(), 'medium'),
          close: this.docForm.value.insideTo ? 'ด้วยความเคารพอย่างสูง' : 'ขอแสดงความนับถือ',
          signer_1_name: signers[0] ? ('(' + signers[0].name + ')') : '',
          signer_1_title: signers[0] ? signers[0].title : '',
          signer_2_name: signers[1] ? ('(' + signers[1].name + ')') : '',
          signer_2_title: signers[1] ? signers[1].title : '',
          signer_3_name: signers[2] ? ('(' + signers[2].name + ')') : '',
          signer_3_title: signers[2] ? signers[2].title : ''
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
