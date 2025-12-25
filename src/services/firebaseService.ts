import admin from "firebase-admin";
import { AppError } from "@/utils/AppError";
import { logger } from "@/utils/logger";

/**
 * Firebase Admin Service
 * Handles Firebase authentication verification for social logins (Apple, Google, etc.)
 */
class FirebaseService {
  private app: admin.app.App | null = null;

  constructor() {
    this.initializeFirebase();
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private initializeFirebase(): void {
    try {
      // Check if Firebase is already initialized
      if (admin.apps.length > 0) {
        this.app = admin.app();
        logger.info("Firebase Admin SDK already initialized");
        return;
      }

      // Get Firebase credentials from environment variables
      const firebaseServiceAccount = {
        type: "service_account",
        project_id: "viteezy-mobile",
        private_key_id: "f012461131dd338e5a26e499d3cb6042eb464bca",
        private_key:
          "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDCjUDGM8V137vf\ncFigGUzfkQ9QG4/UFVp4BS5aotVXpACCNP6Mrk4Y/a3hdUwXVXIF/RrYL5jpWYbh\n2SVsbjkJluhbEDvwSpgDXE1pMlaKzlobXYAbk+/i7Ws4mT40CAxYk3Ky0pW7Uctf\nz+UsjCIM4K/fhFxPnot7k6/4WizpMttG0q5DH8VllKWozihIneH6VpfNboA7nTSB\nhoDj85FWRiHdsL3L8nY0ycNoJxslimROAW9mlpUyFQ1qiKgGEbVbAylaIc1ebQ3V\nrkHa+1zLmw/FA7bgecUmp0Iesn96HstyssEoStPs7s/HKTY+dmrA3c6a/WP7Vhpd\nmgOTcX9rAgMBAAECggEATRVncUCI/7OmfhjG3KQ5m6kffpd1DMxrHHu9CodS7Vcb\nJnv10WqsoeU9NEPj4qjltS68KKTvOqHQugJt/ADOE5kZth8ACKydf1Nejow10uiA\nti/9NrAOT4TPQ00gYsA/mAbP3r9mOSJm6K73+AcL5LtPo8mPQ7KnRE7XXZjpC3n7\nkdJUl7svMZpfMGXifsyDS/e0aPohpDMxkl6GrDl4R9gpbr97661kbtzCkf/VG7cr\nZLWPs+z17iaf5tIni1K4eC6QnyyrYdU0K8d3WWDNcAkSfX0brkC4r7Gpo6oKN5nl\nzGA1ZZNgw7/fyJSkmWrr4ju/5Ypy/dVqlFRjEJeQ2QKBgQD5F5IXRZaAO0RJMTLh\nuYrVsdRekFiMmMnszT8+z5BJcUoD2ptpzpL99WZjMK1RvWs+yFiArI6j5jCOiNIe\nh3XoQatkA/P2aEzBWTj23XzQR2DFDcwe8hpspHRGhNLduz+tgh51wYvyus8uT7FY\nuwp+FtFmgFxUKVLJtI0msT/ruQKBgQDH8nkzQK1efqpneNLJdoVV+TQ7O7XEfNsF\nhCL3nj9rUHJqdWC7XPniCl2Hu748WIHm026S6oy+JwyqPxSuPmFmO47D9sHa5mfG\ng6sn0LqL+dL0vGqvciWaXxuojUChHPztGyylS+l7OrROkGHdDKWUvc8pgx/rmd9i\npTmv6aA+QwKBgQCo97w53RKCWbGwlJcXV20+GCsfGnt2pA4VfATy7onJx/eVNa1G\n0MIVU2nozxRC5mLha7XdUzBPLc6yYU1nOCxbKHDCn4vWElo+re9eRlBsWH7kLL/S\nHhieqc/WJjOEBYjkged3qZrtRJtVpul+byJm9cOF7Hy0+nMWMEuve30IwQKBgGLe\nHNwhARkWnQApGGGR/4Bxh0g60DhmXI6vtfKnB0jzMIA/piM/aDhDU9hIF1sTkLgo\nmCaBYDKucG7GXl2Cbvr0PDXeECFDiND6TmmTpoqMb6mgeUhjswBQQwbnQavo/4/m\nvf7GOJ88eefXMOzy0fVoncUzF1eScIkAljPL2/atAoGBANLpvuqjb6dBfpeLx9t0\n2ppe0o9GT/KTTIMAUDwKqOuF5SdpFBcN03gmc0Huh27pDek0CEfWa+6zUpNfZN0s\nrl6oSDdPf6X0jBfH9/gtMgWfh/ZOju1ELolpJPEuHiUA3VQdpADCbff7Xva7Hk9W\nNFUd2USw+FUPc6OOYVPhol7p\n-----END PRIVATE KEY-----\n",
        client_email:
          "firebase-adminsdk-fbsvc@viteezy-mobile.iam.gserviceaccount.com",
        client_id: "103588477876428010974",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url:
          "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url:
          "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40viteezy-mobile.iam.gserviceaccount.com",
        universe_domain: "googleapis.com",
      };

      if (!firebaseServiceAccount) {
        logger.warn(
          "FIREBASE_SERVICE_ACCOUNT not found in environment variables. Firebase authentication will not work."
        );
        return;
      }

      // Parse service account JSON
      let serviceAccount: any;
      try {
        serviceAccount = firebaseServiceAccount;
      } catch (error) {
        logger.error(
          "Failed to parse FIREBASE_SERVICE_ACCOUNT JSON. Please ensure it's valid JSON."
        );
        return;
      }

      // Initialize Firebase Admin SDK
      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      logger.info("Firebase Admin SDK initialized successfully");
    } catch (error: any) {
      logger.error("Failed to initialize Firebase Admin SDK:", error);
      throw new AppError(
        "Firebase initialization failed. Please check your configuration.",
        500
      );
    }
  }

  /**
   * Verify Apple ID token
   * @param idToken - Apple ID token from client
   * @returns Decoded token with user information
   */
  async verifyAppleIdToken(
    idToken: string
  ): Promise<admin.auth.DecodedIdToken> {
    if (!this.app) {
      throw new AppError(
        "Firebase Admin SDK is not initialized. Please check your configuration.",
        500
      );
    }

    try {
      // Verify the ID token
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      // Check if the token is from Apple provider
      if (decodedToken.firebase.sign_in_provider !== "apple.com") {
        throw new AppError("Invalid token provider. Expected Apple.", 400);
      }

      logger.info(
        `Apple ID token verified successfully for user: ${decodedToken.uid}`
      );

      return decodedToken;
    } catch (error: any) {
      logger.error("Failed to verify Apple ID token:", error);

      if (error.code === "auth/id-token-expired") {
        throw new AppError("Apple ID token has expired", 401);
      }

      if (error.code === "auth/id-token-revoked") {
        throw new AppError("Apple ID token has been revoked", 401);
      }

      if (error.code === "auth/argument-error") {
        throw new AppError("Invalid Apple ID token format", 400);
      }

      throw new AppError(
        error.message || "Failed to verify Apple ID token",
        401
      );
    }
  }

  /**
   * Get user information from decoded token
   * @param decodedToken - Decoded Firebase token
   * @returns User information object with email and generated name
   */
  getUserInfoFromToken(decodedToken: admin.auth.DecodedIdToken): {
    uid: string;
    email: string;
    name: string;
    emailVerified: boolean;
  } {
    // Extract email from token (check multiple possible fields)
    let email = decodedToken.email || "";

    // If email is not directly in token, try to get from Firebase user record
    // Note: For Apple Sign In, email should be in the token
    if (!email) {
      // Try to get from firebase.identities if available
      const identities = (decodedToken.firebase as any)?.identities;
      if (identities && identities.email && identities.email.length > 0) {
        email = identities.email[0];
      }
    }

    // Extract name from token or generate from email
    let name = decodedToken.name;

    // If name is not available, generate from email
    if (!name && email) {
      // Generate name from email (e.g., "john.doe@example.com" -> "John Doe")
      const emailParts = email.split("@")[0];
      const nameParts = emailParts
        .split(/[._-]/)
        .filter((part: string) => part.length > 0);

      if (nameParts.length > 0) {
        name = nameParts
          .map(
            (part: string) =>
              part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          )
          .join(" ");
      }

      // If still empty or invalid, use a default based on email
      if (!name || name.trim() === "") {
        name =
          email.split("@")[0].charAt(0).toUpperCase() +
          email.split("@")[0].slice(1).toLowerCase();
      }
    }

    // Final fallback
    if (!name || name.trim() === "") {
      name = "Apple User";
    }

    return {
      uid: decodedToken.uid,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      emailVerified: decodedToken.email_verified || false,
    };
  }
}

// Export singleton instance
export const firebaseService = new FirebaseService();
