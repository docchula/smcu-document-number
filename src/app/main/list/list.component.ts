import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireDatabase, SnapshotAction } from '@angular/fire/compat/database';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as M from 'materialize-css';
import { EMPTY, interval, Observable, of } from 'rxjs';
import {
  concat,
  filter,
  finalize,
  first,
  ignoreElements,
  map,
  shareReplay,
  switchMap,
  tap,
  throttle
} from 'rxjs/operators';
import { UserProfile } from '../../user-profile';

@Component({
  selector: 'smcu-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss']
})
export class ListComponent implements OnInit, AfterViewInit {
  @ViewChild('floatBtn') floatBtn: ElementRef;
  @ViewChild('modalStatus') modalStatus: ElementRef;
  @ViewChild('modalBatchStatus') modalBatchStatus: ElementRef;

  params$: Observable<[string, string]>;
  documents$: Observable<any[]>;
  year$: Observable<any>;
  category$: Observable<any>;
  announcement$: Observable<string>;
  focusedDoc: any;
  modalStatusControl: any;
  statusForm: FormGroup;
  modalBatchStatusControl: any;
  batchStatusForm: FormGroup;
  selectedFile: File = null;
  uploadPercent: Observable<number>;
  user$: Observable<UserProfile>;
  selectedDocs: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private afd: AngularFireDatabase,
    private storage: AngularFireStorage,
    private afa: AngularFireAuth,
    formBuilder: FormBuilder
  ) {
    this.statusForm = formBuilder.group({
      status: ['']
    });
    this.batchStatusForm = formBuilder.group({
      status: new FormControl('', Validators.required)
    });
  }

  ngOnInit() {
    this.params$ = this.route.paramMap.pipe(
      map(s => {
        return [s.get('year'), s.get('category')];
      }),
      switchMap(([year, category]) => {
        if (year && category) {
          return of([year, category] as [string, string]);
        } else {
          if (!year) {
            this.router.navigate([new Date().getFullYear()], { relativeTo: this.route });
            return EMPTY;
          } else {
            return this.afd
              .object('/config/allowNormal')
              .valueChanges()
              .pipe(
                switchMap(allowNormal => {
                  if (allowNormal) {
                    this.router.navigate(['normal'], { relativeTo: this.route });
                  } else {
                    this.router.navigate(['special'], { relativeTo: this.route });
                  }
                  return EMPTY;
                })
              );
          }
        }
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
    this.documents$ = this.params$.pipe(
      switchMap(params => {
        // Get documents, along with its unique key and year, limited to 1 update per 2 seconds
        // sorted by timestamp in descending order
        return this.afd
          .list(`data/documents/${params[0]}/${params[1]}/documents`, ref => ref.orderByChild('number'))
          .snapshotChanges()
          .pipe(
            throttle(val => interval(2000)),
            map((list: SnapshotAction<any>[]) => {
              // TODO: why throttle?
              return list
                .map(doc => {
                  return { $key: doc.key, ...doc.payload.val(), $year: params[0], $category: params[1] };
                })
                .sort((a, b) => b.number - a.number);
            })
          );
      })
    );
    this.year$ = this.params$.pipe(
      switchMap(params => {
        return this.afd.object(`data/years/${params[0]}`).valueChanges();
      })
    );
    this.category$ = this.params$.pipe(
      switchMap(params => {
        return this.afd.object(`data/categories/${params[1]}`).valueChanges();
      })
    );
    this.announcement$ = this.afd.object<string>('data/announcement').valueChanges();
    this.user$ = this.afa.authState.pipe(
      filter(v => !!v),
      switchMap(authState => {
        return this.afd.object<UserProfile>(`data/users/${authState.uid}/profile`).valueChanges();
      }),
      shareReplay({ refCount: true })
    );
  }

  ngAfterViewInit(): void {
    M.FloatingActionButton.init(this.floatBtn.nativeElement, {});
    this.modalStatusControl = new M.Modal(this.modalStatus.nativeElement, {});
    this.modalBatchStatusControl = new M.Modal(this.modalBatchStatus.nativeElement, {});
  }

  downloadAttachment(path) {
    this.storage
      .ref(path)
      .getDownloadURL()
      .pipe(
        first(),
        tap(url => {
          window.location.href = url;
        })
      )
      .subscribe();
  }

  openStatusModal(doc) {
    this.focusedDoc = doc;
    this.modalStatusControl.open();
  }

  onFileChange(event) {
    this.selectedFile = <File>event.target.files[0];
  }

  saveStatus() {
    if (this.statusForm.valid && this.focusedDoc) {
      if (this.statusForm.value.status) {
        this.afd.database
          .ref(`data/documents/${this.focusedDoc.$year}/${this.focusedDoc.$category}/documents/${this.focusedDoc.$key}`)
          .update({
            status: this.statusForm.value.status
          })
          .then(() => {
            M.toast({ html: 'แก้ไขสถานะหนังสือที่ ' + this.focusedDoc.number + '/' + this.focusedDoc.$year + ' แล้ว' });
          });
      }
      if (this.selectedFile) {
        // Upload file
        const filePath =
          this.focusedDoc.filePath ||
          'document/' + this.focusedDoc.$year + '/' + Date.now() + '-' + Math.round(Math.random() * 100);
        const task = this.storage.upload(filePath, this.selectedFile);

        // observe percentage changes
        this.uploadPercent = task.percentageChanges();
        // get notified when the download URL is available
        task
          .snapshotChanges()
          .pipe(
            finalize(() => {
              if (!this.focusedDoc.filePath) {
                this.afd.database
                  .ref(
                    `data/documents/${this.focusedDoc.$year}/${this.focusedDoc.$category}/documents/${this.focusedDoc.$key}`
                  )
                  .update({
                    filePath: filePath
                  })
                  .then(() => {
                    M.toast({
                      html: 'อัพโหลดหนังสือที่ ' + this.focusedDoc.number + '/' + this.focusedDoc.$year + ' แล้ว'
                    });
                  });
              } else {
                M.toast({
                  html: 'แก้ไขไฟล์หนังสือที่ ' + this.focusedDoc.number + '/' + this.focusedDoc.$year + ' แล้ว'
                });
              }
            })
          )
          .subscribe();
      }

      this.modalStatusControl.close();
    }
  }

  onTick(event, document) {
    if (event.target.checked) {
      this.selectedDocs.push(document);
    } else {
      this.selectedDocs = this.selectedDocs.filter(doc => doc.$key !== document.$key);
    }
  }

  openBatchStatusModal() {
    this.selectedDocs = this.selectedDocs.sort((a, b) => a.number - b.number);
    this.modalBatchStatusControl.open();
  }

  saveBatchStatus() {
    if (this.batchStatusForm.valid && this.selectedDocs.length > 1) {
      for (const selectedDoc of this.selectedDocs) {
        this.afd.database
          .ref(`data/documents/${selectedDoc.$year}/${selectedDoc.$category}/documents/${selectedDoc.$key}`)
          .update({
            status: this.batchStatusForm.value.status
          })
          .then(() => {
            M.toast({ html: 'แก้ไขสถานะหนังสือที่ ' + selectedDoc.number + '/' + selectedDoc.$year + ' แล้ว' });
          });
      }
      this.modalBatchStatusControl.close();
    }
  }
}
