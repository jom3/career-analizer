import { TestBed } from '@angular/core/testing';
import { FormArray } from '@angular/forms';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  newExperienceForm,
  newSkillForm,
  type ExperienceForm,
  type SkillForm,
} from '../../core/profile-form';
import { ExperienceSectionComponent } from './experience-section.component';
import { SkillsSectionComponent } from './skills-section.component';

describe('SkillsSectionComponent', () => {
  let skills: FormArray<SkillForm>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    skills = new FormArray<SkillForm>([newSkillForm()]);
  });

  it('inserta el ítem nuevo arriba al confirmar el modal', async () => {
    const fixture = TestBed.createComponent(SkillsSectionComponent);
    fixture.componentRef.setInput('skills', skills);
    await fixture.whenStable();

    fixture.componentInstance.openNew();
    fixture.componentInstance.editor.draft()?.controls.name.setValue('Go');
    fixture.componentInstance.confirm();

    expect(skills.length).toBe(2);
    expect(skills.at(0).controls.name.value).toBe('Go');
  });

  it('no agrega nada si el modal se cierra sin confirmar', async () => {
    const fixture = TestBed.createComponent(SkillsSectionComponent);
    fixture.componentRef.setInput('skills', skills);
    await fixture.whenStable();

    fixture.componentInstance.openNew();
    fixture.componentInstance.editor.dismiss();

    expect(skills.length).toBe(1);
  });

  it('edita una copia y solo reemplaza el original al confirmar', async () => {
    const fixture = TestBed.createComponent(SkillsSectionComponent);
    fixture.componentRef.setInput('skills', skills);
    await fixture.whenStable();

    fixture.componentInstance.openEdit(0);
    fixture.componentInstance.editor.draft()?.controls.name.setValue('Rust');
    expect(skills.at(0).controls.name.value).toBe('');

    fixture.componentInstance.confirm();
    expect(skills.at(0).controls.name.value).toBe('Rust');
  });

  it('quita el ítem indicado', async () => {
    const fixture = TestBed.createComponent(SkillsSectionComponent);
    fixture.componentRef.setInput('skills', skills);
    await fixture.whenStable();

    fixture.componentInstance.remove(0);
    expect(skills.length).toBe(0);
  });

  it('marca el ítem duplicado según el índice recibido', async () => {
    const fixture = TestBed.createComponent(SkillsSectionComponent);
    fixture.componentRef.setInput('skills', skills);
    fixture.componentRef.setInput('duplicateIndices', new Set([0]));
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.tag--duplicate')).not.toBeNull();
  });

  it('no muestra el tag de duplicado sin índices marcados', async () => {
    const fixture = TestBed.createComponent(SkillsSectionComponent);
    fixture.componentRef.setInput('skills', skills);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.tag--duplicate')).toBeNull();
  });

  it('el botón del modal dice Aplicar, no Guardar', async () => {
    const fixture = TestBed.createComponent(SkillsSectionComponent);
    fixture.componentRef.setInput('skills', skills);
    await fixture.whenStable();

    fixture.componentInstance.openNew();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const apply = element.querySelector('app-item-modal .btn--primary');
    expect(apply?.textContent).toContain(
      fixture.componentInstance.i18n.t('common.apply'),
    );
  });

  it('muestra el campo concreto cuando el borrador es inválido', async () => {
    const fixture = TestBed.createComponent(SkillsSectionComponent);
    fixture.componentRef.setInput('skills', skills);
    await fixture.whenStable();

    fixture.componentInstance.openNew();
    fixture.componentInstance.editor.draft()?.controls.name.setValue('');
    fixture.componentInstance.confirm();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const alert = element.querySelector('app-form-error .alert');
    expect(alert?.textContent).toContain(
      fixture.componentInstance.i18n.t('validation.required'),
    );
  });
});

describe('ExperienceSectionComponent', () => {
  let experiences: FormArray<ExperienceForm>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    experiences = new FormArray<ExperienceForm>([newExperienceForm()]);
  });

  it('oculta el editor de métricas con showMetrics en false', async () => {
    const fixture = TestBed.createComponent(ExperienceSectionComponent);
    fixture.componentRef.setInput('experiences', experiences);
    fixture.componentRef.setInput('showMetrics', false);
    await fixture.whenStable();

    fixture.componentInstance.openNew();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.metrics-editor')).toBeNull();
    expect(element.querySelector('[formcontrolname="company"]')).not.toBeNull();
  });

  it('muestra el editor de métricas por defecto y permite agregar', async () => {
    const fixture = TestBed.createComponent(ExperienceSectionComponent);
    fixture.componentRef.setInput('experiences', experiences);
    await fixture.whenStable();

    fixture.componentInstance.openEdit(0);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.metrics-editor')).not.toBeNull();

    const draft = fixture.componentInstance.editor.draft();
    fixture.componentInstance.addMetric(draft!);
    expect(draft!.controls.metrics.length).toBe(1);
    expect(experiences.at(0).controls.metrics.length).toBe(0);
  });

  it('no permite más de cinco métricas', async () => {
    const fixture = TestBed.createComponent(ExperienceSectionComponent);
    fixture.componentRef.setInput('experiences', experiences);
    await fixture.whenStable();

    fixture.componentInstance.openEdit(0);
    const draft = fixture.componentInstance.editor.draft()!;
    for (let index = 0; index < 7; index += 1) {
      fixture.componentInstance.addMetric(draft);
    }

    expect(draft.controls.metrics.length).toBe(5);
  });

  it('marca solapamiento y duplicado por índice', async () => {
    const fixture = TestBed.createComponent(ExperienceSectionComponent);
    fixture.componentRef.setInput('experiences', experiences);
    fixture.componentRef.setInput('duplicateIndices', new Set([0]));
    fixture.componentRef.setInput('overlapIndices', new Set([0]));
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.tag--duplicate').length).toBe(2);
  });

  it('deshabilita la fecha de fin al marcar el puesto como actual', async () => {
    const fixture = TestBed.createComponent(ExperienceSectionComponent);
    fixture.componentRef.setInput('experiences', experiences);
    await fixture.whenStable();

    const group = experiences.controls[0];
    const event = { target: { checked: true } } as unknown as Event;

    fixture.componentInstance.onCurrentChange(group, event);
    expect(group.controls.endDate.disabled).toBe(true);

    fixture.componentInstance.onCurrentChange(group, {
      target: { checked: false },
    } as unknown as Event);
    expect(group.controls.endDate.enabled).toBe(true);
  });
});
