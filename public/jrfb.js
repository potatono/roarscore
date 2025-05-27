// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { getFirestore, doc, collection, setDoc, addDoc, getDocs, deleteDoc, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-storage.js";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {
  apiKey: "AIzaSyDNLSneWSThYPb-jyjgM174iH_1g3a-kFU",
  authDomain: "roarscore-1ddf5.firebaseapp.com",
  projectId: "roarscore-1ddf5",
  storageBucket: "roarscore-1ddf5.firebasestorage.app",
  messagingSenderId: "680382994994",
  appId: "1:680382994994:web:9ed378373adc13b4563a2b",
  measurementId: "G-6VW7WCK4FW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export const firebase = {
  app: app,
  analytics: analytics,
  auth: {
    instance: auth,
    signInWithEmailAndPassword: signInWithEmailAndPassword,
    sendPasswordResetEmail: sendPasswordResetEmail
  },
  db: {
    instance: db,
    doc: doc,
    collection: collection,
    setDoc: setDoc,
    addDoc: addDoc,
    getDocs: getDocs,
    deleteDoc: deleteDoc,
    query: query,
    where: where,
    orderBy: orderBy,
    onSnapshot: onSnapshot
  },
  storage: {
    instance: storage,
    ref: ref,
    uploadBytesResumable: uploadBytesResumable,
    getDownloadURL: getDownloadURL
  }
};

console.log(firebase);
