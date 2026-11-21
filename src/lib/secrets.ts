/** FR-B3: basic pattern checks. Returns a description of what looks like a secret, or '' if fine. */
export function looksSecret(t:string):string{
  if(/\b(?:\d[ -]?){13,19}\b/.test(t))return'a card number'
  if(/\b(password|passwd|passcode|pin|otp|cvv|cvc)\b\s*(is|:|=)\s*\S+/i.test(t))return'a password, PIN or OTP'
  if(/(?<!\S)(?=\S*[A-Z])(?=\S*[a-z])(?=\S*\d)(?=\S*[^A-Za-z0-9])\S{8,}(?!\S)/.test(t))return'a password-like string'
  return''
}
