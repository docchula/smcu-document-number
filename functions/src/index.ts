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

export const notifyDocStatusChange = functions.database.ref('data/documents/{year}/{category}/documents/{key}')
  .onUpdate((change, context) => {
    const newValue: DocumentInfo = change.after.val();
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
