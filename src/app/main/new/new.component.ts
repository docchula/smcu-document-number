import {ActivatedRoute, Router} from '@angular/router';
import {AfterViewChecked, Component, OnInit} from '@angular/core';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {AngularFireDatabase} from '@angular/fire/database';
import {AngularFireAuth} from '@angular/fire/auth';
import {combineLatest, Observable} from 'rxjs';
import {finalize, first, map, switchMap} from 'rxjs/operators';
import * as Docxtemplater from 'docxtemplater';
import * as JSZip from 'JSZip';
import {saveAs} from 'file-saver';
import {ThaiDatePipe} from '../../thai-date.pipe';
import * as M from 'materialize-css';
import {AngularFireStorage} from '@angular/fire/storage';
import {UserProfile} from '../../user-profile';
import * as firebase from 'firebase/app';
import 'firebase/database';

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
  divisions: { name: string, value: number }[];
  signers: { name: string, title: string, picture_url: string | null }[][] = [[], [], [], []];
  initializedSignerSelect: boolean;
  numberForm: FormGroup;
  docForm: FormGroup;
  user: UserProfile;
  selectedFile: File = null;
  uploadPercent: Observable<number>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private afd: AngularFireDatabase,
    private afa: AngularFireAuth,
    private storage: AngularFireStorage) {
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
      });
    [1, 2, 3].forEach(num => {
      this.afd.list<{ name: string, title: string, picture_url: string | null }>(`data/signers/level_${num}`)
        .valueChanges().pipe(first())
        .subscribe(data => {
          this.signers[num] = data;
        });
    });
    this.numberForm = new FormGroup({
      name: new FormControl('', Validators.required),
      divisionId: new FormControl(1, Validators.required),
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
      wantIssue: new FormControl({value: false, disabled: true})
    });
    this.afa.authState.pipe(first()).subscribe((authState) => {
      if (authState) {
        this.afd.object<UserProfile>(`data/users/${authState.uid}/profile`).valueChanges().pipe(first()).subscribe((data) => {
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

  ngAfterViewChecked(): void {
    M.Collapsible.init(document.querySelectorAll('.collapsible'), {});
    if (this.signers[1].length && this.signers[2].length && this.signers[3].length && !this.initializedSignerSelect) {
      setTimeout(() => {
        M.FormSelect.init(document.querySelectorAll('select'), {});
        M.Autocomplete.init(document.getElementById('gTo'), {
          data: {
            'รองคณบดีฝ่ายกิจการนิสิต': 'https://firebasestorage.googleapis.com/v0/b/smcu-document-number.appspot.com/o/board-face%2Fpongsak.jpg?alt=media&token=20b6b894-989e-42d0-98d7-d4585bc7ddd2',
            'รองคณบดีฝ่ายบริหาร': null,
            'รองผู้อำนวยการโรงพยาบาลจุฬาลงกรณ์ ฝ่ายกายภาพ': null
          }
        });
      }, 1200);
      this.initializedSignerSelect = true;
    }
  }

  onFileChange(event) {
    this.selectedFile = <File>event.target.files[0];
  }

  submitNumber() {
    const numberOfDoc = this.numberForm.value.numberOfDoc;
    if (!this.numberForm.value.multipleDoc) {
      this.numberForm.patchValue({numberOfDoc: 1});
    }
    if (this.numberForm.valid && this.user && this.divisions) {
      if (!this.selectedFile) {
        M.toast({html: 'กรุณาเลือกไฟล์'});
        return;
      }
      this.numberForm.disable();
      combineLatest([this.year$, this.category$]).pipe(first()).subscribe(([year, category]) => {
        // Upload file
        const filePath = 'document/' + year.christian_year + '/' + Date.now() + '-' + Math.round(Math.random() * 100);
        const task = this.storage.upload(filePath, this.selectedFile);

        // observe percentage changes
        this.uploadPercent = task.percentageChanges();
        // get notified when the download URL is available
        task.snapshotChanges().pipe(
          finalize(async () => {
            // this.downloadURL = fileRef.getDownloadURL()

            // Retrieve next available number
            const nextNumberRef = this.afd.object<number>(`data/documents/${year.christian_year}/${category.value}/nextNumber`);
            let nextNumber = await nextNumberRef.valueChanges().pipe(first()).toPromise();
            if (!nextNumber) {
              nextNumber = 1;
            }

            // Update next available number setting
            nextNumberRef.set(nextNumber - -numberOfDoc);

            // Get division info (plus sign: convert to number)
            const division = this.divisions.find(div => +div.value === +this.numberForm.value.divisionId);

            // Create new document
            this.afd.list(`data/documents/${year.christian_year}/${category.value}/documents`).push({
              number: nextNumber,
              name: (numberOfDoc > 1 ? `[${numberOfDoc} ฉบับ; ${nextNumber}-${nextNumber - -numberOfDoc}] ` : '')
                + this.numberForm.value.name,
              user: {profile: this.user},
              timestamp: firebase.database.ServerValue.TIMESTAMP,
              division: division,
              filePath: filePath
            }).then(() => {
              // Created!
              M.toast({html: 'บันทึกข้อมูลเรียบร้อย'});
              this.router.navigate(['..']);
            });
          })).subscribe();
      });
    }
  }

  async submitDoc() {
    // Cannot add associate dean's field if the recipient is himself
    if (this.docForm.value.hasAssocSign && this.docForm.value.to === 'รองคณบดีฝ่ายกิจการนิสิต') {
      this.docForm.patchValue({hasAssocSign: false});
    }

    if (this.docForm.valid) {
      // Build an array of signers' info
      const signers = [];
      [1, 2, 3].forEach(num => {
        const formValue = this.docForm.value['signer_' + num];
        if (formValue !== 'skip') {
          const formValueExtracted = formValue.split('/');
          signers.push({name: formValueExtracted[0], title: formValueExtracted[1]});
        }
      });
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

      if (this.user.fullName !== this.docForm.value.contact_name || this.user.phone !== this.docForm.value.contact_phone) {
        this.afd.database.ref(`data/users/${this.user.uid}/profile`).update({
          fullName: this.docForm.value.contact_name,
          phone: this.docForm.value.contact_phone
        });
      }
    }
  }

}
