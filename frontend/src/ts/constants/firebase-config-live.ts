// Stub for production builds.
// Vite aliases firebase-config -> firebase-config-live in prod (vite.config.ts).
// In applicant mode Firebase init is skipped, so empty values never reach Firebase.
// In non-applicant mode firebase.ts has try/catch around init that gracefully handles invalid config.

export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};
