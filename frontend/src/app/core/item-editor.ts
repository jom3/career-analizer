import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
} from '@angular/forms';
import { signal } from '@angular/core';

// Copia profunda de un grupo de formulario: conserva valores, validadores y
// estado disabled, para editar sin tocar el ítem original hasta confirmar.
export function cloneGroup<G extends FormGroup>(group: G): G {
  return cloneControl(group) as G;
}

function cloneControl(control: AbstractControl): AbstractControl {
  if (control instanceof FormGroup) {
    return new FormGroup(cloneChildren(control.controls));
  }
  if (control instanceof FormArray) {
    return new FormArray(control.controls.map(cloneControl));
  }
  const copy = new FormControl(control.value, { validators: control.validator });
  if (control.disabled) {
    copy.disable();
  }
  return copy;
}

function cloneChildren(
  controls: Record<string, AbstractControl>,
): Record<string, AbstractControl> {
  return Object.fromEntries(
    Object.entries(controls).map(([key, control]) => [key, cloneControl(control)]),
  );
}

// Edita un ítem de un FormArray dentro de un modal: el borrador es una copia
// que reemplaza al original solo al confirmar.
export class ItemEditor<G extends FormGroup> {
  readonly draft = signal<G | null>(null);
  readonly invalid = signal(false);
  private array: FormArray<G> | null = null;
  private index: number | null = null;

  openNew(array: FormArray<G>, create: () => G): void {
    this.array = array;
    this.index = null;
    this.draft.set(create());
  }

  openEdit(array: FormArray<G>, index: number): void {
    this.array = array;
    this.index = index;
    this.draft.set(cloneGroup(array.controls[index] as G));
  }

  isNew(): boolean {
    return this.index === null && this.draft() !== null;
  }

  confirm(): boolean {
    const draft = this.draft();
    if (!draft || !this.array) {
      return false;
    }
    if (draft.invalid) {
      draft.markAllAsTouched();
      this.invalid.set(true);
      return false;
    }
    if (this.index === null) {
      this.array.insert(0, draft);
    } else {
      this.array.setControl(this.index, draft);
    }
    this.close();
    return true;
  }

  dismiss(): void {
    this.close();
  }

  private close(): void {
    this.invalid.set(false);
    this.draft.set(null);
    this.array = null;
    this.index = null;
  }
}
