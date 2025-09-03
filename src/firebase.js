// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore"; // ✅ Firestore import

// Your web app's Firebase configuration
// ⚠️ Replace with your own Firebase project values
const firebaseConfig = {
  apiKey: "AIzaSyCUWXc9OpgHtTfsYkYR-UUgUwPa0Kx0z6M",
  authDomain: "space-in-finite.firebaseapp.com",
  projectId: "space-in-finite",
  storageBucket: "space-in-finite.firebasestorage.app",
  messagingSenderId: "1019545268111",
  appId: "1:1019545268111:web:eb032a1138f62f3ca8a5fa",
  measurementId: "G-5FRV3HHLZW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// ✅ Firestore instance
export const db = getFirestore(app);
