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
        project_id: "viteezy-77d78",
        private_key_id: "ae8580f796e7deee6a499a92ce4912cf65bbe0ad",
        private_key:
          "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQClV1SqsmMnrX3e\ngpacOLuknKzVQoFiDq2AE0K7ZYi67Mjxrg69CWttcGLN1joR+17nxaMmv1Dwhzjw\nWvo7l6xsFOOnR1FMXpUf227VnfNE5hl+GTRReCEOqLdpvWRlhushQnBcH9r8QcK+\nIYzYCw22qqvZdL6JYlrgAzgEDp62ZxlIPvgY/tg9tJ3VKKRcv5jg0rva7/Xstyqi\nTrCOLjy/UAXRenMcyCoxm/Jr9p1sRw6tLoljijnMAm4owbzuVpo/pN29yBtv52Cr\n1tJtm2Zvd2rmlKowVszk3GfaumnGZAntu5nccgCUMZ2pinKKpTSqaaN3ShrGrT8n\nsR4G+PrRAgMBAAECggEAGocng3e5pv0UC+Zh6dDEcoXcyR6xiZ0XQ0xT0aNZy7wA\nBZ7KqJPhU57Li4EKsiXltUQliCr7/ouDnDTMn1EXjgPP/t/XcGxgessHPmjoRi6w\n+mVq2oNusl5phyKnAA8knKJ/Spil1wFqEH1rjqI/YgaCKhKsG3jXYcfCbgw2dMdV\npTQAMTTihzivahHmeMxl+FImMiZlA3Jrd/VacLV+fkHCChBAXj3wSX9dwSBkDteE\neqPyr23i4IaFfR4uBpzbJgVJv+uF/PyXUuIHQWsIEpkwRM3UlzHYiqxN7fXvTPP/\nQZvFRwgzlPp0n78jl8/odJiHfEEzYTkGSpWp5DKT3QKBgQDgvb2Ptu9OWAgybvvM\n+Xd7cIHetKPXu7+9rFRIhaSL/cJJZMmdgY6wW4jtfKxJWas6YAm+n1mcyQtf7y/m\nLtNtDB3+Gt9RpAYJq8WDgEVe/NdRMK8nnx2EmrnWFUleFgRXCWSAic3EaewpiJL+\nOM35c/o1uJikUg319XmBXAA1IwKBgQC8Vo8z0IqwJHUEOduDD10VKvmec2+cVSih\nnMcyWTkAl93s1ECWianYUCeJdppTT/Jx9ptmD7jfE7rY3eoXGZ7W8h9VvA1h/wqy\nSXA7DLxR29GfsA0QHYUmxtDGpQpGK9N1sf3feyqP75ibATNcrkVd6wLd/Gscdjge\nYXloeRlxewKBgQCGMUVq9rRVd0MNui8n6R1q23bwX7QlMLoAq1F4LDRgUpkb8c5g\n+ecVbtKH25WUBrKzHH01ETkU4QaltdBIBVXBGycdfzYxLVtdku9Q4dqKKTb4B7XO\nVrftYeXs6rDwOP1GaxlTlvUCfqzA8Ae1PH3goVuZkCu0kjo7zuNKVoDZOQKBgFgW\n8GHez491bdntKdPSEsp80EYhXfm0Bw4YIz9UZgn1/lHwMMl4WB2Z1/Q+qg3/nbla\nC/MftWt5cfJPUVc+n4GPu8JA8817Gcir+rdTzJ1JAHH9SQ7Zj9bENRBET1rk0sIA\n32pw1EaAXVNaq2hVBpLYAf5MOtkUHklvc/a+dX0TAoGBAJy/I99LP/c91Cgk98W/\nPvg/OnkcfdlJxgHukCedJshufn+LekmAh4gMnVT2RLTDunzpI40zXJgUq02+CccK\n++BvBxZDgngDAS5siXY+F//OunIEI2ujm6jWnhEJULObPx5rh6Ffs4ExFApvhqBx\nOzT4Lu/731LocD6cJcA2EG8H\n-----END PRIVATE KEY-----\n",
        client_email:
          "firebase-adminsdk-fbsvc@viteezy-77d78.iam.gserviceaccount.com",
        client_id: "109751369357649093118",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url:
          "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url:
          "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40viteezy-77d78.iam.gserviceaccount.com",
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
            (part: string) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
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
