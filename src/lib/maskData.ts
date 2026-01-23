/**
 * Data masking utilities for privacy protection
 * These functions mask sensitive personal information for display
 */

/**
 * Masks a full name, showing only first name and initial of last name
 * @example maskName("John Kamau") -> "John K***"
 */
export function maskName(fullName: string): string {
  if (!fullName || fullName.trim().length === 0) return "***";
  
  const parts = fullName.trim().split(" ");
  if (parts.length === 1) {
    return parts[0].charAt(0) + "***";
  }
  
  const firstName = parts[0];
  const lastNameInitial = parts[parts.length - 1].charAt(0);
  return `${firstName} ${lastNameInitial}***`;
}

/**
 * Masks an ID number, showing only last 3 digits
 * @example maskId("12345678") -> "*****678"
 */
export function maskId(idNumber: string): string {
  if (!idNumber || idNumber.length < 3) return "***";
  
  const visiblePart = idNumber.slice(-3);
  const maskedPart = "*".repeat(idNumber.length - 3);
  return `${maskedPart}${visiblePart}`;
}

/**
 * Masks a phone number, showing only country code and last 3 digits
 * @example maskPhone("+254712345678") -> "+254***678"
 */
export function maskPhone(phoneNumber: string): string {
  if (!phoneNumber || phoneNumber.length < 6) return "***";
  
  // Handle Kenyan format
  if (phoneNumber.startsWith("+254")) {
    const lastDigits = phoneNumber.slice(-3);
    return `+254***${lastDigits}`;
  }
  
  // Handle other formats
  if (phoneNumber.startsWith("0")) {
    const lastDigits = phoneNumber.slice(-3);
    return `0***${lastDigits}`;
  }
  
  const lastDigits = phoneNumber.slice(-3);
  return `***${lastDigits}`;
}

/**
 * Masks an email address, showing only first 2 characters and domain
 * @example maskEmail("john.doe@gmail.com") -> "jo***@gmail.com"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***";
  
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  
  return `${localPart.slice(0, 2)}***@${domain}`;
}

/**
 * Masks a student ID, showing only last 4 characters
 * @example maskStudentId("STU/2024/12345") -> "***2345"
 */
export function maskStudentId(studentId: string): string {
  if (!studentId || studentId.length < 4) return "***";
  
  const visiblePart = studentId.slice(-4);
  return `***${visiblePart}`;
}

/**
 * Masks a NEMIS ID for secondary students
 * @example maskNemisId("12345678901234") -> "***1234"
 */
export function maskNemisId(nemisId: string): string {
  if (!nemisId || nemisId.length < 4) return "***";
  
  const visiblePart = nemisId.slice(-4);
  return `***${visiblePart}`;
}

/**
 * Generates a tracking number for applications
 * Format: BKE-XXXXXX (6 random alphanumeric characters)
 */
export function generateTrackingNumber(): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "BKE-";
  
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
}

/**
 * Validates a tracking number format
 * @example isValidTrackingNumber("BKE-ABC123") -> true
 */
export function isValidTrackingNumber(trackingNumber: string): boolean {
  const pattern = /^BKE-[A-Z0-9]{6}$/;
  return pattern.test(trackingNumber.toUpperCase());
}
