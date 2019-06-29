import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {AngularFireDatabase, SnapshotAction} from '@angular/fire/database';
import {interval, Observable, ReplaySubject} from 'rxjs';
import {finalize, first, map, switchMap, throttle} from 'rxjs/operators';
import {AngularFireStorage} from '@angular/fire/storage';
import {AngularFireAuth} from '@angular/fire/auth';
import * as M from 'materialize-css';
import {FormBuilder, FormGroup} from '@angular/forms';
import {AngularFireAuth} from '@angular/fire/auth';

@Component({
  selector: 'smcu-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss']
})
export class ListComponent implements OnInit, AfterViewInit {

  @ViewChild('floatBtn', {static: false}) floatBtn: ElementRef;
  @ViewChild('modalStatus', {static: false}) modalStatus: ElementRef;

  params$: ReplaySubject<[string, string]>;
  documents$: Observable<any[]>;
  year$: Observable<any>;
  category$: Observable<any>;
  announcement$: Observable<string>;
  focusedDoc: any;
  modalStatusControl: any;
  statusForm: FormGroup;
  selectedFile: File = null;
  uploadPercent: Observable<number>;
  user: {
    displayName: string | null,
    uid: string | null,
    email: string | null,
    fullName: string | null,
    phone: string | null,
    canEditStatus: boolean | null
  } = {
    displayName: null,
    uid: null,
    email: null,
    fullName: null,
    phone: null,
    canEditStatus: false
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private afd: AngularFireDatabase,
    private storage: AngularFireStorage,
    private afa: AngularFireAuth,
    formBuilder: FormBuilder) {
    this.statusForm = formBuilder.group({
      status: ['']
    });
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
      // Get documents, along with its unique key and year, limited to 1 update per 2 seconds
      // sorted by timestamp in descending order
      return this.afd.list(`data/documents/${params[0]}/${params[1]}/documents`, ref => ref.orderByChild('number'))
        .snapshotChanges()
        .pipe(throttle(val => interval(2000)), map((list: SnapshotAction<any>[]) => {
          return list.map(doc => {
            return {$key: doc.key, ...doc.payload.val(), $year: params[0], $category: params[1]};
          }).sort((a, b) => b.number - a.number);
        }));
    }));
    this.year$ = this.params$.pipe(switchMap((params) => {
      return this.afd.object(`data/years/${params[0]}`).valueChanges();
    }));
    this.category$ = this.params$.pipe(switchMap((params) => {
      return this.afd.object(`data/categories/${params[1]}`).valueChanges();
    }));
    this.announcement$ = this.afd.object<string>('data/announcement').valueChanges();
    this.afa.authState.pipe(first()).subscribe((authState) => {
      if (authState) {
        this.afd.object<{
          displayName: string,
          uid: string,
          email: string,
          fullName: string | null,
          phone: string | null,
          canEditStatus: boolean | null
        }>(`data/users/${authState.uid}/profile`).valueChanges().pipe(first()).subscribe((data) => {
          this.user = data;
        });
      }
    });
  }

  ngAfterViewInit(): void {
    M.FloatingActionButton.init(this.floatBtn.nativeElement, {});
    this.modalStatusControl = new M.Modal(this.modalStatus.nativeElement, {});
  }

  downloadAttachment(path) {
    this.storage.ref(path).getDownloadURL().pipe(first()).subscribe(url => {
      window.location.href = url;
    });
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
          }).then(() => {
          M.toast({html: 'แก้ไขสถานะหนังสือที่ ' + this.focusedDoc.number + '/' + this.focusedDoc.$year + ' แล้ว'});
        });
      }
      if (this.selectedFile) {
        // Upload file
        const filePath = this.focusedDoc.filePath
          || ('document/' + this.focusedDoc.$year + '/' + Date.now() + '-' + Math.round(Math.random() * 100));
        const task = this.storage.upload(filePath, this.selectedFile);

        // observe percentage changes
        this.uploadPercent = task.percentageChanges();
        // get notified when the download URL is available
        task.snapshotChanges().pipe(
          finalize(() => {
            if (!this.focusedDoc.filePath) {
              this.afd.database
                .ref(`data/documents/${this.focusedDoc.$year}/${this.focusedDoc.$category}/documents/${this.focusedDoc.$key}`)
                .update({
                  filePath: filePath
                }).then(() => {
                M.toast({html: 'อัพโหลดหนังสือที่ ' + this.focusedDoc.number + '/' + this.focusedDoc.$year + ' แล้ว'});
              });
            } else {
              M.toast({html: 'แก้ไขไฟล์หนังสือที่ ' + this.focusedDoc.number + '/' + this.focusedDoc.$year + ' แล้ว'});
            }
          })).subscribe();
      }

      this.modalStatusControl.close();
    }
  }
}
