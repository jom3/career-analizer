import { TestBed } from '@angular/core/testing';
import { FormArray } from '@angular/forms';
import { beforeEach, describe, expect, it } from 'vitest';
import { newEducationForm, type EducationForm } from '../../core/profile-form';
import { EducationSectionComponent } from './education-section.component';

describe('EducationSectionComponent document upload', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('asks to save first while the item has no id', async () => {
    const fixture = TestBed.createComponent(EducationSectionComponent);
    fixture.componentRef.setInput(
      'education',
      new FormArray<EducationForm>([newEducationForm({ degree: 'Licenciatura' })]),
    );
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain(
      'Save your profile before attaching a file to this item.',
    );
    expect(element.querySelector('input[type="file"]')).toBeNull();
  });

  it('enables the upload when the reloaded list carries the saved id', async () => {
    const fixture = TestBed.createComponent(EducationSectionComponent);
    fixture.componentRef.setInput(
      'education',
      new FormArray<EducationForm>([newEducationForm({ degree: 'Licenciatura' })]),
    );
    await fixture.whenStable();

    fixture.componentRef.setInput(
      'education',
      new FormArray<EducationForm>([
        newEducationForm({ id: 'edu-1', degree: 'Licenciatura' }),
      ]),
    );
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).not.toContain(
      'Save your profile before attaching a file to this item.',
    );
    expect(element.querySelector('input[type="file"]')).not.toBeNull();
  });
});
