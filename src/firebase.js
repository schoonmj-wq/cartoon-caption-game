import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAaR_ERnMIUjfkatdk4hdbopGPtKXMP884",
  authDomain: "cartoon-caption-game.firebaseapp.com",
  databaseURL: "https://cartoon-caption-game-default-rtdb.firebaseio.com",
  projectId: "cartoon-caption-game",
  storageBucket: "cartoon-caption-game.firebasestorage.app",
  messagingSenderId: "710051626128",
  appId: "1:710051626128:web:4b6b47cde74bf40944ec15"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
