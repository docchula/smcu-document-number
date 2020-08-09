import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFireDatabase } from '@angular/fire/database';
import { AngularFireStorage } from '@angular/fire/storage';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import * as firebase from 'firebase/app';
import 'firebase/database';
import * as PizZip from 'pizzip';
import * as M from 'materialize-css';
import { combineLatest, Observable, of } from 'rxjs';
import { concat, finalize, first, ignoreElements, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { mimeToExtension } from '../../../mime-to-extension';
import { ThaiDatePipe } from '../../thai-date.pipe';
import { UserProfile } from '../../user-profile';

declare var JSZipUtils: any;

@Component({
  selector: 'smcu-new',
  templateUrl: './new.component.html',
  styleUrls: ['./new.component.scss']
})
export class NewComponent implements OnInit, AfterViewInit {
  params$: Observable<[string, string]>;
  year$: Observable<any>;
  category$: Observable<any>;
  divisions$: Observable<{ name: string; value: number }[]>;
  signers$: Observable<{ name: string; title: string; picture_url: string | null }[]>[];
  initializedSignerSelect: boolean;
  numberForm: FormGroup;
  docForm: FormGroup;
  user: UserProfile;
  selectedFile: File = null;
  uploadPercent: Observable<number>;

  @ViewChild('divisionSelect') divisionSelect: ElementRef;
  @ViewChild('signer_1') signer_1: ElementRef;
  @ViewChild('signer_2') signer_2: ElementRef;
  @ViewChild('signer_3') signer_3: ElementRef;
  @ViewChild('gTo') gTo: ElementRef;
  @ViewChild('collapsible') collapsible: ElementRef;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private afd: AngularFireDatabase,
    private afa: AngularFireAuth,
    private storage: AngularFireStorage
  ) {}

  ngOnInit() {
    this.params$ = this.route.paramMap.pipe(
      map(s => {
        return [s.get('year'), s.get('category')];
      }),
      switchMap(([year, category]) => {
        return of([year, category]).pipe(
          concat(
            this.afd
              .object(`data/years/${year}`)
              .valueChanges()
              .pipe(
                tap(yearData => {
                  if (!yearData) {
                    const yearNum = parseInt(year, 10);
                    this.afd.database.ref(`data/years/${year}`).set({
                      christian_year: yearNum,
                      buddhist_year: yearNum + 543
                    });
                  }
                })
              )
              .pipe(ignoreElements())
          )
        ) as Observable<[string, string]>;
      })
    );
    this.year$ = this.params$.pipe(
      switchMap(([year, _]) => {
        return this.afd.object(`data/years/${year}`).valueChanges();
      })
    );
    this.category$ = this.params$.pipe(
      switchMap(([_, category]) => {
        return this.afd.object(`data/categories/${category}`).valueChanges();
      })
    );
    this.divisions$ = this.afd
      .list('data/divisions')
      .valueChanges()
      .pipe(
        map((divisions: any[]) => divisions.filter(division => division.value !== 0)),
        tap(_ => {
          setTimeout(() => {
            M.FormSelect.init(this.divisionSelect.nativeElement);
          }, 0);
        }),
        shareReplay(1)
      );
    this.signers$ = [1, 2, 3].map(num => {
      return this.afd
        .list<{ name: string; title: string; picture_url: string | null }>(`data/signers/level_${num}`)
        .valueChanges()
        .pipe(
          tap(_ => {
            setTimeout(() => {
              const control = num === 1 ? this.signer_1 : num === 2 ? this.signer_2 : this.signer_3;
              M.FormSelect.init(control.nativeElement);
            }, 0);
          }),
          shareReplay(1)
        );
    });
    this.numberForm = new FormGroup({
      name: new FormControl('', Validators.required),
      division: new FormControl(null, Validators.required),
      multipleDoc: new FormControl(false),
      numberOfDoc: new FormControl(1)
    });
    this.docForm = new FormGroup({
      name: new FormControl('', Validators.required),
      // divisionId: new FormControl('', Validators.required),
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
      wantIssue: new FormControl({ value: false, disabled: true })
    });
    this.afa.authState.pipe(first()).subscribe(authState => {
      if (authState) {
        this.afd
          .object<UserProfile>(`data/users/${authState.uid}/profile`)
          .valueChanges()
          .pipe(first())
          .subscribe(data => {
            this.user = data;
            if (data && data.fullName) {
              this.docForm.patchValue({
                contact_name: data.fullName,
                contact_phone: data.phone
              });
            } else if (!data) {
              const newUserProfile = {
                displayName: authState.displayName,
                uid: authState.uid,
                email: authState.email
              };
              this.afd.database.ref(`data/users/${authState.uid}/profile`).set(newUserProfile);
              this.user = newUserProfile;
            }
          });
      }
    });
  }

  ngAfterViewInit() {
    M.Collapsible.init(this.collapsible.nativeElement, {});
    setTimeout(() => {
      M.Autocomplete.init(this.gTo.nativeElement, {
        data: {
          รองคณบดีฝ่ายกิจการนิสิต:
            // tslint:disable-next-line: max-line-length
            'https://firebasestorage.googleapis.com/v0/b/smcu-document-number.appspot.com/o/board-face%2Fpongsak.jpg?alt=media&token=20b6b894-989e-42d0-98d7-d4585bc7ddd2',
          รองคณบดีฝ่ายบริหาร: null,
          'รองผู้อำนวยการโรงพยาบาลจุฬาลงกรณ์ ฝ่ายกายภาพ': null
        }
      });
    }, 0);
  }

  onFileChange(event) {
    this.selectedFile = <File>event.target.files[0];
  }

  submitNumber() {
    const numberOfDoc = this.numberForm.value.numberOfDoc;
    if (!this.numberForm.value.multipleDoc) {
      this.numberForm.patchValue({ numberOfDoc: 1 });
    }
    if (this.numberForm.valid && this.user) {
      if (!this.selectedFile) {
        M.toast({ html: 'กรุณาเลือกไฟล์' });
        return;
      }
      this.numberForm.disable();
      combineLatest([this.year$, this.category$])
        .pipe(first())
        .subscribe(([year, category]) => {
          // Determine file name
          let filePath =
            'document/' +
            year.christian_year +
            '/' +
            Date.now() +
            '-' +
            Math.round(Math.random() * 100) +
            '-' +
            this.user.email.replace('@docchula.com', '');
          if (mimeToExtension.hasOwnProperty(this.selectedFile.type)) {
            filePath += '.' + mimeToExtension[this.selectedFile.type];
          }

          // Upload file
          const task = this.storage.upload(filePath, this.selectedFile);

          // observe percentage changes
          this.uploadPercent = task.percentageChanges();
          // get notified when the download URL is available
          task
            .snapshotChanges()
            .pipe(
              finalize(async () => {
                // this.downloadURL = fileRef.getDownloadURL()

                // Update next available number setting
                // nextNumberRef.set(nextNumber + +numberOfDoc);

                const newNextNumber = await this.afd.database
                  .ref(`data/documents/${year.christian_year}/${category.value}/nextNumber`)
                  .transaction(a => {
                    if (a) {
                      return a + +numberOfDoc;
                    } else {
                      return 2;
                    }
                  });

                const currentNumber = newNextNumber.snapshot.val() - +numberOfDoc;

                // Get division info (plus sign: convert to number)
                const division = this.numberForm.value.division;

                // Create new document
                this.afd
                  .list(`data/documents/${year.christian_year}/${category.value}/documents`)
                  .push({
                    number: currentNumber,
                    name:
                      (numberOfDoc > 1
                        ? `[${numberOfDoc} ฉบับ; ${currentNumber}-${currentNumber + +numberOfDoc - 1}] `
                        : '') + this.numberForm.value.name,
                    user: { profile: this.user },
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    division: division,
                    filePath: filePath
                  })
                  .then(() => {
                    // Created!
                    M.toast({ html: 'บันทึกข้อมูลเรียบร้อย' });
                    this.router.navigate(['..']);
                  });
              })
            )
            .subscribe();
        });
    }
  }

  async submitDoc() {
    // Cannot add associate dean's field if the recipient is himself
    if (this.docForm.value.hasAssocSign && this.docForm.value.to === 'รองคณบดีฝ่ายกิจการนิสิต') {
      this.docForm.patchValue({ hasAssocSign: false });
    }

    if (this.docForm.valid) {
      // Build an array of signers' info
      const signers = [];
      [1, 2, 3].forEach(num => {
        const formValue = this.docForm.value['signer_' + num];
        if (formValue !== 'skip') {
          const formValueExtracted = formValue.split('/');
          signers.push({ name: formValueExtracted[0], title: formValueExtracted[1] });
        }
      });
      JSZipUtils.getBinaryContent('/assets/template.docx', (error, content) => {
        if (error) {
          throw error;
        }
        const zip = new PizZip(content);
        const doc = new Docxtemplater();
        doc.loadZip(zip);
        doc.setOptions({ linebreaks: true });
        doc.setData({
          ...this.docForm.value,
          noAssocSign: !this.docForm.value.hasAssocSign,
          number: '     /',
          date: new ThaiDatePipe().transform(new Date(), 'medium'),
          close: this.docForm.value.insideTo ? 'ด้วยความเคารพอย่างสูง' : 'ขอแสดงความนับถือ',
          signer_1_name: signers[0] ? '(' + signers[0].name + ')' : '',
          signer_1_title: signers[0] ? signers[0].title : '',
          signer_2_name: signers[1] ? '(' + signers[1].name + ')' : '',
          signer_2_title: signers[1] ? signers[1].title : '',
          signer_3_name: signers[2] ? '(' + signers[2].name + ')' : '',
          signer_3_title: signers[2] ? signers[2].title : ''
        });
        try {
          // render the document (replace all occurences of {first_name} by John, {last_name} by Doe, ...)
          doc.render();
        } catch (error) {
          console.log(
            JSON.stringify({
              error: {
                message: error.message,
                name: error.name,
                stack: error.stack,
                properties: error.properties
              }
            })
          );
          throw error;
        }
        const out = doc.getZip().generate({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        saveAs(out, 'output.docx');
      });

      if (
        this.user.fullName !== this.docForm.value.contact_name ||
        this.user.phone !== this.docForm.value.contact_phone
      ) {
        this.afd.database.ref(`data/users/${this.user.uid}/profile`).update({
          fullName: this.docForm.value.contact_name,
          phone: this.docForm.value.contact_phone
        });
      }
    }
  }
}
