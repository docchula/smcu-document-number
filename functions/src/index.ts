import * as functions from 'firebase-functions';
import * as firebase from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import {DocumentInfo} from './data-type';

firebase.initializeApp(functions.config().firebase);

// Configure the email transport using the default SMTP transport and a GMail account.
// For Gmail, enable these:
// 1. https://www.google.com/settings/security/lesssecureapps
// 2. https://accounts.google.com/DisplayUnlockCaptcha
// For other types of transports such as Sendgrid see https://nodemailer.com/transports/
// TODO: Configure the `gmail.email` and `gmail.password` Google Cloud environment variables.
const gmailAddress = functions.config().gmail.email;
const mailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailAddress,
    pass: functions.config().gmail.password
  }
});
const APP_NAME = 'ระบบสารบรรณ สพจ';

export const submit = functions.https.onRequest((req, res) => {
  if (req.method.toLowerCase() !== 'post') {
    if (req.method.toLowerCase() !== 'options') {
      res.status(405);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(200);
    }
    res.end();
  } else {
    const data = req.body;

    // Validate ID Token
    if (data.idToken) {
      firebase.auth().verifyIdToken(data.idToken)
        .then((decoded) => {
          const name = data.name;
          const divisionId = data.divisionId;
          const year = data.year;
          const category = data.category;
          const uid = decoded.sub;
          const filePath = data.filePath;
          const nextNumberRef = firebase.database().ref(`data/documents/${year}/${category}/nextNumber`);
          let pushContent: DocumentInfo;
          nextNumberRef.once('value')
            .then((_nextNumber) => {
              let nextNumber = _nextNumber.val();
              if (!nextNumber) {
                nextNumber = 1;
              }
              return nextNumber;
            }).then((nextNumber) => {
            return nextNumberRef.set(nextNumber + 1).then(() => nextNumber);
          }).then((nextNumber) => {
            return firebase.database().ref(`data/users/${uid}`).once('value').then((_v) => {
              const v = _v.val();
              return firebase.database().ref(`data/divisions/${divisionId}`).once('value').then((_d) => {
                pushContent = {
                  number: nextNumber,
                  name,
                  user: v,
                  timestamp: firebase.database.ServerValue.TIMESTAMP,
                  division: _d.val(),
                  filePath: filePath
                };
                return firebase.database().ref(`data/documents/${year}/${category}/documents`).push(pushContent);
              });
            });
          }).then(() => {
            res.status(200).send(pushContent);
            res.end();
          }).catch(err => console.error(err));
        })
        .catch((err) => res.status(401).send(err));
    } else {
      res.status(401);
      res.end();
    }
  }
});

export const notifyDocStatusChange = functions.database.ref('data/documents/{year}/{category}/documents/{key}')
  .onUpdate((change, context) => {
    const newValue = change.after.val();
    // Exit when the data is first created or deleted or the document status hasn't been changed.
    if (!change.before.exists() || !change.after.exists() || change.before.val().status === newValue.status) {
      return null;
    }

    // You must return a Promise when performing asynchronous tasks inside a Functions such as
    // writing to the Firebase Realtime Database.
    // Setting an "uppercase" sibling in the Realtime Database returns a Promise.
    return sendDocStatusUpdateEmail(
      newValue.user.profile.email, newValue.user.profile.displayName, newValue.number + ' ' + newValue.name, newValue.status
    );
  });

// Sends a notification email to the given user.
async function sendDocStatusUpdateEmail(email: string, displayName: string, documentName: string, newStatus: string) {
  console.log('Sending document status update notification to:', email);
  return mailTransport.sendMail({
    from: `${APP_NAME} <${gmailAddress}>`,
    to: email,
    subject: `มีการเปลี่ยนแปลงสถานะของหนังสือ ${documentName}!`,
    text: `สวัสดี ${displayName || ''}!\nสถานะของหนังสือ ${documentName} ถูกเปลี่ยนเป็น "${newStatus}"\n\n${APP_NAME}`
  });
}
