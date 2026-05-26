import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAbKpCvqTa6HH22Je5jw7V7pp3axj_vduA",
  authDomain: "kidtube-8c506.firebaseapp.com",
  projectId: "kidtube-8c506",
  storageBucket: "kidtube-8c506.firebasestorage.app",
  messagingSenderId: "145813269815",
  appId: "1:145813269815:web:fe6e220c0448c381263eb2",
  measurementId: "G-G9R4N4374Q"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
