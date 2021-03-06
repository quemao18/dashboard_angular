import { Injectable, NgZone } from '@angular/core';
import { User } from "../user/user";
// import { auth } from 'firebase/app';
import * as firebase from 'firebase/app';
import { AngularFireAuth } from "@angular/fire/auth";
import { AngularFirestore } from '@angular/fire/firestore';
import { Router } from "@angular/router";
import { NgxSpinnerService } from "ngx-spinner";
import { NotificationService } from '../notification/notification.service';

declare var $: any;

@Injectable({
  providedIn: 'root'
})

export class AuthService {

  userDataAuth: any; // Save logged in user data
  isAdmin: boolean = false;
  userDB: any ;
  userLogged: any = null;

  constructor(
    public afs: AngularFirestore,   // Inject Firestore service
    public afAuth: AngularFireAuth, // Inject Firebase auth service
    public router: Router,  
    public ngZone: NgZone, // NgZone service to remove outside scope warning
    public notification: NotificationService,
    public spinner: NgxSpinnerService
  ) {    
      // this.checkAuthFirebase();
  }


  // Sign in with email/password
  async signIn(email, password) {
    this.spinner.show();
    return await firebase.auth().signInWithEmailAndPassword(email, password)
      .then((result) => { 
        this.saveUserDB(result.user);
        this.getUserDB(result.user);
        // this.ngZone.run(() => {
        //   this.spinner.hide();
        //   this.router.navigate(['dashboard']);
        //   this.saveUserDB(result.user);
        // }); 

      }).catch((error) => {
        // window.alert(error.message)
        this.spinner.hide();
        this.notification.showNotification('top', 'center', 'danger', 'warning', error.message);
      })
  }

  // Sign up with email/password
  async signUp(email, password) {
    try {
      this.spinner.show();
      const result = await firebase.auth().createUserWithEmailAndPassword(email, password);
      /* Call the SendVerificaitonMail() function when new user sign
      up and returns promise */
      this.spinner.hide();
      this.notification.showNotification('top', 'center', 'success', 'check', 'Register success!');
      this.sendVerificationMail();
      this.saveUserDB(result.user);
    }
    catch (error) {
      // window.alert(error.message);
      this.spinner.hide();
      this.notification.showNotification('top', 'center', 'danger', 'warning', error.message);

    }
  }

  // Send email verfificaiton when new user sign up
  async sendVerificationMail() {
    return await firebase.auth().currentUser.sendEmailVerification()
    .then(() => {
      // this.router.navigate(['verify-email-address']);
      this.notification.showNotification('top', 'center', 'success', 'check', 'Email sent. Check your inbox!');
      this.router.navigate(['login']);
    })
  }

  // Reset Forggot password
  async forgotPassword(passwordResetEmail) {
    this.spinner.show();
    return await firebase.auth().sendPasswordResetEmail(passwordResetEmail)
    .then(() => {
      // window.alert('Password reset email sent, check your inbox.');
      this.spinner.hide();
      this.notification.showNotification('top', 'center', 'success', 'check', 'Password reset email sent, check your inbox.');
      this.router.navigate(['login']);
    }).catch((error) => {
      // window.alert(error)
      this.spinner.hide();
      this.notification.showNotification('top', 'center', 'danger', 'warning', error);
    })
  }

  // Returns true when user is looged in and email is verified
  get isLoggedIn(): boolean {
      // return (user !== null && user.emailVerified !== false && this.user.isAdmin !== false) ? true : false;
    return (this.getUserLoggedIn() === null) ? false : true;
  }

  get isAdmindIn(): boolean { 
      // return (user !== null && user.emailVerified !== false && this.user.isAdmin !== false) ? true : false;
    // console.log(this.getUserLoggedIn());
    return (this.getUserLoggedIn() !== null && this.getUserLoggedIn().isAdmin === false) ? false : true;

  }
  // Sign in with Google
  googleAuth() {
    return this.authLogin(new firebase.auth.GoogleAuthProvider());
  }

  // Sign in with Facebook
  facebookAuth() {
    return this.authLogin(new firebase.auth.FacebookAuthProvider());
  }

  // Auth logic to run auth providers
  async authLogin(provider) {
    // this.spinner.show();
    return await firebase.auth().signInWithPopup(provider)
    .then((result) => {
      // this.spinner.hide();
      this.saveUserDB(result.user);
      this.getUserDB(result.user);

    }).catch((error) => {
      // window.alert(error)
      console.log(error);
      this.spinner.hide();
      this.notification.showNotification('top', 'center', 'danger', 'warning', error.message);
    })
  }

  /* Setting up user data when sign in with username/password, 
  sign up with username/password and sign in with social auth  
  provider in Firestore database using AngularFirestore + AngularFirestoreDocument service */
  async saveUserDB(user: any) {
    // const userRef: AngularFirestoreDocument<any> = this.afs.doc(`users/${user.email}`);
    const userData: User = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
    };

    var docRef = this.afs.collection("users").doc(user.email);
    await docRef.get().toPromise().then(
      (doc) => {
      if (doc.exists) {
          console.log("Update user DB:", doc.data());
          docRef.update(userData);
      } else {
          // doc.data() will be undefined in this case
          console.log("Create user DB not admin!");
          userData.isAdmin = false;
          docRef.set(userData);
      }
    }).catch(
        (err) => {
          console.log(err);
          this.spinner.hide();
          this.signOut();
        }
      );
  }

  async getUserDB(userData: any) {
    this.spinner.show();
    var docRef = this.afs.collection('users').doc(userData.email);
    await docRef.get().take(1).toPromise().then(
      (doc) => {
        this.spinner.hide();
        if(doc.exists){
          console.log('User fund', doc.data());
          this.setUserLoggedIn(doc.data());
          if(doc.data().isAdmin){
            this.ngZone.run(() => {
              this.router.navigate(['dashboard']);
            });
          }else{
            this.notification.showNotification('top', 'center', 'warning', 'warning', 'You are not aministrator user!' );
            this.signOut();
            // this.ngZone.run(() => {
            //   this.router.navigate(['user-profile']);
            // });
          }
        }else{
          console.log("No such document!");
          this.notification.showNotification('top', 'center', 'warning', 'warning', 'You are not allowed to access!' );
          this.signOut();
        }
      }).catch(
      (err) => {
        console.log(err);
        this.spinner.hide();
        this.signOut();
      }
    );
  }

  getUserLoggedIn() {
    return JSON.parse(localStorage.getItem('user'));
    // return this.isUserLoggedIn;
  }

  setUserLoggedIn(data) { 
    // localStorage.removeItem('user');
    localStorage.setItem('user', JSON.stringify(data));
  }

  checkAuthFirebase() {
    console.log('check')
    if(this.getUserLoggedIn())
    this.getUserDB(this.getUserLoggedIn())
  }

  removeUserLocalStore(){
    localStorage.removeItem('user');
  }
  // Sign out 
  async signOut() {
    this.spinner.show();
    return await firebase.auth().signOut().then(() => {
      this.ngZone.run(() => {
        // setTimeout(() => {
          localStorage.removeItem('user');
          this.spinner.hide();
          this.router.navigate(['login']);
        // }, 500);

      });
    });
  }

}