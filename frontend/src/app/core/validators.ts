import type {
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';

// Un campo con solo espacios cuenta como vacío, igual que en el backend.
export function trimmedRequired(
  control: AbstractControl,
): ValidationErrors | null {
  const value = control.value;
  if (typeof value !== 'string') {
    return null;
  }
  return value.trim().length > 0 ? null : { required: true };
}

// El backend acepta URLs sin protocolo; se replica esa tolerancia.
export function optionalUrl(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value.trim() : '';
  if (!value) {
    return null;
  }
  if (/\s/.test(value)) {
    return { url: true };
  }
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    return url.hostname.includes('.') ? null : { url: true };
  } catch {
    return { url: true };
  }
}

export function optionalIntegerRange(min: number, max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const number = Number(value);
    if (!Number.isInteger(number)) {
      return { integer: true };
    }
    return number >= min && number <= max ? null : { range: { min, max } };
  };
}

// Valida cada elemento de una lista separada por comas (p. ej. techStack).
export function commaSeparatedMaxLength(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value : '';
    const tooLong = value
      .split(',')
      .map((part) => part.trim())
      .some((part) => part.length > max);
    return tooLong ? { maxLength: { requiredLength: max } } : null;
  };
}
